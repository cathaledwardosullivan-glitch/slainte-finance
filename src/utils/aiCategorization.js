/**
 * AI Categorization Module
 *
 * Handles actual Claude API calls for transaction categorization.
 * Used when:
 * - No identifier matches (probability-based suggestions need verification)
 * - User requests AI assistance
 * - Similar transaction matching finds potential matches
 *
 * This module implements the "AI_ASSIST" cohort functionality with REAL AI calls.
 */

import { callClaude } from './claudeAPI';
import { isAIEnabled } from './privacyGate';
import { MODELS } from '../data/modelConfig';
import { GROUPS, findSimilarCategorizedTransactions, getSuggestionFromSimilarTransactions } from './categorizationEngine';
import { clusterSimilarTransactions } from './stringUtils';

// =============================================================================
// ERROR LOGGING HELPER
// =============================================================================

/**
 * Log detailed API error information for debugging
 * Helps diagnose why AI calls fail (rate limits, network, auth, etc.)
 */
function logAPIError(context, response, transaction) {
  const errorDetails = {
    timestamp: new Date().toISOString(),
    context,
    transaction: {
      details: transaction?.details?.substring(0, 60),
      amount: transaction?.debit || transaction?.credit || transaction?.amount
    },
    response: {
      success: response?.success,
      error: response?.error,
      source: response?.source
    }
  };

  // Categorize the error type for easier debugging
  const errorMsg = (response?.error || '').toLowerCase();
  let errorType = 'unknown';

  if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
    errorType = 'RATE_LIMIT';
  } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
    errorType = 'TIMEOUT';
  } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
    errorType = 'NETWORK';
  } else if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('auth')) {
    errorType = 'AUTH';
  } else if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503')) {
    errorType = 'SERVER_ERROR';
  } else if (errorMsg.includes('key') || errorMsg.includes('invalid')) {
    errorType = 'API_KEY';
  }

  console.error(`[AI Categorization] ❌ API FAILURE [${errorType}]`, errorDetails);

  // Return error type for potential retry logic
  return errorType;
}

// =============================================================================
// PROMPT TEMPLATES
// =============================================================================

/**
 * Build prompt for Group classification
 */
function buildGroupPrompt(transaction, context = {}) {
  const { similarTransactions = [], corrections = [], availableGroups = GROUPS } = context;

  // Format similar transactions as examples - include BOTH group and specific category
  // This prevents AI from saying "categorized as OTHER" when it was actually "PPE & Safety Equipment"
  const similarExamples = similarTransactions.slice(0, 5).map(sim => {
    const categoryInfo = sim.category?.name ? ` → ${sim.category.name}` : '';
    return `- "${sim.transaction.details}" → ${sim.group}${categoryInfo} (${Math.round(sim.similarity * 100)}% similar)`;
  }).join('\n');

  // Format corrections as learning context
  // Corrections have structure: { pattern, aiSuggested: {code, name}, userChose: {code, name} }
  const correctionExamples = corrections.slice(0, 5).map(c => {
    const aiName = c.aiSuggested?.name || c.aiSuggested || 'Unknown';
    const userName = c.userChose?.name || c.userChose || 'Unknown';
    return `- Pattern "${c.pattern}": AI suggested ${aiName}, user chose ${userName}`;
  }).join('\n');

  // Format available groups
  const groupOptions = Object.values(availableGroups)
    .filter(g => g.code !== 'NON_BUSINESS') // Exclude non-business for now
    .map(g => `- ${g.code}: ${g.name}`)
    .join('\n');

  return `You are helping categorize Irish GP practice financial transactions.

TRANSACTION: "${transaction.details}"
AMOUNT: €${Math.abs(transaction.debit || transaction.credit || transaction.amount || 0).toFixed(2)}
TYPE: ${transaction.type || 'expense'}

Which GROUP does this transaction belong to?

AVAILABLE GROUPS:
${groupOptions}

${similarExamples ? `SIMILAR ALREADY-CATEGORIZED TRANSACTIONS:\n${similarExamples}\n` : ''}
${correctionExamples ? `PREVIOUS CORRECTIONS (learn from these):\n${correctionExamples}\n` : ''}
IMPORTANT:
- INCOME group is for money coming IN (patient fees, GMS payments, refunds)
- All other groups are for expenses (money going OUT)
- STAFF is for salaries, wages, pension contributions, staff training
- MEDICAL is for drugs, medical supplies, lab tests
- PREMISES is for rent, utilities, cleaning, repairs
- OFFICE is for IT, phones, stationery, subscriptions
- PROFESSIONAL is for accountant fees, legal fees, insurance
- MOTOR is for fuel, car maintenance, vehicle costs

Respond with ONLY a JSON object in this exact format:
{"group": "GROUP_CODE", "confidence": 0.0-1.0, "reasoning": "Brief explanation"}`;
}

/**
 * Build prompt for Category classification (within a known Group)
 */
function buildCategoryPrompt(transaction, groupCode, categoryOptions, context = {}) {
  const { similarTransactions = [], corrections = [] } = context;

  // Filter similar transactions to same group
  const relevantSimilar = similarTransactions
    .filter(s => s.group === groupCode)
    .slice(0, 5)
    .map(sim => `- "${sim.transaction.details}" → ${sim.categoryCode}: ${sim.category?.name || 'Unknown'} (${Math.round(sim.similarity * 100)}% similar)`)
    .join('\n');

  // Format category options
  const options = categoryOptions
    .map(c => `- ${c.code}: ${c.name}`)
    .join('\n');

  // Format corrections
  // Corrections have structure: { pattern, aiSuggested: {code, name}, userChose: {code, name}, context: {group} }
  const correctionExamples = corrections
    .filter(c => c.context?.group === groupCode || c.group === groupCode)
    .slice(0, 5)
    .map(c => {
      const userCode = c.userChose?.code || c.categoryCode || 'Unknown';
      const userName = c.userChose?.name || c.categoryName || 'Unknown';
      return `- Pattern "${c.pattern}": user chose ${userCode} (${userName})`;
    })
    .join('\n');

  return `You are helping categorize an Irish GP practice expense.

TRANSACTION: "${transaction.details}"
AMOUNT: €${Math.abs(transaction.debit || transaction.credit || transaction.amount || 0).toFixed(2)}
GROUP: ${groupCode} (already determined)

Which specific CATEGORY within ${groupCode} does this belong to?

AVAILABLE CATEGORIES IN ${groupCode}:
${options}

${relevantSimilar ? `SIMILAR TRANSACTIONS IN THIS GROUP:\n${relevantSimilar}\n` : ''}
${correctionExamples ? `PREVIOUS USER CHOICES:\n${correctionExamples}\n` : ''}
If unsure, choose the parent category (ending in .0) for the group.

Respond with ONLY a JSON object in this exact format:
{"categoryCode": "X.X", "confidence": 0.0-1.0, "reasoning": "Brief explanation"}`;
}

// =============================================================================
// AI CATEGORIZATION FUNCTIONS
// =============================================================================

/**
 * Get AI suggestion for Group classification
 *
 * @param {Object} transaction - Transaction to categorize
 * @param {Object} context - { existingTransactions, corrections, categoryMapping }
 * @returns {Promise<Object>} { group, confidence, reasoning, alternatives }
 */
export async function getAIGroupSuggestion(transaction, context = {}) {
  const { existingTransactions = [] } = context;
  // Ensure corrections is always an array (defensive check)
  const corrections = Array.isArray(context.corrections) ? context.corrections : [];

  console.log('[AI Categorization] getAIGroupSuggestion called:', {
    transactionDetails: transaction.details?.substring(0, 50),
    existingTransactionsCount: existingTransactions.length
  });

  // Find similar transactions for context
  const similarTransactions = findSimilarCategorizedTransactions(
    transaction,
    existingTransactions,
    0.25 // Lower threshold to get more examples
  );

  console.log('[AI Categorization] Similar transactions found:', {
    count: similarTransactions.length,
    matches: similarTransactions.slice(0, 3).map(s => ({
      details: s.transaction?.details?.substring(0, 40),
      similarity: Math.round(s.similarity * 100) + '%',
      commonWords: s.commonWords,
      group: s.group
    }))
  });

  // Get similarity-based suggestion first
  const similaritySuggestion = getSuggestionFromSimilarTransactions(similarTransactions);

  // In Local Only Mode, skip AI call and use similarity fallback directly
  if (!isAIEnabled()) {
    console.log('[AI Categorization] Local Only Mode: using similarity fallback');
    return {
      group: similaritySuggestion.suggestedGroup || 'OTHER',
      confidence: similaritySuggestion.probability || 0.3,
      reasoning: 'Local Only Mode: using similarity matching',
      source: 'similarity_fallback',
      alternatives: []
    };
  }

  // Build and send prompt
  const prompt = buildGroupPrompt(transaction, {
    similarTransactions,
    corrections: corrections.filter(c => c.layer === 'group'),
    availableGroups: GROUPS
  });

  try {
    const response = await callClaude(prompt, {
      model: MODELS.FAST,
      maxTokens: 256,
      temperature: 0.3 // Lower temperature for more consistent categorization
    });

    if (!response.success) {
      const errorType = logAPIError('getAIGroupSuggestion', response, transaction);
      // Fall back to similarity-based suggestion
      return {
        group: similaritySuggestion.suggestedGroup || 'OTHER',
        confidence: similaritySuggestion.probability || 0.3,
        reasoning: `AI unavailable (${errorType}), using similarity matching`,
        source: 'similarity_fallback',
        errorType,
        alternatives: []
      };
    }

    // Parse JSON response
    const content = response.content.trim();
    let parsed;

    try {
      // Extract JSON from response (handle potential extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[AI Categorization] Failed to parse response:', content);
      return {
        group: similaritySuggestion.suggestedGroup || 'OTHER',
        confidence: 0.3,
        reasoning: 'Failed to parse AI response',
        source: 'parse_error',
        alternatives: []
      };
    }

    // Validate group code
    const validGroup = GROUPS[parsed.group];
    if (!validGroup) {
      console.warn('[AI Categorization] Invalid group code:', parsed.group);
      parsed.group = 'OTHER';
      parsed.confidence = 0.3;
    }

    return {
      group: parsed.group,
      confidence: Math.min(parsed.confidence || 0.5, 0.85), // Cap at 85% for AI suggestions
      reasoning: parsed.reasoning || 'AI suggestion',
      source: 'ai',
      similarTransactions: similarTransactions.slice(0, 3),
      alternatives: similaritySuggestion.alternatives?.slice(0, 2) || []
    };

  } catch (error) {
    const errorType = logAPIError('getAIGroupSuggestion (exception)', { error: error.message }, transaction);
    return {
      group: similaritySuggestion.suggestedGroup || 'OTHER',
      confidence: 0.3,
      reasoning: `Error (${errorType}): ${error.message}`,
      source: 'error',
      errorType,
      alternatives: []
    };
  }
}

/**
 * Get AI suggestion for Category classification
 *
 * @param {Object} transaction - Transaction to categorize
 * @param {string} groupCode - Already-determined group
 * @param {Array} categoryOptions - Categories within this group
 * @param {Object} context - { existingTransactions, corrections }
 * @returns {Promise<Object>} { categoryCode, confidence, reasoning, alternatives }
 */
export async function getAICategorySuggestion(transaction, groupCode, categoryOptions, context = {}) {
  const { existingTransactions = [] } = context;
  // Ensure corrections is always an array (defensive check)
  const corrections = Array.isArray(context.corrections) ? context.corrections : [];

  // Find similar transactions
  const similarTransactions = findSimilarCategorizedTransactions(
    transaction,
    existingTransactions.filter(t => t.group === groupCode),
    0.25
  );

  // Get similarity-based suggestion
  const similaritySuggestion = getSuggestionFromSimilarTransactions(similarTransactions);

  // In Local Only Mode, skip AI call and use similarity fallback directly
  if (!isAIEnabled()) {
    console.log('[AI Categorization] Local Only Mode: using similarity fallback for category');
    return {
      categoryCode: similaritySuggestion.suggestedCategoryCode || categoryOptions.find(c => c.code.endsWith('.0'))?.code,
      confidence: similaritySuggestion.probability || 0.3,
      reasoning: 'Local Only Mode: using similarity matching',
      source: 'similarity_fallback',
      alternatives: []
    };
  }

  // Build and send prompt
  const prompt = buildCategoryPrompt(transaction, groupCode, categoryOptions, {
    similarTransactions,
    corrections: corrections.filter(c => c.layer === 'category' && c.group === groupCode)
  });

  try {
    const response = await callClaude(prompt, {
      model: MODELS.FAST,
      maxTokens: 256,
      temperature: 0.3
    });

    if (!response.success) {
      const errorType = logAPIError('getAICategorySuggestion', response, transaction);
      return {
        categoryCode: similaritySuggestion.suggestedCategoryCode || categoryOptions.find(c => c.code.endsWith('.0'))?.code,
        confidence: similaritySuggestion.probability || 0.3,
        reasoning: `AI unavailable (${errorType}), using similarity matching`,
        source: 'similarity_fallback',
        errorType,
        alternatives: []
      };
    }

    // Parse JSON response
    const content = response.content.trim();
    let parsed;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[AI Categorization] Failed to parse response:', content);
      return {
        categoryCode: categoryOptions.find(c => c.code.endsWith('.0'))?.code,
        confidence: 0.3,
        reasoning: 'Failed to parse AI response',
        source: 'parse_error',
        alternatives: []
      };
    }

    // Validate category code
    const validCategory = categoryOptions.find(c => c.code === parsed.categoryCode);
    if (!validCategory) {
      console.warn('[AI Categorization] Invalid category code:', parsed.categoryCode);
      // Try to find parent category
      const parentCategory = categoryOptions.find(c => c.code.endsWith('.0'));
      parsed.categoryCode = parentCategory?.code;
      parsed.confidence = 0.3;
    }

    return {
      categoryCode: parsed.categoryCode,
      categoryName: validCategory?.name || categoryOptions.find(c => c.code === parsed.categoryCode)?.name,
      confidence: Math.min(parsed.confidence || 0.5, 0.85),
      reasoning: parsed.reasoning || 'AI suggestion',
      source: 'ai',
      similarTransactions: similarTransactions.slice(0, 3),
      alternatives: similaritySuggestion.alternatives?.slice(0, 2) || []
    };

  } catch (error) {
    const errorType = logAPIError('getAICategorySuggestion (exception)', { error: error.message }, transaction);
    return {
      categoryCode: categoryOptions.find(c => c.code.endsWith('.0'))?.code,
      confidence: 0.3,
      reasoning: `Error (${errorType}): ${error.message}`,
      source: 'error',
      errorType,
      alternatives: []
    };
  }
}

// =============================================================================
// BATCH PROCESSING WITH CLUSTERING
// =============================================================================

/**
 * Process multiple transactions with AI assistance
 * OPTIMIZATION: Clusters similar transactions and makes ONE API call per cluster
 * This dramatically reduces API calls (e.g., 100 transactions → 20 API calls if avg cluster size is 5)
 *
 * @param {Array} transactions - Transactions needing AI assistance
 * @param {string} layer - 'group' or 'category'
 * @param {Object} context - { existingTransactions, corrections, categoryMapping }
 * @returns {Promise<Array>} Array of { transactionId, suggestion, clusterId?, clusterSize? }
 */
export async function batchAICategorization(transactions, layer, context = {}) {
  const { categoryMapping = [] } = context;
  const results = [];

  // Step 1: Cluster similar transactions together
  // This groups transactions like "LIDL DUBLIN", "LIDL CORK", "LIDL GALWAY" into one cluster
  const clusters = clusterSimilarTransactions(transactions, 0.80); // 80% similarity threshold

  console.log(`[AI Categorization] Batching ${transactions.length} transactions into ${clusters.length} clusters`);
  const multiMemberClusters = clusters.filter(c => c.size > 1);
  if (multiMemberClusters.length > 0) {
    console.log(`[AI Categorization] ${multiMemberClusters.length} clusters with 2+ transactions, saving ~${transactions.length - clusters.length} API calls`);
  }

  // Step 2: Process ONE representative per cluster
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const representative = cluster.representative;

    try {
      let suggestion;

      if (layer === 'group') {
        suggestion = await getAIGroupSuggestion(representative, context);
      } else {
        // Category layer - need group-specific categories
        const groupCode = representative.group;
        const groupCategories = categoryMapping.filter(c => {
          const catSection = c.section?.toUpperCase() || '';
          // Map section to group code
          if (groupCode === 'INCOME') return catSection.includes('INCOME');
          if (groupCode === 'STAFF') return catSection.includes('STAFF');
          if (groupCode === 'PREMISES') return catSection.includes('PREMISES');
          if (groupCode === 'MEDICAL') return catSection.includes('MEDICAL');
          if (groupCode === 'OFFICE') return catSection.includes('OFFICE') || catSection.includes('ADMIN');
          if (groupCode === 'PROFESSIONAL') return catSection.includes('PROFESSIONAL');
          if (groupCode === 'MOTOR') return catSection.includes('MOTOR');
          return catSection.includes('OTHER');
        });

        suggestion = await getAICategorySuggestion(representative, groupCode, groupCategories, context);
      }

      // Apply the same suggestion to ALL transactions in this cluster
      for (const transaction of cluster.transactions) {
        results.push({
          transactionId: transaction.id,
          suggestion: {
            ...suggestion,
            // Add cluster info for UI to show batch application
            clusterId: `cluster_${i}`,
            clusterSize: cluster.size,
            isClusterRepresentative: transaction.id === representative.id,
            clusterDetails: cluster.cleanedDetails
          }
        });
      }

      // Log cluster processing
      if (cluster.size > 1) {
        console.log(`[AI Categorization] Cluster ${i + 1}: Applied "${suggestion?.group || suggestion?.categoryCode}" to ${cluster.size} similar transactions`);
      }

      // Small delay between API calls to respect rate limits
      if (i < clusters.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`[AI Categorization] Error processing cluster ${i}:`, error.message);
      // Add null results for all transactions in this cluster
      for (const transaction of cluster.transactions) {
        results.push({
          transactionId: transaction.id,
          suggestion: null,
          error: error.message,
          clusterId: `cluster_${i}`,
          clusterSize: cluster.size
        });
      }
    }
  }

  return results;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  getAIGroupSuggestion,
  getAICategorySuggestion,
  batchAICategorization
};
