/**
 * Processing Flow Context
 *
 * Manages state for the Finn-guided transaction processing flow:
 * - Stage tracking (type → group → category)
 * - Cohort management (auto, ai_assist, review)
 * - AI integration for uncertain transactions
 * - Processing statistics
 *
 * KEY ARCHITECTURE:
 * - Identifier match (binary) → AUTO cohort (95%+ confidence)
 * - No identifier match + high probability → AI_ASSIST (AI verifies)
 * - No identifier match + low probability → REVIEW (user decides)
 */

import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { processTransactionsWithEngine } from '../../utils/transactionProcessor';
import { GROUPS, CONFIDENCE_THRESHOLDS, findSimilarCategorizedTransactions, getSuggestionFromSimilarTransactions } from '../../utils/categorizationEngine';
import { batchAICategorization, getAIGroupSuggestion, getAICategorySuggestion } from '../../utils/aiCategorization';
import { findSimilarTransactionGroups, cleanForClustering } from '../../utils/stringUtils';

// Processing stages
export const STAGES = {
  IDLE: 'idle',
  TYPE_SORTING: 'type_sorting',
  TYPE_REVIEW: 'type_review',
  GROUP_SORTING: 'group_sorting',
  GROUP_AI_PROCESSING: 'group_ai_processing',  // NEW: AI processing stage
  GROUP_REVIEW: 'group_review',
  CATEGORY_SORTING: 'category_sorting',
  CATEGORY_AI_PROCESSING: 'category_ai_processing',  // NEW: AI processing stage
  CATEGORY_REVIEW: 'category_review',
  COMPLETE: 'complete'
};

// Cohort types - UPDATED DESCRIPTIONS
export const COHORTS = {
  AUTO: 'auto',         // Identifier matched → HIGH confidence (95%+), auto-accepted
  AI_ASSIST: 'ai_assist', // No identifier match, AI called → AI suggestion with reasoning
  REVIEW: 'review',     // No identifier match, low probability → requires user review
  CONFLICT: 'conflict'  // Multiple identifiers matched different categories
};

const ProcessingFlowContext = createContext(null);

export const ProcessingFlowProvider = ({ children }) => {
  // Current stage in the flow
  const [stage, setStage] = useState(STAGES.IDLE);

  // Transactions being processed
  const [processingTransactions, setProcessingTransactions] = useState([]);

  // Processing statistics
  const [stats, setStats] = useState(null);

  // Whether the flow modal is open
  const [isFlowOpen, setIsFlowOpen] = useState(false);

  // Whether to show Finn's guidance messages
  const [showGuidance, setShowGuidance] = useState(true);

  // Current cohort being reviewed
  const [currentCohort, setCurrentCohort] = useState(null);

  // Processing error if any
  const [error, setError] = useState(null);

  // AI processing state
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [aiError, setAiError] = useState(null);

  // Context for AI (existing categorized transactions, corrections)
  const [aiContext, setAiContext] = useState({
    existingTransactions: [],
    corrections: [],
    categoryMapping: [],
    recordCorrection: null,  // Callback to record AI corrections when user rejects
    skipCategoryStage: false // For onboarding: skip category step, stop at group level
  });

  // Wave info (for bulk upload flow — display only)
  const [waveInfo, setWaveInfo] = useState(null);

  // Ref for cancellation
  const cancelRef = useRef(false);

  /**
   * Start processing a batch of transactions
   * @param {Array} transactions - Raw transactions from upload (or pre-processed from prefetch)
   * @param {Array} categoryMapping - Category definitions
   * @param {Object} context - Optional context object:
   *   @param {Array} context.existingTransactions - Already categorized transactions for similarity matching
   *   @param {Array} context.corrections - User corrections for AI learning
   *   @param {Function} context.recordCorrection - Callback to record AI corrections
   *   @param {boolean} context.skipCategoryStage - If true, skip category step (for onboarding)
   *   @param {boolean} context.prefetchedAI - If true, AI has already been run (skip AI processing)
   */
  const startProcessing = useCallback((transactions, categoryMapping, context = {}) => {
    if (!transactions || transactions.length === 0) {
      setError('No transactions to process');
      return;
    }

    // Check if transactions are already pre-processed (from background prefetch)
    const isPrefetched = transactions[0]?.groupCohort !== undefined;
    const isAIPrefetched = context.prefetchedAI || false;

    console.log('[ProcessingFlow] startProcessing called:', {
      newTransactionsCount: transactions.length,
      existingTransactionsCount: context.existingTransactions?.length || 0,
      correctionsCount: context.corrections?.length || 0,
      categoryMappingCount: categoryMapping?.length || 0,
      isPrefetched,
      isAIPrefetched
    });

    // Log personalized categories and their identifiers for debugging
    const personalizedCategories = categoryMapping?.filter(c => c.personalization === 'Personalized') || [];
    if (personalizedCategories.length > 0) {
      console.log('[ProcessingFlow] Personalized categories with identifiers:',
        personalizedCategories.map(c => ({
          code: c.code,
          name: c.name,
          identifiers: c.identifiers
        }))
      );
    } else {
      console.warn('[ProcessingFlow] WARNING: No personalized categories found in categoryMapping!');
    }

    // Log sample of existing transactions if any
    if (context.existingTransactions?.length > 0) {
      console.log('[ProcessingFlow] Sample existing transactions:',
        context.existingTransactions.slice(0, 3).map(t => ({
          details: t.details?.substring(0, 40),
          group: t.group,
          category: t.categoryCode || t.category?.code
        }))
      );
    }

    setError(null);
    setAiError(null);
    cancelRef.current = false;

    // Store wave info if provided (for bulk upload header display)
    setWaveInfo(context.waveInfo || null);

    // Store context for AI calls and correction recording
    setAiContext({
      existingTransactions: context.existingTransactions || [],
      corrections: context.corrections || [],
      categoryMapping,
      recordCorrection: context.recordCorrection || null,
      skipCategoryStage: context.skipCategoryStage || false,  // For onboarding: stop at group level
      prefetchedAI: isAIPrefetched  // Skip AI processing if already done
    });

    // Open the flow modal
    setIsFlowOpen(true);
    setStage(STAGES.TYPE_SORTING);

    try {
      let processed, processingStats;

      if (isPrefetched) {
        // Transactions are already processed (from background prefetch)
        // Just use them directly - no need to re-run engine
        console.log('[ProcessingFlow] Using prefetched transactions (skipping engine processing)');
        processed = transactions;

        // Calculate stats from prefetched data
        processingStats = {
          total: transactions.length,
          income: transactions.filter(t => t.type === 'income').length,
          expense: transactions.filter(t => t.type === 'expense').length,
          typeAnomalies: transactions.filter(t => t.typeAnomaly).length,
          groupAuto: transactions.filter(t => t.groupCohort === COHORTS.AUTO).length,
          groupAiAssist: transactions.filter(t => t.groupCohort === COHORTS.AI_ASSIST).length,
          groupReview: transactions.filter(t => t.groupCohort === COHORTS.REVIEW).length,
          groupConflicts: transactions.filter(t => t.groupCohort === COHORTS.CONFLICT).length
        };
      } else {
        // Process transactions through the engine (identifier matching + probability scoring)
        // Pass existing transactions for similar transaction matching (PRIMARY categorization method)
        const result = processTransactionsWithEngine(
          transactions,
          categoryMapping,
          context.existingTransactions || [] // Critical: enables similar transaction matching
        );
        processed = result.transactions;
        processingStats = result.stats;
      }

      setProcessingTransactions(processed);
      setStats(processingStats);

      // Always show TYPE_REVIEW stage so user sees the type sorting results
      // Even if there are no anomalies, we show a summary
      const typeAnomalies = processed.filter(t => t.typeAnomaly);
      setStage(STAGES.TYPE_REVIEW);
      setCurrentCohort({
        type: 'type_complete',
        anomalies: typeAnomalies,
        hasAnomalies: typeAnomalies.length > 0
      });
    } catch (err) {
      console.error('[ProcessingFlow] Processing error:', err);
      setError(err.message || 'Failed to process transactions');
      setStage(STAGES.IDLE);
    }
  }, []);

  /**
   * Run AI categorization for transactions in AI_ASSIST and REVIEW cohorts
   * @param {string} layer - 'group' or 'category'
   * @returns {Promise<void>}
   */
  const runAICategorization = useCallback(async (layer = 'group') => {
    console.log('[ProcessingFlow] runAICategorization called with layer:', layer);

    // Skip AI processing if already done (from background prefetch)
    if (aiContext.prefetchedAI && layer === 'group') {
      console.log('[ProcessingFlow] Skipping AI categorization - already prefetched');
      return;
    }

    const cohortField = layer === 'group' ? 'groupCohort' : 'categoryCohort';
    const aiSuggestedField = layer === 'group' ? 'groupAISuggested' : 'categoryAISuggested';
    const suggestionField = layer === 'group' ? 'aiGroupSuggestion' : 'aiCategorySuggestion';

    // Get transactions that need AI assistance
    // CRITICAL: Skip transactions that user has already reviewed/selected
    // This prevents overwriting user's manual selections when the effect re-triggers
    const reviewedField = layer === 'group' ? 'groupReviewed' : 'categoryReviewed';
    const matchTypeField = layer === 'group' ? 'groupMatchType' : 'categoryMatchType';
    const userSelectedMatchTypes = ['user_selected', 'user_accepted_ai', 'user_accepted', 'user_changed_group', 'user_resolved_conflict'];

    const transactionsNeedingAI = processingTransactions.filter(t => {
      // Must be in AI_ASSIST or REVIEW cohort
      const needsAI = t[cohortField] === COHORTS.AI_ASSIST || t[cohortField] === COHORTS.REVIEW;
      if (!needsAI) return false;

      // Skip if user has already reviewed this transaction
      if (t[reviewedField]) {
        console.log(`[ProcessingFlow] Skipping ${t.id} - already reviewed by user`);
        return false;
      }

      // Skip if user has made a manual selection
      if (userSelectedMatchTypes.includes(t[matchTypeField])) {
        console.log(`[ProcessingFlow] Skipping ${t.id} - user selected (${t[matchTypeField]})`);
        return false;
      }

      return true;
    });

    console.log('[ProcessingFlow] Transactions by cohort:', {
      total: processingTransactions.length,
      needingAI: transactionsNeedingAI.length,
      cohortBreakdown: {
        auto: processingTransactions.filter(t => t[cohortField] === COHORTS.AUTO).length,
        ai_assist: processingTransactions.filter(t => t[cohortField] === COHORTS.AI_ASSIST).length,
        review: processingTransactions.filter(t => t[cohortField] === COHORTS.REVIEW).length,
        conflict: processingTransactions.filter(t => t[cohortField] === COHORTS.CONFLICT).length
      }
    });

    if (transactionsNeedingAI.length === 0) {
      console.log('[ProcessingFlow] No transactions need AI assistance');
      return;
    }

    console.log(`[ProcessingFlow] Running AI categorization for ${transactionsNeedingAI.length} transactions (${layer})`);

    setAiProcessing(true);
    setAiProgress({ current: 0, total: transactionsNeedingAI.length });
    setAiError(null);

    try {
      console.log('[ProcessingFlow] Calling batchAICategorization with context:', {
        transactionsCount: transactionsNeedingAI.length,
        layer,
        existingTransactionsCount: aiContext.existingTransactions?.length || 0,
        sampleExisting: aiContext.existingTransactions?.slice(0, 2).map(t => ({
          details: t.details?.substring(0, 30),
          group: t.group
        }))
      });

      // Process in batches
      const results = await batchAICategorization(
        transactionsNeedingAI,
        layer,
        aiContext
      );

      // Update transactions with AI suggestions
      // Apply Bayesian updating ONLY if AI confirms the same group/category
      const updates = results.map(({ transactionId, suggestion }) => {
        // Find original transaction to get pre-prediction confidence
        const originalTx = processingTransactions.find(t => t.id === transactionId);
        const prePrediction = originalTx?.unifiedConfidence || 0;
        const aiConfidence = suggestion?.confidence || 0;

        // CRITICAL FIX: Only apply Bayesian boost if AI CONFIRMS the same group/category
        // If AI suggests a different group, we should NOT combine confidences
        const originalGroup = originalTx?.group;
        const originalCategory = originalTx?.categoryCode;
        const aiGroup = suggestion?.group;
        const aiCategory = suggestion?.categoryCode;

        const aiConfirmsGroup = layer === 'group' && aiGroup && aiGroup === originalGroup;
        const aiConfirmsCategory = layer === 'category' && aiCategory && aiCategory === originalCategory;
        const aiConfirmsPrediction = aiConfirmsGroup || aiConfirmsCategory;

        // Calculate confidence based on whether AI confirms or disagrees
        let combinedConfidence;
        let bayesianApplied = false;

        if (aiConfirmsPrediction && aiConfidence > 0 && prePrediction > 0) {
          // AI CONFIRMS: Apply Bayesian boost
          // P(correct | both) = 1 - P(wrong | pre) * P(wrong | AI)
          combinedConfidence = 1 - (1 - prePrediction) * (1 - aiConfidence);
          bayesianApplied = true;
          console.log(`[AI Bayesian] "${originalTx?.details?.substring(0, 30)}..." CONFIRMED: ${(prePrediction * 100).toFixed(0)}% + AI ${(aiConfidence * 100).toFixed(0)}% → ${(combinedConfidence * 100).toFixed(0)}%`);
        } else if (aiConfidence > 0) {
          // AI DISAGREES or no pre-prediction: Use AI confidence directly (no boost)
          combinedConfidence = aiConfidence;
          console.log(`[AI Override] "${originalTx?.details?.substring(0, 30)}..." AI suggests different ${layer}: ${aiGroup || aiCategory} (${(aiConfidence * 100).toFixed(0)}%)`);
        } else {
          // No AI confidence: Keep pre-prediction
          combinedConfidence = prePrediction;
        }

        // Determine if this is an AI OVERRIDE (AI suggests something different)
        // Overrides include: AI disagrees with original, OR original was UNKNOWN
        const isOriginalUnknown = originalGroup === 'UNKNOWN';
        const isAIOverride = !aiConfirmsPrediction && aiConfidence > 0;

        // Determine new cohort based on final confidence
        // CRITICAL: AI overrides are ALWAYS capped at 'ai_assist' - they require user approval
        // This ensures users verify when the system "changes its mind" based on AI
        const EPSILON = 0.0001;
        let newCohort;
        if (isAIOverride) {
          // AI override: Cap at ai_assist regardless of confidence (even if 99%)
          newCohort = combinedConfidence >= 0.50 - EPSILON ? 'ai_assist' : 'review';
          console.log(`[AI Override Cohort] Capping at ai_assist (was ${combinedConfidence >= 0.90 - EPSILON ? 'auto' : 'ai_assist'})`);
        } else {
          // AI confirms or no AI suggestion: Use normal thresholds
          newCohort = combinedConfidence >= 0.90 - EPSILON ? 'auto' :
                     combinedConfidence >= 0.50 - EPSILON ? 'ai_assist' : 'review';
        }

        // Determine if AI should update the group/category
        // For UNKNOWN: Allow AI to override even with low confidence (any suggestion is better than nothing)
        // For other groups: Require AI confidence >= 70% AND (confirms OR prePrediction < 50%)
        const shouldApplyAIGroup = layer === 'group' && aiGroup && (
          isOriginalUnknown ||  // UNKNOWN: any AI suggestion is allowed
          (suggestion?.confidence >= 0.70 && (aiConfirmsGroup || prePrediction < 0.50))
        );
        const shouldApplyAICategory = layer === 'category' && aiCategory && (
          suggestion?.confidence >= 0.70 && (aiConfirmsCategory || prePrediction < 0.50)
        );

        return {
          id: transactionId,
          [aiSuggestedField]: true,
          [suggestionField]: suggestion,
          // Update unified confidence
          unifiedConfidence: combinedConfidence,
          unifiedCohort: newCohort,
          // CRITICAL: Also update layer-specific cohort so UI filters correctly
          ...(layer === 'group' ? { groupCohort: newCohort } : {}),
          ...(layer === 'category' ? { categoryCohort: newCohort } : {}),
          // Add calculation details
          calculationDetails: {
            ...originalTx?.calculationDetails,
            bayesian: bayesianApplied ? {
              prePrediction,
              aiConfidence,
              combined: combinedConfidence,
              formula: `1 - (1 - ${prePrediction.toFixed(3)}) × (1 - ${aiConfidence.toFixed(3)})`,
              aiConfirmed: true,
              aiSuggested: aiGroup || aiCategory
            } : {
              prePrediction,
              aiConfidence,
              combined: combinedConfidence,
              formula: aiConfidence > 0 ? `AI override: ${(aiConfidence * 100).toFixed(0)}%` : 'No AI confidence',
              aiConfirmed: false,
              aiSuggested: aiGroup || aiCategory,
              originalSuggested: originalGroup || originalCategory,
              isOverride: isAIOverride,
              wasUnknown: isOriginalUnknown
            }
          },
          // Apply AI group if conditions met
          ...(shouldApplyAIGroup ? {
            group: suggestion.group,
            groupConfidence: combinedConfidence,
            groupReason: suggestion.reasoning
          } : {}),
          // Apply AI category if conditions met
          ...(shouldApplyAICategory ? {
            categoryCode: suggestion.categoryCode,
            categoryName: suggestion.categoryName,
            categoryConfidence: combinedConfidence,
            categoryReason: suggestion.reasoning
          } : {})
        };
      });

      setProcessingTransactions(prev => {
        const updateMap = new Map(updates.map(u => [u.id, u]));
        return prev.map(t => {
          const update = updateMap.get(t.id);
          return update ? { ...t, ...update } : t;
        });
      });

      console.log('[ProcessingFlow] AI categorization complete');
    } catch (err) {
      console.error('[ProcessingFlow] AI categorization error:', err);
      setAiError(err.message || 'AI categorization failed');
    } finally {
      setAiProcessing(false);
      setAiProgress({ current: 0, total: 0 });
    }
  }, [processingTransactions, aiContext]);

  /**
   * Get AI suggestion for a single transaction
   * @param {Object} transaction - Transaction to categorize
   * @param {string} layer - 'group' or 'category'
   * @returns {Promise<Object>} AI suggestion
   */
  const getAISuggestionForTransaction = useCallback(async (transaction, layer = 'group') => {
    try {
      if (layer === 'group') {
        return await getAIGroupSuggestion(transaction, aiContext);
      } else {
        const groupCategories = aiContext.categoryMapping.filter(c => {
          const section = c.section?.toUpperCase() || '';
          const groupCode = transaction.group;
          if (groupCode === 'INCOME') return section.includes('INCOME');
          if (groupCode === 'STAFF') return section.includes('STAFF');
          if (groupCode === 'PREMISES') return section.includes('PREMISES');
          if (groupCode === 'MEDICAL') return section.includes('MEDICAL');
          if (groupCode === 'OFFICE') return section.includes('OFFICE') || section.includes('ADMIN');
          if (groupCode === 'PROFESSIONAL') return section.includes('PROFESSIONAL');
          if (groupCode === 'MOTOR') return section.includes('MOTOR');
          if (groupCode === 'NON_BUSINESS') return section.includes('NON-BUSINESS') || section.includes('DRAWING');
          return section.includes('OTHER');
        });
        return await getAICategorySuggestion(transaction, transaction.group, groupCategories, aiContext);
      }
    } catch (err) {
      console.error('[ProcessingFlow] AI suggestion error:', err);
      return { error: err.message };
    }
  }, [aiContext]);

  /**
   * Get transactions by cohort for current stage
   */
  const getTransactionsByCohort = useCallback((cohortType, layer = 'category') => {
    if (!processingTransactions.length) return [];

    const cohortField = layer === 'group' ? 'groupCohort' : 'categoryCohort';
    const reviewField = layer === 'group' ? 'groupReviewed' : 'categoryReviewed';

    return processingTransactions.filter(t =>
      t[cohortField] === cohortType && !t[reviewField]
    );
  }, [processingTransactions]);

  /**
   * Get cohort counts for display
   */
  const getCohortCounts = useCallback((layer = 'category') => {
    if (!processingTransactions.length) {
      return { auto: 0, ai_assist: 0, review: 0, conflict: 0, total: 0 };
    }

    const cohortField = layer === 'group' ? 'groupCohort' : 'categoryCohort';

    return {
      auto: processingTransactions.filter(t => t[cohortField] === COHORTS.AUTO).length,
      ai_assist: processingTransactions.filter(t => t[cohortField] === COHORTS.AI_ASSIST).length,
      review: processingTransactions.filter(t => t[cohortField] === COHORTS.REVIEW).length,
      conflict: processingTransactions.filter(t => t[cohortField] === COHORTS.CONFLICT).length,
      total: processingTransactions.length
    };
  }, [processingTransactions]);

  /**
   * Get Finn message for current stage
   * Messages now reflect the two-path architecture:
   * - Identifier matches: HIGH confidence, AUTO cohort
   * - No match: AI assistance or user review needed
   */
  const getFinnMessage = useCallback(() => {
    const counts = getCohortCounts(stage.includes('group') ? 'group' : 'category');
    const typeAnomalyCount = processingTransactions.filter(t => t.typeAnomaly).length;
    const incomeCount = processingTransactions.filter(t => t.type === 'income').length;
    const expenseCount = processingTransactions.filter(t => t.type === 'expense').length;

    // Count transactions by match type
    const identifierMatched = processingTransactions.filter(t =>
      t.groupMatchType === 'identifier' || t.groupMatchType === 'type_derived'
    ).length;
    const needsAI = processingTransactions.filter(t =>
      t.groupCohort === COHORTS.AI_ASSIST || t.groupCohort === COHORTS.REVIEW
    ).length;

    const messages = {
      [STAGES.TYPE_SORTING]: `I'm sorting ${processingTransactions.length} transactions by type...`,

      [STAGES.TYPE_REVIEW]: typeAnomalyCount > 0
        ? `I noticed ${typeAnomalyCount} unusual one${typeAnomalyCount > 1 ? 's' : ''} - expenses that look like credits. Usually refunds. Can you clarify?`
        : `I've sorted ${processingTransactions.length} transactions: ${incomeCount} income, ${expenseCount} expenses. All looking good!`,

      [STAGES.GROUP_SORTING]: `Now sorting them into Groups...`,

      [STAGES.GROUP_AI_PROCESSING]: aiProcessing
        ? `Asking Claude to help categorize ${aiProgress.total} uncertain transactions...`
        : `AI analysis complete.`,

      [STAGES.GROUP_REVIEW]: (() => {
        const autoMsg = counts.auto > 0 ? `${counts.auto} matched known patterns.` : '';
        const needsReviewCount = counts.ai_assist + counts.review;
        const reviewMsg = needsReviewCount > 0 ? `${needsReviewCount} need your review.` : '';

        if (needsReviewCount > 0) {
          return `${autoMsg} ${reviewMsg}`.trim();
        }
        return `${autoMsg} All sorted automatically!`;
      })(),

      [STAGES.CATEGORY_SORTING]: `Want to continue to Categories, or pause here?`,

      [STAGES.CATEGORY_AI_PROCESSING]: aiProcessing
        ? `Asking Claude to help with ${aiProgress.total} category assignments...`
        : `AI analysis complete.`,

      [STAGES.CATEGORY_REVIEW]: (() => {
        const catCounts = getCohortCounts('category');
        const catNeedsReview = catCounts.ai_assist + catCounts.review;
        if (catNeedsReview > 0) {
          return `Categories assigned. ${catNeedsReview} need your review.`;
        }
        return `All categorized! Ready to save.`;
      })(),

      [STAGES.COMPLETE]: `All done! Your transactions are categorized and ready.`
    };

    return messages[stage] || '';
  }, [stage, processingTransactions, getCohortCounts, aiProcessing, aiProgress]);

  /**
   * Update a transaction's categorization
   */
  const updateTransaction = useCallback((transactionId, updates) => {
    setProcessingTransactions(prev =>
      prev.map(t => t.id === transactionId ? { ...t, ...updates } : t)
    );
  }, []);

  /**
   * Batch update transactions
   */
  const updateTransactionsBatch = useCallback((updates) => {
    // updates is an array of { id, ...changes }
    setProcessingTransactions(prev => {
      const updateMap = new Map(updates.map(u => [u.id, u]));
      return prev.map(t => {
        const update = updateMap.get(t.id);
        return update ? { ...t, ...update } : t;
      });
    });
  }, []);

  /**
   * Compute similar transaction groups for the current processing transactions
   * This allows "Apply to All Similar" functionality in the UI
   * Returns: Map<transactionId, Set<similarTransactionIds>>
   */
  const similarTransactionGroups = useMemo(() => {
    if (!processingTransactions || processingTransactions.length === 0) {
      return new Map();
    }

    // Only compute groups for transactions in REVIEW or AI_ASSIST cohorts
    // (AUTO transactions are already handled, no need to batch them)
    const reviewTransactions = processingTransactions.filter(t =>
      t.groupCohort === COHORTS.REVIEW || t.groupCohort === COHORTS.AI_ASSIST ||
      t.categoryCohort === COHORTS.REVIEW || t.categoryCohort === COHORTS.AI_ASSIST
    );

    if (reviewTransactions.length < 2) {
      return new Map();
    }

    return findSimilarTransactionGroups(reviewTransactions, 0.80);
  }, [processingTransactions]);

  /**
   * Get similar transactions for a given transaction ID
   * @param {string} transactionId - The transaction to find similar ones for
   * @returns {Array} Array of similar transaction objects
   */
  const getSimilarTransactions = useCallback((transactionId) => {
    const similarIds = similarTransactionGroups.get(transactionId);
    if (!similarIds || similarIds.size === 0) return [];

    return processingTransactions.filter(t => similarIds.has(t.id));
  }, [similarTransactionGroups, processingTransactions]);

  /**
   * Apply the same update to a transaction and all similar transactions
   * @param {string} transactionId - The primary transaction ID
   * @param {Object} updates - The updates to apply (e.g., { group: 'STAFF', groupReviewed: true })
   * @param {boolean} includeSimilar - Whether to include similar transactions (default true)
   * @returns {number} Number of transactions updated
   */
  const updateTransactionAndSimilar = useCallback((transactionId, updates, includeSimilar = true) => {
    const similarIds = includeSimilar ? (similarTransactionGroups.get(transactionId) || new Set()) : new Set();
    const allIdsToUpdate = new Set([transactionId, ...similarIds]);

    console.log(`[ProcessingFlow] Updating transaction ${transactionId} and ${similarIds.size} similar transactions`);

    setProcessingTransactions(prev =>
      prev.map(t => {
        if (allIdsToUpdate.has(t.id)) {
          return {
            ...t,
            ...updates,
            // Mark as batch-applied if not the primary transaction
            ...(t.id !== transactionId && { batchAppliedFrom: transactionId })
          };
        }
        return t;
      })
    );

    return allIdsToUpdate.size;
  }, [similarTransactionGroups]);

  /**
   * Change a transaction AND auto-apply to similar transactions.
   * Skips similar transactions the user has already manually changed (matchType === 'user_selected').
   * Returns undo data so the caller can revert just the similar transactions.
   *
   * @param {string} transactionId - The primary transaction being changed
   * @param {Object} updates - Updates for the primary transaction (e.g., { group: 'STAFF', ... })
   * @param {string} layer - 'group' or 'category'
   * @returns {{ updatedCount: number, previousStates: Array }} Undo info
   */
  const changeWithSimilar = useCallback((transactionId, updates, layer = 'group') => {
    const matchTypeField = layer === 'group' ? 'groupMatchType' : 'categoryMatchType';
    const similarIds = similarTransactionGroups.get(transactionId) || new Set();

    // Collect previous states of eligible similar transactions for undo
    const previousStates = [];

    setProcessingTransactions(prev => {
      // First pass: identify which similar transactions are eligible
      const eligibleSimilarIds = new Set();
      prev.forEach(t => {
        if (similarIds.has(t.id) && t[matchTypeField] !== 'user_selected') {
          eligibleSimilarIds.add(t.id);
          // Save previous state for undo
          previousStates.push({
            id: t.id,
            group: t.group,
            groupReviewed: t.groupReviewed,
            groupMatchType: t.groupMatchType,
            groupCohort: t.groupCohort,
            categoryCode: t.categoryCode,
            categoryName: t.categoryName,
            categoryReviewed: t.categoryReviewed,
            categoryMatchType: t.categoryMatchType,
            categoryCohort: t.categoryCohort,
            category: t.category,
            type: t.type
          });
        }
      });

      if (eligibleSimilarIds.size > 0) {
        console.log(`[ProcessingFlow] Change + Similar: updating ${eligibleSimilarIds.size} similar (skipped ${similarIds.size - eligibleSimilarIds.size} already user-changed)`);
      }

      // Second pass: apply updates
      return prev.map(t => {
        if (t.id === transactionId) {
          return { ...t, ...updates };
        }
        if (eligibleSimilarIds.has(t.id)) {
          return {
            ...t,
            ...updates,
            // Override matchType for similar — they were batch-applied, not directly user-selected
            [matchTypeField]: 'batch_applied',
            batchAppliedFrom: transactionId
          };
        }
        return t;
      });
    });

    return { updatedCount: previousStates.length, previousStates };
  }, [similarTransactionGroups]);

  /**
   * Undo a "change + similar" operation by restoring previous states
   * @param {Array} previousStates - Array of { id, ...previousProps } from changeWithSimilar
   */
  const undoSimilarChange = useCallback((previousStates) => {
    if (!previousStates || previousStates.length === 0) return;

    const stateMap = new Map(previousStates.map(s => [s.id, s]));

    setProcessingTransactions(prev =>
      prev.map(t => {
        const prevState = stateMap.get(t.id);
        if (prevState) {
          return { ...t, ...prevState };
        }
        return t;
      })
    );

    console.log(`[ProcessingFlow] Undid similar change for ${previousStates.length} transactions`);
  }, []);

  /**
   * Accept all auto-categorized transactions for a cohort
   */
  const acceptAutoCategorized = useCallback((layer = 'category') => {
    const reviewField = layer === 'group' ? 'groupReviewed' : 'categoryReviewed';
    const cohortField = layer === 'group' ? 'groupCohort' : 'categoryCohort';

    setProcessingTransactions(prev =>
      prev.map(t => t[cohortField] === COHORTS.AUTO
        ? { ...t, [reviewField]: true }
        : t
      )
    );
  }, []);

  /**
   * Mark AI-assist cohort as reviewed (user skipped detailed review)
   */
  const skipAiAssistReview = useCallback((layer = 'category') => {
    const reviewField = layer === 'group' ? 'groupReviewed' : 'categoryReviewed';
    const cohortField = layer === 'group' ? 'groupCohort' : 'categoryCohort';

    setProcessingTransactions(prev =>
      prev.map(t => t[cohortField] === COHORTS.AI_ASSIST
        ? { ...t, [reviewField]: true }
        : t
      )
    );
  }, []);

  /**
   * Move to next stage
   * Automatically skips intermediate processing stages (SORTING and AI_PROCESSING)
   * If skipCategoryStage is true (onboarding), skips directly to COMPLETE after GROUP_REVIEW
   */
  const nextStage = useCallback(() => {
    // For onboarding: skip category stages entirely after GROUP_REVIEW
    if (aiContext.skipCategoryStage && stage === STAGES.GROUP_REVIEW) {
      console.log('[ProcessingFlow] Skipping category stage (onboarding mode)');
      setStage(STAGES.COMPLETE);
      return;
    }

    // Skip intermediate stages - go directly to REVIEW stages
    // SORTING and AI_PROCESSING are handled automatically, no user interaction needed
    const skipMap = {
      [STAGES.TYPE_REVIEW]: STAGES.GROUP_REVIEW,        // Skip GROUP_SORTING and GROUP_AI_PROCESSING
      [STAGES.GROUP_REVIEW]: STAGES.CATEGORY_REVIEW,    // Skip CATEGORY_SORTING and CATEGORY_AI_PROCESSING
    };

    if (skipMap[stage]) {
      console.log(`[ProcessingFlow] Skipping to ${skipMap[stage]} from ${stage}`);
      setStage(skipMap[stage]);
      return;
    }

    // Fallback to sequential progression for other stages
    const stageOrder = [
      STAGES.IDLE,
      STAGES.TYPE_SORTING,
      STAGES.TYPE_REVIEW,
      STAGES.GROUP_SORTING,
      STAGES.GROUP_AI_PROCESSING,
      STAGES.GROUP_REVIEW,
      STAGES.CATEGORY_SORTING,
      STAGES.CATEGORY_AI_PROCESSING,
      STAGES.CATEGORY_REVIEW,
      STAGES.COMPLETE
    ];

    const currentIndex = stageOrder.indexOf(stage);
    if (currentIndex < stageOrder.length - 1) {
      setStage(stageOrder[currentIndex + 1]);
    }
  }, [stage, aiContext.skipCategoryStage]);

  /**
   * Skip to a specific stage
   */
  const skipToStage = useCallback((targetStage) => {
    setStage(targetStage);
  }, []);

  /**
   * Defer category processing (create task for later)
   */
  const deferCategoryProcessing = useCallback(() => {
    // Mark group processing as complete, skip categories
    setStage(STAGES.COMPLETE);

    // Return info for task creation
    return {
      type: 'category_review',
      transactionCount: processingTransactions.length,
      reviewNeeded: getCohortCounts('category').review + getCohortCounts('category').ai_assist
    };
  }, [processingTransactions.length, getCohortCounts]);

  /**
   * Complete the flow and return processed transactions
   */
  const completeFlow = useCallback(() => {
    const result = {
      transactions: processingTransactions,
      stats
    };

    // Reset state
    setIsFlowOpen(false);
    setStage(STAGES.IDLE);
    setCurrentCohort(null);

    return result;
  }, [processingTransactions, stats]);

  /**
   * Cancel the flow
   */
  const cancelFlow = useCallback(() => {
    cancelRef.current = true;
    setIsFlowOpen(false);
    setStage(STAGES.IDLE);
    setProcessingTransactions([]);
    setStats(null);
    setCurrentCohort(null);
    setError(null);
  }, []);

  /**
   * Get summary for current stage
   */
  const getStageSummary = useCallback(() => {
    if (!stats) return null;

    return {
      total: stats.total,
      income: stats.income,
      expense: stats.expense,
      typeAnomalies: stats.typeAnomalies,
      groupCohorts: {
        auto: stats.groupAuto,
        ai_assist: stats.groupAiAssist,
        review: stats.groupReview,
        conflict: stats.groupConflicts
      },
      categoryCohorts: {
        auto: stats.categoryAuto,
        ai_assist: stats.categoryAiAssist,
        review: stats.categoryReview,
        conflict: stats.categoryConflicts
      }
    };
  }, [stats]);

  const value = {
    // State
    stage,
    isFlowOpen,
    processingTransactions,
    stats,
    error,
    showGuidance,
    currentCohort,

    // AI State
    aiProcessing,
    aiProgress,
    aiError,

    // Onboarding mode flags
    skipCategoryStage: aiContext.skipCategoryStage,

    // Constants
    STAGES,
    COHORTS,
    GROUPS,

    // Actions
    startProcessing,
    nextStage,
    skipToStage,
    updateTransaction,
    updateTransactionsBatch,
    updateTransactionAndSimilar,
    changeWithSimilar,
    undoSimilarChange,
    getSimilarTransactions,
    similarTransactionGroups,
    acceptAutoCategorized,
    skipAiAssistReview,
    deferCategoryProcessing,
    completeFlow,
    cancelFlow,
    setShowGuidance,
    setCurrentCohort,

    // AI Actions
    runAICategorization,
    getAISuggestionForTransaction,

    // AI Learning - callback to record user corrections
    recordCorrection: aiContext.recordCorrection,

    // Helpers
    getTransactionsByCohort,
    getCohortCounts,
    getFinnMessage,
    getStageSummary,

    // Wave info (bulk upload mode)
    waveInfo
  };

  return (
    <ProcessingFlowContext.Provider value={value}>
      {children}
    </ProcessingFlowContext.Provider>
  );
};

export const useProcessingFlow = () => {
  const context = useContext(ProcessingFlowContext);
  if (!context) {
    throw new Error('useProcessingFlow must be used within a ProcessingFlowProvider');
  }
  return context;
};

export const useProcessingFlowSafe = () => {
  return useContext(ProcessingFlowContext);
};

export default ProcessingFlowContext;
