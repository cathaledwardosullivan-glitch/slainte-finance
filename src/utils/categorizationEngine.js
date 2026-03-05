/**
 * Categorization Engine
 *
 * Unified transaction categorization with layered processing:
 * - Layer 1: Type (income/expense) - deterministic from debit/credit
 * - Layer 2: Group (INCOME, STAFF, PREMISES, etc.) - identifier matching with confidence
 * - Layer 3: Category - specific category within group
 *
 * Features:
 * - Unified confidence scoring using Levenshtein distance and LCS
 * - Similar transaction matching with exponential formula: 1 - (avgDiffRatio)^n
 * - 90/10 weighting: similar transactions (90%) + identifiers (10%)
 * - Conflict detection for duplicate/overlapping identifiers
 * - Pattern extraction for learning new identifiers
 */

import {
  levenshteinSimilarity,
  differenceRatio,
  calculateUnifiedConfidence
} from './stringUtils';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Group definitions - each group belongs to a type (income/expense)
 * Categories have a 'section' field that maps to these groups
 */
export const GROUPS = {
  INCOME: { code: 'INCOME', name: 'Income', type: 'income', displayOrder: 1 },
  STAFF: { code: 'STAFF', name: 'Staff Costs', type: 'expense', displayOrder: 2 },
  PREMISES: { code: 'PREMISES', name: 'Premises Costs', type: 'expense', displayOrder: 3 },
  MEDICAL: { code: 'MEDICAL', name: 'Medical Supplies', type: 'expense', displayOrder: 4 },
  OFFICE: { code: 'OFFICE', name: 'Office & IT', type: 'expense', displayOrder: 5 },
  PROFESSIONAL: { code: 'PROFESSIONAL', name: 'Professional Fees', type: 'expense', displayOrder: 6 },
  MOTOR: { code: 'MOTOR', name: 'Motor Expenses', type: 'expense', displayOrder: 7 },
  OTHER: { code: 'OTHER', name: 'Petty Cash / Other', type: 'expense', displayOrder: 8 },
  UNKNOWN: { code: 'UNKNOWN', name: 'Unknown', type: 'expense', displayOrder: 9 },  // No matches found - needs AI/user input
  NON_BUSINESS: { code: 'NON_BUSINESS', name: 'Non-Business', type: 'non-business', displayOrder: 10 }
};

/**
 * Map category section names to group codes
 * IMPORTANT: These must match the actual section values in categoryMappings.js
 */
const SECTION_TO_GROUP = {
  // Income
  'INCOME': 'INCOME',

  // Staff costs - various section names used
  'STAFF COSTS': 'STAFF',
  'DIRECT STAFF COSTS': 'STAFF',

  // Premises
  'PREMISES COSTS': 'PREMISES',

  // Medical
  'MEDICAL SUPPLIES': 'MEDICAL',
  'MEDICAL SUPPLIES & SERVICES': 'MEDICAL',

  // Office & IT
  'OFFICE & IT': 'OFFICE',
  'OFFICE & ADMIN': 'OFFICE',  // Legacy fallback

  // Professional fees - ICGP fix: "PROFESSIONAL DEV" was missing
  'PROFESSIONAL FEES': 'PROFESSIONAL',
  'PROFESSIONAL DEV': 'PROFESSIONAL',
  'PROFESSIONAL FEES & DEVELOPMENT': 'PROFESSIONAL',

  // Motor
  'MOTOR EXPENSES': 'MOTOR',
  'MOTOR & TRANSPORT': 'MOTOR',

  // Other
  'OTHER COSTS': 'OTHER',
  'PETTY CASH / OTHER EXPENSES': 'OTHER',
  'OTHER EXPENSES': 'OTHER',  // Legacy fallback
  'CAPITAL & DEPRECIATION': 'OTHER',

  // Non-business
  'NON-BUSINESS': 'NON_BUSINESS',
  'NON-BUSINESS EXPENDITURE': 'NON_BUSINESS'
};

/**
 * Generic words to exclude from pattern extraction
 */
const GENERIC_WORDS = new Set([
  'PAYMENT', 'FEE', 'CHARGE', 'TRANSFER', 'POS', 'ATM', 'DEBIT', 'CREDIT',
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'LTD', 'LIMITED', 'THE', 'AND', 'FOR', 'FROM', 'TO', 'OF', 'INC', 'CORP',
  'IRELAND', 'DUBLIN', 'CORK', 'GALWAY', 'LIMERICK', 'WATERFORD',
  'BANK', 'DIRECT', 'DEBIT', 'STANDING', 'ORDER', 'TRANSACTION'
]);

/**
 * Confidence thresholds for categorization decisions
 * Note: Comparisons use EPSILON tolerance for floating-point precision
 * (89.99% should count as 90%, not 89%)
 */
export const CONFIDENCE_THRESHOLDS = {
  AUTO_ACCEPT: 0.90,      // ≥90% - auto-accept without review
  AI_ASSIST: 0.50,        // 50-90% - AI assists, flag for optional review
  USER_REVIEW: 0,         // <50% - requires user review
  EPSILON: 0.0001         // Tolerance for floating-point comparisons
};

/**
 * Weights for confidence scoring factors
 */
const CONFIDENCE_WEIGHTS = {
  identifierLength: 0.30,   // Longer identifiers are more specific
  matchCoverage: 0.30,      // How much of the transaction text is covered
  historicalAccuracy: 0.25, // How often this identifier was correct
  uniqueness: 0.15          // Is this identifier unique to one category?
};

// =============================================================================
// TYPE DETECTION (Layer 1)
// =============================================================================

/**
 * Detect transaction type from debit/credit values
 * @param {Object} transaction - Transaction with debit/credit fields
 * @returns {Object} { type, confidence, isAnomaly }
 */
export function detectType(transaction) {
  const { debit, credit } = transaction;

  const hasDebit = debit && debit > 0;
  const hasCredit = credit && credit > 0;

  // Clear cases
  if (hasCredit && !hasDebit) {
    return { type: 'income', confidence: 1.0, isAnomaly: false };
  }

  if (hasDebit && !hasCredit) {
    return { type: 'expense', confidence: 1.0, isAnomaly: false };
  }

  // Ambiguous - both or neither
  if (hasDebit && hasCredit) {
    // Unusual - flag as anomaly
    return {
      type: debit > credit ? 'expense' : 'income',
      confidence: 0.5,
      isAnomaly: true
    };
  }

  // Neither - try to infer from amount
  const amount = transaction.amount || 0;
  if (amount !== 0) {
    return { type: 'expense', confidence: 0.7, isAnomaly: true };
  }

  return { type: 'expense', confidence: 0.5, isAnomaly: true };
}

// =============================================================================
// IDENTIFIER INDEX
// =============================================================================

/**
 * Build an index of all identifiers for fast lookup
 * @param {Array} categoryMapping - Category definitions with identifiers
 * @returns {Map} identifier -> { categoryCode, groupCode, original }
 */
export function buildIdentifierIndex(categoryMapping) {
  const index = new Map();

  categoryMapping.forEach(category => {
    const groupCode = SECTION_TO_GROUP[category.section] || 'OTHER';

    (category.identifiers || []).forEach(identifier => {
      const lowerIdentifier = identifier.toLowerCase();

      if (!index.has(lowerIdentifier)) {
        index.set(lowerIdentifier, []);
      }

      index.get(lowerIdentifier).push({
        categoryCode: category.code,
        categoryName: category.name,
        groupCode,
        original: identifier,
        section: category.section
      });
    });
  });

  return index;
}

/**
 * Build group-level identifier index (union of all category identifiers per group)
 * @param {Array} categoryMapping - Category definitions
 * @returns {Map} groupCode -> Set of identifiers
 */
export function buildGroupIdentifierIndex(categoryMapping) {
  const groupIndex = new Map();

  // Initialize all groups
  Object.keys(GROUPS).forEach(groupCode => {
    groupIndex.set(groupCode, new Set());
  });

  categoryMapping.forEach(category => {
    const groupCode = SECTION_TO_GROUP[category.section] || 'OTHER';
    const groupIdentifiers = groupIndex.get(groupCode);

    (category.identifiers || []).forEach(identifier => {
      groupIdentifiers.add(identifier.toLowerCase());
    });
  });

  return groupIndex;
}

// =============================================================================
// IDENTIFIER MATCHING (Binary - High Confidence)
// =============================================================================

/**
 * CORE PRINCIPLE: Identifier matching is BINARY.
 * If an identifier matches, that's a strong signal - HIGH confidence (95%+).
 * We do NOT apply probability scoring to matched identifiers.
 *
 * Confidence for identifier matches is always high because:
 * - The identifier was explicitly added by the user or learned from their corrections
 * - It represents a known, confirmed pattern
 * - The only reason to reduce confidence is if the same identifier exists in multiple categories (conflict)
 */

/**
 * Check if transaction matches any identifier (binary check)
 * Supports exact substring matching AND prefix matching for bank-truncated names.
 * Banks often truncate transaction details (e.g. "O'SULLIVAN" → "O SULLIV"),
 * so we also match when a word in the details is a prefix of an identifier (min 4 chars).
 *
 * @param {string} details - Transaction details text
 * @param {Map} identifierIndex - From buildIdentifierIndex()
 * @returns {Object|null} { identifier, categories, isConflict } or null if no match
 */
export function findIdentifierMatch(details, identifierIndex) {
  const detailsLower = details.toLowerCase();
  const detailsWords = detailsLower.split(/\s+/).filter(w => w.length >= 4);

  let bestMatch = null;
  let bestLength = 0;
  let bestIsPrefix = false;

  // Find the longest matching identifier (more specific = better)
  identifierIndex.forEach((categories, identifier) => {
    // Path 1: Exact substring match (original behavior)
    if (detailsLower.includes(identifier) && identifier.length > bestLength) {
      bestMatch = {
        identifier,
        original: categories[0].original,
        categories,
        isConflict: categories.length > 1 &&
          new Set(categories.map(c => c.categoryCode)).size > 1
      };
      bestLength = identifier.length;
      bestIsPrefix = false;
    }

    // Path 2: Prefix matching for bank truncation (only single-word identifiers >= 5 chars)
    // A word in the details is a truncated version of an identifier if:
    //   - The identifier is a single word (no spaces) and at least 5 chars
    //   - A details word is at least 4 chars and matches the start of the identifier
    //   - The details word covers at least 60% of the identifier length
    if (!identifier.includes(' ') && identifier.length >= 5) {
      for (const word of detailsWords) {
        if (identifier.startsWith(word) && word.length >= identifier.length * 0.6) {
          const matchScore = word.length; // Use word length as score
          // Only use prefix match if no better exact match exists
          if (matchScore > bestLength || (matchScore === bestLength && bestIsPrefix)) {
            // Don't override an exact match with a prefix match
            if (bestIsPrefix || !bestMatch) {
              bestMatch = {
                identifier,
                original: categories[0].original,
                categories,
                isConflict: categories.length > 1 &&
                  new Set(categories.map(c => c.categoryCode)).size > 1
              };
              bestLength = matchScore;
              bestIsPrefix = true;
            }
          }
        }
      }
    }
  });

  return bestMatch;
}

/**
 * Get confidence for an identifier match
 * Since identifier matching is binary, matched items get HIGH confidence.
 * Only conflicts reduce confidence.
 *
 * @param {Object} match - From findIdentifierMatch()
 * @returns {number} Confidence 0.85-0.98 (always high for matches)
 */
export function getIdentifierMatchConfidence(match) {
  if (!match) return 0;

  // Identifier match = HIGH confidence (95% base)
  let confidence = 0.95;

  // If the same identifier is in multiple different categories, it's a conflict
  // Reduce confidence slightly but still keep it high
  if (match.isConflict) {
    const uniqueCategories = new Set(match.categories.map(c => c.categoryCode)).size;
    confidence = 0.85 - (uniqueCategories - 2) * 0.05; // 85% for 2 categories, less for more
    confidence = Math.max(confidence, 0.70);
  }

  // Small bonus for longer identifiers (more specific)
  const lengthBonus = Math.min(match.identifier.length / 50, 0.03);
  confidence = Math.min(confidence + lengthBonus, 0.98);

  return confidence;
}

// =============================================================================
// PROBABILITY SCORING (For Unmatched Transactions Only)
// =============================================================================

/**
 * Calculate probability score for an UNMATCHED transaction.
 * This is ONLY used when no identifier matches.
 *
 * Scoring factors:
 * - Partial text similarity to existing identifiers
 * - Similarity to already-categorized transactions
 * - Common word patterns
 *
 * @param {string} details - Transaction details text
 * @param {string} groupCode - Target group to score against
 * @param {Map} groupIdentifierIndex - Group identifiers
 * @returns {Object} { probability, reason, partialMatches }
 */
export function calculateUnmatchedProbability(details, groupCode, groupIdentifierIndex) {
  const detailsLower = details.toLowerCase();
  // Filter out generic words from transaction details
  const detailsWords = new Set(
    detailsLower.split(/\s+/).filter(w =>
      w.length >= 3 && !GENERIC_WORDS.has(w.toUpperCase())
    )
  );

  const groupIdentifiers = groupIdentifierIndex.get(groupCode);
  if (!groupIdentifiers || groupIdentifiers.size === 0) {
    return { probability: 0, reason: 'No identifiers in group', partialMatches: [] };
  }

  let bestPartialScore = 0;
  const partialMatches = [];

  groupIdentifiers.forEach(identifier => {
    // Calculate word overlap - filter out generic words from identifiers too
    const identifierWords = new Set(
      identifier.split(/\s+/).filter(w =>
        w.length >= 3 && !GENERIC_WORDS.has(w.toUpperCase())
      )
    );
    const commonWords = [...detailsWords].filter(w => identifierWords.has(w));

    if (commonWords.length > 0) {
      const overlapScore = commonWords.length / Math.max(identifierWords.size, 1);

      partialMatches.push({
        identifier,
        commonWords,
        score: overlapScore
      });

      if (overlapScore > bestPartialScore) {
        bestPartialScore = overlapScore;
      }
    }

    // Also check for substring matches (partial identifier match)
    const partialIdentifier = identifier.substring(0, Math.floor(identifier.length * 0.7));
    if (partialIdentifier.length >= 3 && detailsLower.includes(partialIdentifier)) {
      const substringScore = 0.6;
      if (substringScore > bestPartialScore) {
        bestPartialScore = substringScore;
        partialMatches.push({
          identifier,
          commonWords: [partialIdentifier], // Show what actually matched
          score: substringScore
        });
      }
    }
  });

  // Sort partial matches by score
  partialMatches.sort((a, b) => b.score - a.score);

  // Convert to probability (0-1 scale, capped at 0.70 since it's not a confirmed match)
  const probability = Math.min(bestPartialScore * 0.8, 0.70);

  return {
    probability,
    reason: partialMatches.length > 0
      ? `Partial match: ${partialMatches[0].commonWords.join(', ')}`
      : 'No partial matches found',
    partialMatches: partialMatches.slice(0, 3) // Top 3
  };
}

// =============================================================================
// SIMILAR TRANSACTION MATCHING
// =============================================================================

/**
 * Strip generic banking prefixes and date patterns from transaction details
 * These patterns appear in many unrelated transactions and cause false similarity matches:
 * - POS##MON (e.g., POS12OCT, POS05JAN)
 * - Date patterns at start
 * - Generic banking terms
 * - Common words like "THE" at the start
 *
 * @param {string} details - Raw transaction details
 * @returns {string} Cleaned details for similarity comparison
 */
function cleanDetailsForSimilarity(details) {
  if (!details) return '';

  let cleaned = details.toUpperCase();

  // Remove POS##MON patterns (e.g., POS12OCT, POS05JAN)
  cleaned = cleaned.replace(/^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi, '');

  // Remove standalone date patterns at start (e.g., "12 OCT", "05JAN")
  cleaned = cleaned.replace(/^\d{1,2}\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi, '');

  // Remove common banking prefixes
  cleaned = cleaned.replace(/^(SEPA\s*DD|SEPA\s*CT|DD\s*|SO\s*|TRF\s*|FPI\s*|BGC\s*|CHQ\s*)/gi, '');

  // Remove common starting words that cause false matches (THE MIDLANDS vs THE MEDICAL)
  cleaned = cleaned.replace(/^(THE|A|AN)\s+/gi, '');

  // Remove reference numbers at end (common patterns like "REF123456")
  cleaned = cleaned.replace(/\s*REF\s*[\dA-Z]+$/gi, '');

  return cleaned.trim();
}

/**
 * Extract significant words from transaction details for comparison
 * @param {string} details - Transaction details
 * @returns {Set} Set of significant words
 */
function extractSignificantWords(details) {
  if (!details) return new Set();

  const words = details.toUpperCase().split(/\s+/).filter(word => {
    return word.length >= 3 && !GENERIC_WORDS.has(word);
  });

  return new Set(words);
}

/**
 * Calculate character-level similarity using Levenshtein distance
 * IMPORTANT: Cleans transaction details first to remove generic banking patterns
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {Object} { similarity, diffRatio, commonWords, cleanedStr1, cleanedStr2 }
 */
function calculateCharacterSimilarity(str1, str2) {
  if (!str1 || !str2) {
    return { similarity: 0, diffRatio: 1, commonWords: [], cleanedStr1: '', cleanedStr2: '' };
  }

  // Clean both strings before comparison - removes POS##MON and other generic patterns
  const cleanedStr1 = cleanDetailsForSimilarity(str1);
  const cleanedStr2 = cleanDetailsForSimilarity(str2);

  // If cleaned strings are too short, they're probably just generic patterns
  if (cleanedStr1.length < 4 || cleanedStr2.length < 4) {
    return { similarity: 0, diffRatio: 1, commonWords: [], cleanedStr1, cleanedStr2 };
  }

  // Use Levenshtein-based similarity on CLEANED strings
  const similarity = levenshteinSimilarity(cleanedStr1, cleanedStr2);
  const diffRatio = differenceRatio(cleanedStr1, cleanedStr2);

  // Extract common words for debug display (from cleaned strings)
  const words1 = new Set(cleanedStr1.split(/\s+/).filter(w => w.length >= 3 && !GENERIC_WORDS.has(w)));
  const words2 = new Set(cleanedStr2.split(/\s+/).filter(w => w.length >= 3 && !GENERIC_WORDS.has(w)));
  const commonWords = [...words1].filter(w => words2.has(w));

  return { similarity, diffRatio, commonWords, cleanedStr1, cleanedStr2 };
}

/**
 * Find similar already-categorized transactions using Levenshtein distance
 * Used for the unified confidence formula: 1 - (avgDiffRatio)^n
 *
 * @param {Object} newTransaction - The unmatched transaction
 * @param {Array} existingTransactions - Already categorized transactions
 * @param {number} minSimilarity - Minimum similarity threshold (default 0.5, filters out diff > 0.5)
 * @param {boolean} verbose - Enable detailed logging for debugging
 * @returns {Array} Array of { transaction, similarity, diffRatio, commonWords, category }
 */
export function findSimilarCategorizedTransactions(newTransaction, existingTransactions, minSimilarity = 0.5, verbose = false) {
  const newDetails = newTransaction.details || '';
  if (!newDetails || newDetails.trim().length === 0) {
    if (verbose) console.log(`[Similar Match Debug] No details to match: "${newDetails}"`);
    return [];
  }

  if (verbose) {
    console.log(`[Similar Match Debug] Transaction: "${newDetails.substring(0, 50)}"`);
  }

  const similarities = [];
  let checkedCount = 0;
  let matchCount = 0;

  for (const existing of existingTransactions) {
    // Skip uncategorized transactions (must have at least a group or category)
    // Note: During onboarding, transactions may only have group assigned (no category)
    const hasGroup = existing.group || existing.groupCode;
    const hasCategory = existing.category || existing.categoryCode;
    if (!hasGroup && !hasCategory) continue;

    const existingDetails = existing.details || '';
    if (!existingDetails || existingDetails.trim().length === 0) continue;

    checkedCount++;

    // Calculate character-level similarity using Levenshtein distance
    const { similarity, diffRatio, commonWords } = calculateCharacterSimilarity(newDetails, existingDetails);

    if (similarity >= minSimilarity) {
      matchCount++;
      similarities.push({
        transaction: existing,
        details: existingDetails,  // Include for debug display
        similarity,
        diffRatio,  // Key for exponential formula: 1 - (avgDiffRatio)^n
        commonWords,
        category: existing.category,
        categoryCode: existing.categoryCode || existing.category?.code,
        group: existing.group
      });

      // Log the first few high-quality matches
      if (verbose && matchCount <= 3) {
        console.log(`[Similar Match Debug] Match #${matchCount}: "${existingDetails.substring(0, 40)}..."`);
        console.log(`  Levenshtein similarity: ${Math.round(similarity * 100)}%`);
        console.log(`  Diff ratio: ${diffRatio.toFixed(4)} (${Math.round(diffRatio * existingDetails.length)} chars different)`);
        console.log(`  Group: ${existing.group}, Category: ${existing.categoryCode || existing.category?.code}`);
      }
    }
  }

  if (verbose) {
    console.log(`[Similar Match Debug] Checked ${checkedCount} existing transactions, found ${matchCount} matches`);
  }

  // Sort by similarity descending (lowest diffRatio first)
  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, 10); // Return top 10
}

/**
 * Get category suggestion from similar transactions using unified confidence formula
 *
 * NEW FORMULA (no artificial cap):
 * - Similar Transactions Score: 1 - (avgDiffRatio)^n where n = count
 * - Combined with identifier score (handled in categorizeTransactionBatch)
 *
 * @param {Array} similarTransactions - From findSimilarCategorizedTransactions()
 * @returns {Object} { suggestedCategory, probability, evidence, alternatives, calculation }
 */
export function getSuggestionFromSimilarTransactions(similarTransactions) {
  if (!similarTransactions || similarTransactions.length === 0) {
    return {
      suggestedCategory: null,
      suggestedGroup: null,
      probability: 0,
      evidence: [],
      alternatives: [],
      calculation: null
    };
  }

  // Group by category code
  const categoryVotes = new Map();
  const groupVotes = new Map();

  for (const sim of similarTransactions) {
    const catCode = sim.categoryCode;
    const groupCode = sim.group;

    if (catCode) {
      if (!categoryVotes.has(catCode)) {
        categoryVotes.set(catCode, {
          categoryCode: catCode,
          category: sim.category,
          group: groupCode,
          matches: [],  // Store all matches for unified calculation
          count: 0
        });
      }
      const entry = categoryVotes.get(catCode);
      entry.matches.push({
        details: sim.details || sim.transaction?.details,
        similarity: sim.similarity,
        diffRatio: sim.diffRatio
      });
      entry.count++;
    }

    if (groupCode) {
      if (!groupVotes.has(groupCode)) {
        groupVotes.set(groupCode, {
          groupCode,
          matches: [],
          count: 0
        });
      }
      const entry = groupVotes.get(groupCode);
      entry.matches.push({
        details: sim.details || sim.transaction?.details,
        similarity: sim.similarity,
        diffRatio: sim.diffRatio
      });
      entry.count++;
    }
  }

  // Calculate unified confidence for each category using exponential formula
  // Formula: 1 - (avgDiffRatio)^n where n = number of similar transactions
  const calculateExponentialConfidence = (matches) => {
    if (matches.length === 0) return { confidence: 0, avgDiffRatio: 1, formula: 'No matches' };

    const avgDiffRatio = matches.reduce((sum, m) => sum + (m.diffRatio || 0), 0) / matches.length;
    const n = matches.length;

    // Exponential formula: 1 - (avgDiffRatio)^n
    // More matches + lower diff ratio = higher confidence
    const confidence = 1 - Math.pow(avgDiffRatio, n);

    return {
      confidence,
      avgDiffRatio,
      count: n,
      formula: `1 - (${avgDiffRatio.toFixed(4)})^${n} = ${confidence.toFixed(4)}`
    };
  };

  // Calculate confidence for each category
  const scoredCategories = Array.from(categoryVotes.values()).map(entry => {
    const calc = calculateExponentialConfidence(entry.matches);
    return {
      ...entry,
      confidence: calc.confidence,
      calculation: calc,
      evidence: entry.matches.slice(0, 3).map(m => ({
        details: m.details,
        similarity: Math.round(m.similarity * 100),
        diffRatio: m.diffRatio
      }))
    };
  });

  // Sort by confidence descending
  scoredCategories.sort((a, b) => b.confidence - a.confidence);

  // Calculate confidence for best group
  const scoredGroups = Array.from(groupVotes.values()).map(entry => {
    const calc = calculateExponentialConfidence(entry.matches);
    return { ...entry, confidence: calc.confidence, calculation: calc };
  });
  scoredGroups.sort((a, b) => b.confidence - a.confidence);

  if (scoredCategories.length === 0) {
    const bestGroup = scoredGroups[0];
    return {
      suggestedCategory: null,
      suggestedGroup: bestGroup?.groupCode || null,
      probability: bestGroup?.confidence || 0,
      evidence: [],
      alternatives: [],
      calculation: bestGroup?.calculation || null
    };
  }

  const best = scoredCategories[0];

  return {
    suggestedCategory: best.category,
    suggestedCategoryCode: best.categoryCode,
    suggestedGroup: best.group || scoredGroups[0]?.groupCode || null,
    probability: best.confidence,  // NO CAP - let evidence speak for itself
    evidence: best.evidence,
    alternatives: scoredCategories.slice(1, 4).map(c => ({
      categoryCode: c.categoryCode,
      category: c.category,
      probability: c.confidence
    })),
    calculation: best.calculation  // Include for debug panel
  };
}

// =============================================================================
// GROUP MATCHING (Layer 2) - Binary Identifier + Probability for Unmatched
// =============================================================================

/**
 * Match transaction to a group using the two-path approach:
 *
 * PATH A: Identifier Match (Binary)
 *   - If ANY identifier matches -> HIGH confidence (95%+)
 *   - Identifier match is definitive
 *
 * PATH B: No Identifier Match -> Calculate Probability
 *   - Use partial matching and similarity scoring
 *   - Return lower confidence for AI/user review
 *
 * @param {string} details - Transaction details text
 * @param {Map} groupIdentifierIndex - From buildGroupIdentifierIndex()
 * @param {Map} identifierIndex - From buildIdentifierIndex()
 * @returns {Object} { groupCode, confidence, matchedIdentifier, matchType, conflicts }
 */
export function matchGroup(details, groupIdentifierIndex, identifierIndex) {
  const detailsLower = details.toLowerCase();

  // ==========================================================================
  // PATH A: Binary Identifier Matching
  // ==========================================================================

  // First, check for exact identifier matches (binary check)
  const identifierMatch = findIdentifierMatch(details, identifierIndex);

  if (identifierMatch) {
    // We have a match! Get the group(s) this identifier belongs to
    const groupCodes = new Set(identifierMatch.categories.map(c => c.groupCode));

    // If identifier maps to exactly one group, HIGH confidence
    if (groupCodes.size === 1) {
      const groupCode = [...groupCodes][0];
      return {
        groupCode,
        confidence: getIdentifierMatchConfidence(identifierMatch),
        matchedIdentifier: identifierMatch.original,
        matchType: 'identifier',
        conflicts: [],
        allMatches: [{
          groupCode,
          confidence: getIdentifierMatchConfidence(identifierMatch),
          matchedIdentifier: identifierMatch.original
        }]
      };
    }

    // Identifier maps to multiple groups - it's a conflict
    // Still high confidence, but flagged as conflict
    const groupMatches = [...groupCodes].map(gc => ({
      groupCode: gc,
      confidence: 0.85, // Lower due to conflict
      matchedIdentifier: identifierMatch.original
    }));

    return {
      groupCode: groupMatches[0].groupCode, // Take first, but flag conflict
      confidence: 0.85,
      matchedIdentifier: identifierMatch.original,
      matchType: 'identifier_conflict',
      conflicts: groupMatches,
      allMatches: groupMatches
    };
  }

  // ==========================================================================
  // PATH B: No Identifier Match -> Probability Scoring
  // ==========================================================================

  // No identifier match - calculate probability for each group
  const probabilityResults = [];

  groupIdentifierIndex.forEach((identifiers, groupCode) => {
    if (groupCode === 'INCOME') return; // Income is determined by type, not identifiers

    const result = calculateUnmatchedProbability(details, groupCode, groupIdentifierIndex);

    if (result.probability > 0) {
      probabilityResults.push({
        groupCode,
        confidence: result.probability,
        matchedIdentifier: null,
        matchType: 'probability',
        reason: result.reason,
        partialMatches: result.partialMatches
      });
    }
  });

  // Sort by probability descending
  probabilityResults.sort((a, b) => b.confidence - a.confidence);

  if (probabilityResults.length === 0) {
    return {
      groupCode: null,
      confidence: 0,
      matchedIdentifier: null,
      matchType: 'none',
      conflicts: [],
      allMatches: []
    };
  }

  return {
    groupCode: probabilityResults[0].groupCode,
    confidence: probabilityResults[0].confidence,
    matchedIdentifier: null,
    matchType: 'probability',
    reason: probabilityResults[0].reason,
    conflicts: [],
    allMatches: probabilityResults
  };
}

// =============================================================================
// CATEGORY MATCHING (Layer 3) - Binary Identifier + Probability for Unmatched
// =============================================================================

/**
 * Match transaction to specific category within a group using two-path approach:
 *
 * PATH A: Identifier Match (Binary)
 *   - If ANY category identifier matches -> HIGH confidence (95%+)
 *
 * PATH B: No Identifier Match -> Calculate Probability
 *   - Use partial matching within the group's categories
 *   - Return lower confidence for AI/user review
 *
 * @param {string} details - Transaction details text
 * @param {string} groupCode - Group to search within
 * @param {Array} categoryMapping - Full category definitions
 * @param {Map} identifierIndex - From buildIdentifierIndex()
 * @returns {Object} { categoryCode, confidence, matchedIdentifier, matchType, conflicts }
 */
export function matchCategory(details, groupCode, categoryMapping, identifierIndex) {
  const detailsLower = details.toLowerCase();

  // Get categories in this group
  const groupCategories = categoryMapping.filter(cat => {
    const catGroup = SECTION_TO_GROUP[cat.section] || 'OTHER';
    return catGroup === groupCode;
  });

  // ==========================================================================
  // PATH A: Binary Identifier Matching
  // ==========================================================================

  const identifierMatches = [];

  groupCategories.forEach(category => {
    let bestMatch = null;
    let bestLength = 0;

    (category.identifiers || []).forEach(identifier => {
      const identifierLower = identifier.toLowerCase();

      if (detailsLower.includes(identifierLower) && identifier.length > bestLength) {
        bestMatch = {
          identifier: identifierLower,
          original: identifier,
          categoryCode: category.code,
          categoryName: category.name
        };
        bestLength = identifier.length;
      }
    });

    if (bestMatch) {
      identifierMatches.push(bestMatch);
    }
  });

  // If we have identifier matches, use the one with the longest identifier (most specific)
  if (identifierMatches.length > 0) {
    identifierMatches.sort((a, b) => b.identifier.length - a.identifier.length);

    const bestMatch = identifierMatches[0];

    // Check for conflicts (multiple categories matched by different identifiers)
    const uniqueCategories = new Set(identifierMatches.map(m => m.categoryCode));
    const hasConflict = uniqueCategories.size > 1;

    // HIGH confidence for identifier match (95% base)
    let confidence = 0.95;

    // Small bonus for longer identifiers
    confidence += Math.min(bestMatch.identifier.length / 100, 0.03);

    // Reduce slightly if there are conflicts
    if (hasConflict) {
      confidence = 0.85;
    }

    return {
      categoryCode: bestMatch.categoryCode,
      categoryName: bestMatch.categoryName,
      confidence: Math.min(confidence, 0.98),
      matchedIdentifier: bestMatch.original,
      matchType: hasConflict ? 'identifier_conflict' : 'identifier',
      conflicts: hasConflict ? identifierMatches.map(m => ({
        categoryCode: m.categoryCode,
        categoryName: m.categoryName,
        matchedIdentifier: m.original
      })) : [],
      allMatches: identifierMatches.map(m => ({
        categoryCode: m.categoryCode,
        categoryName: m.categoryName,
        confidence: 0.95,
        matchedIdentifier: m.original
      }))
    };
  }

  // ==========================================================================
  // PATH B: No Identifier Match -> Probability Scoring
  // ==========================================================================

  // No identifier match - check for partial matches
  const probabilityResults = [];

  groupCategories.forEach(category => {
    const categoryIdentifiers = new Map();
    (category.identifiers || []).forEach(id => {
      categoryIdentifiers.set(id.toLowerCase(), id);
    });

    // Build a mini index for this category
    const miniGroupIndex = new Map();
    miniGroupIndex.set(category.code, new Set(Array.from(categoryIdentifiers.keys())));

    // Calculate probability based on partial matching
    let probability = 0;
    let reason = '';
    const partialMatches = [];

    categoryIdentifiers.forEach((original, identifierLower) => {
      // Check for word overlap - filter out generic words
      const identifierWords = new Set(
        identifierLower.split(/\s+/).filter(w =>
          w.length >= 3 && !GENERIC_WORDS.has(w.toUpperCase())
        )
      );
      const detailsWords = new Set(
        detailsLower.split(/\s+/).filter(w =>
          w.length >= 3 && !GENERIC_WORDS.has(w.toUpperCase())
        )
      );

      const commonWords = [...detailsWords].filter(w => identifierWords.has(w));

      if (commonWords.length > 0) {
        const overlap = commonWords.length / Math.max(identifierWords.size, 1);
        if (overlap > probability) {
          probability = overlap * 0.6; // Scale down since it's not exact match
          reason = `Partial match: ${commonWords.join(', ')}`;
          partialMatches.push({ identifier: original, commonWords });
        }
      }
    });

    if (probability > 0) {
      probabilityResults.push({
        categoryCode: category.code,
        categoryName: category.name,
        confidence: Math.min(probability, 0.60), // Cap at 60% for partial matches
        matchedIdentifier: null,
        matchType: 'probability',
        reason,
        partialMatches
      });
    }
  });

  probabilityResults.sort((a, b) => b.confidence - a.confidence);

  // If no matches at all, return parent category with zero confidence
  if (probabilityResults.length === 0) {
    const parentCategory = groupCategories.find(c => c.code.endsWith('.0'));
    return {
      categoryCode: parentCategory?.code || null,
      categoryName: parentCategory?.name || null,
      confidence: 0,
      matchedIdentifier: null,
      matchType: 'none',
      conflicts: [],
      allMatches: []
    };
  }

  return {
    categoryCode: probabilityResults[0].categoryCode,
    categoryName: probabilityResults[0].categoryName,
    confidence: probabilityResults[0].confidence,
    matchedIdentifier: null,
    matchType: 'probability',
    reason: probabilityResults[0].reason,
    conflicts: [],
    allMatches: probabilityResults
  };
}

// =============================================================================
// FULL CATEGORIZATION PIPELINE
// =============================================================================

/**
 * Categorize a transaction through all layers using the two-path approach:
 *
 * For each layer (Group, Category):
 *   - PATH A: Identifier match (binary) → HIGH confidence (95%+) → AUTO cohort
 *   - PATH B: No match → Probability scoring → AI_ASSIST or REVIEW cohort
 *
 * @param {Object} transaction - Transaction object with details, debit, credit
 * @param {Array} categoryMapping - Category definitions
 * @param {Object} indexes - { identifierIndex, groupIdentifierIndex } - optional, will build if not provided
 * @returns {Object} Full categorization result with confidence at each layer
 */
export function categorizeTransaction(transaction, categoryMapping, indexes = null) {
  // Build indexes if not provided
  const identifierIndex = indexes?.identifierIndex || buildIdentifierIndex(categoryMapping);
  const groupIdentifierIndex = indexes?.groupIdentifierIndex || buildGroupIdentifierIndex(categoryMapping);

  const details = transaction.details || '';

  // Layer 1: Type detection (deterministic from debit/credit)
  const typeResult = detectType(transaction);

  // Layer 2: Group matching
  // Income transactions belong to INCOME group (determined by type)
  // Expense transactions need identifier matching
  let groupResult;

  if (typeResult.type === 'income') {
    // Income group is determined by TYPE, not identifiers
    groupResult = {
      groupCode: 'INCOME',
      confidence: 0.98, // Very high confidence - credit = income
      matchedIdentifier: null,
      matchType: 'type_derived', // Special: derived from type, not identifier
      conflicts: [],
      allMatches: []
    };
  } else {
    // Expense transactions: Use two-path matching
    groupResult = matchGroup(details, groupIdentifierIndex, identifierIndex);

    // If no group match for expense, default to UNKNOWN (not OTHER)
    // UNKNOWN means "system couldn't determine" - distinct from OTHER which is "legitimate miscellaneous"
    // AI can override UNKNOWN even with low confidence since any suggestion is better than nothing
    if (!groupResult.groupCode) {
      groupResult = {
        groupCode: 'UNKNOWN',
        confidence: 0, // Zero confidence - needs AI/user input
        matchedIdentifier: null,
        matchType: 'none',
        conflicts: [],
        allMatches: []
      };
    }
  }

  // Layer 3: Category matching (within the matched group)
  let categoryResult;

  if (groupResult.groupCode) {
    categoryResult = matchCategory(details, groupResult.groupCode, categoryMapping, identifierIndex);
  } else {
    categoryResult = {
      categoryCode: null,
      categoryName: null,
      confidence: 0,
      matchedIdentifier: null,
      matchType: 'none',
      conflicts: [],
      allMatches: []
    };
  }

  // ==========================================================================
  // COHORT ASSIGNMENT
  // ==========================================================================
  //
  // Key principle: Cohort depends on MATCH TYPE, not just confidence score
  //
  // - Identifier match (matchType: 'identifier') → AUTO (even if confidence < 90%)
  // - Identifier conflict → CONFLICT
  // - Probability match (matchType: 'probability') → AI_ASSIST (needs AI verification)
  // - No match (matchType: 'none') → REVIEW (user must decide)

  let groupCohort, categoryCohort;

  // Group cohort assignment
  if (groupResult.matchType === 'identifier_conflict' || groupResult.conflicts?.length > 0) {
    groupCohort = 'conflict';
  } else if (groupResult.matchType === 'identifier' || groupResult.matchType === 'type_derived') {
    // Identifier match = AUTO (high confidence, definitive)
    groupCohort = 'auto';
  } else if (groupResult.matchType === 'probability' && groupResult.confidence >= 0.40) {
    // Probability match with decent score = AI_ASSIST (AI should verify)
    groupCohort = 'ai_assist';
  } else {
    // No match or very low probability = REVIEW (user must decide)
    groupCohort = 'review';
  }

  // Category cohort assignment
  if (categoryResult.matchType === 'identifier_conflict' || categoryResult.conflicts?.length > 0) {
    categoryCohort = 'conflict';
  } else if (categoryResult.matchType === 'identifier') {
    // Identifier match = AUTO
    categoryCohort = 'auto';
  } else if (categoryResult.matchType === 'probability' && categoryResult.confidence >= 0.35) {
    // Probability match = AI_ASSIST
    categoryCohort = 'ai_assist';
  } else {
    // No match = REVIEW
    categoryCohort = 'review';
  }

  return {
    // Layer 1
    type: typeResult.type,
    typeConfidence: typeResult.confidence,
    typeAnomaly: typeResult.isAnomaly,

    // Layer 2
    group: groupResult.groupCode,
    groupConfidence: groupResult.confidence,
    groupMatchedIdentifier: groupResult.matchedIdentifier,
    groupMatchType: groupResult.matchType,
    groupReason: groupResult.reason || null,
    groupConflicts: groupResult.conflicts,
    groupCohort,

    // Layer 3
    categoryCode: categoryResult.categoryCode,
    categoryName: categoryResult.categoryName,
    categoryConfidence: categoryResult.confidence,
    categoryMatchedIdentifier: categoryResult.matchedIdentifier,
    categoryMatchType: categoryResult.matchType,
    categoryReason: categoryResult.reason || null,
    categoryConflicts: categoryResult.conflicts,
    categoryCohort,

    // For compatibility with existing system
    category: categoryResult.categoryCode
      ? categoryMapping.find(c => c.code === categoryResult.categoryCode)
      : null
  };
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Categorize multiple transactions efficiently
 * @param {Array} transactions - Array of transaction objects
 * @param {Array} categoryMapping - Category definitions
 * @param {Array} existingTransactions - Optional: Already categorized transactions for similarity matching
 * @param {Object} options - Optional configuration
 * @param {number} options.existingTransactionsCount - Override count for adaptive weighting (useful for wave processing)
 * @returns {Object} { results, stats }
 */
export function categorizeTransactionBatch(transactions, categoryMapping, existingTransactions = [], options = {}) {
  // Build indexes once
  const identifierIndex = buildIdentifierIndex(categoryMapping);
  const groupIdentifierIndex = buildGroupIdentifierIndex(categoryMapping);
  const indexes = { identifierIndex, groupIdentifierIndex };

  // Log identifier index for debugging staff matching
  console.log(`[Categorization] Built identifier index with ${identifierIndex.size} unique identifiers`);
  const staffIdentifiers = Array.from(identifierIndex.entries())
    .filter(([id, cats]) => cats.some(c => ['3', '4', '5', '6', '7', '90'].includes(c.categoryCode?.split('.')[0])));
  if (staffIdentifiers.length > 0) {
    // Group by category for cleaner logging
    const byCategory = {};
    staffIdentifiers.forEach(([id, cats]) => {
      const catCode = cats[0]?.categoryCode;
      if (!byCategory[catCode]) byCategory[catCode] = [];
      byCategory[catCode].push(id);
    });
    console.log(`[Categorization] Staff/Partner identifiers (${staffIdentifiers.length} total):`,
      Object.entries(byCategory).map(([code, ids]) => ({
        category: code,
        identifiers: ids
      }))
    );
  } else {
    console.warn('[Categorization] WARNING: No staff/partner identifiers found in index!');
  }

  // First pass: Run identifier-based categorization
  let results = transactions.map(transaction => ({
    ...transaction,
    ...categorizeTransaction(transaction, categoryMapping, indexes)
  }));

  // Second pass: Apply unified confidence scoring ONLY for transactions WITHOUT identifier matches
  // KEY PRINCIPLE: Identifier matches are definitive - don't muddy with similar transaction matching
  // Similar transaction matching is for discovering patterns when no identifier exists
  if (existingTransactions && existingTransactions.length > 0) {
    console.log(`[Categorization] Applying unified confidence scoring against ${existingTransactions.length} existing transactions`);

    let verboseLogCount = 0;

    results = results.map(result => {
      const enableVerbose = verboseLogCount < 3;
      let updatedResult = { ...result };

      // Check if this transaction has an identifier match
      const hasIdentifierMatch = result.groupMatchType === 'identifier' || result.categoryMatchType === 'identifier';

      // =====================================================================
      // IDENTIFIER MATCHES: Use identifier confidence directly - NO similar matching
      // =====================================================================
      if (hasIdentifierMatch) {
        const identifierConfidence = result.groupConfidence || result.categoryConfidence || 0.95;
        const matchedIdentifier = result.groupMatchedIdentifier || result.categoryMatchedIdentifier || '';

        updatedResult = {
          ...updatedResult,
          unifiedConfidence: identifierConfidence,
          unifiedCohort: identifierConfidence >= CONFIDENCE_THRESHOLDS.AUTO_ACCEPT - CONFIDENCE_THRESHOLDS.EPSILON ? 'auto' : 'ai_assist',
          calculationDetails: {
            similar: {
              matches: [],
              avgDiffRatio: 0,
              count: 0,
              formula: 'Skipped - identifier match found',
              score: 0
            },
            identifier: {
              bestMatch: matchedIdentifier,
              matchedChars: matchedIdentifier.length,
              totalChars: matchedIdentifier.length,
              matchType: 'exact',
              score: 1.0  // 100% for exact identifier match
            },
            weights: { similar: 0, identifier: 1.0 },  // Identifier-only
            formula: `Identifier match: "${matchedIdentifier}"`,
            final: identifierConfidence
          }
        };

        if (enableVerbose) {
          verboseLogCount++;
          console.log(`[Identifier Match] "${result.details?.substring(0, 40)}..." → ${matchedIdentifier} (${Math.round(identifierConfidence * 100)}%)`);
        }

        return updatedResult;
      }

      // =====================================================================
      // NO IDENTIFIER MATCH: Use similar transaction matching
      // =====================================================================

      // Find similar categorized transactions (threshold 0.5 filters out poor matches)
      const similarTransactions = findSimilarCategorizedTransactions(
        result,
        existingTransactions,
        0.5,
        enableVerbose
      );

      // CRITICAL FIX: Get suggestion from similar transactions FIRST
      // This determines the TARGET GROUP before we look at identifiers
      const suggestion = getSuggestionFromSimilarTransactions(similarTransactions);
      const hasSimilarMatches = similarTransactions.length > 0;

      // Get identifiers ONLY from the suggested group (not from any matching identifier)
      // This prevents mixing confidence from different groups (e.g., "toners" in OTHER
      // should not contribute to confidence when similar transactions suggest PROFESSIONAL)
      const targetGroup = suggestion.suggestedGroup || result.group;
      const groupIdentifiers = targetGroup
        ? Array.from(groupIdentifierIndex.get(targetGroup) || [])
        : [];

      // Calculate unified confidence using ONLY same-group identifiers
      // Pass existingTransactionsCount for adaptive weighting during first-time uploads
      const existingCount = options.existingTransactionsCount ?? existingTransactions.length;
      const unifiedResult = calculateUnifiedConfidence(
        result.details || '',
        similarTransactions.map(s => ({
          details: s.details || s.transaction?.details,
          group: s.group,
          categoryCode: s.categoryCode
        })),
        groupIdentifiers,
        { existingTransactionsCount: existingCount }
      );

      if (enableVerbose && (hasSimilarMatches || unifiedResult.confidence > 0)) {
        verboseLogCount++;
        console.log(`[Unified Confidence] "${result.details?.substring(0, 40)}...":`);
        console.log(`  Similar transactions: ${similarTransactions.length}`);
        console.log(`  Similar score: ${(unifiedResult.calculation.similar.score * 100).toFixed(1)}% (${unifiedResult.calculation.similar.formula || 'N/A'})`);
        console.log(`  Identifier score: ${(unifiedResult.calculation.identifier.score * 100).toFixed(1)}%`);
        console.log(`  Combined: ${(unifiedResult.confidence * 100).toFixed(1)}% → ${unifiedResult.cohort.toUpperCase()}`);
      }

      // Use similar transaction suggestion if available
      if (hasSimilarMatches && suggestion.probability > 0) {
        const combinedConfidence = unifiedResult.confidence;

        // Determine cohort based on unified confidence (with epsilon for floating-point precision)
        const cohort = combinedConfidence >= CONFIDENCE_THRESHOLDS.AUTO_ACCEPT - CONFIDENCE_THRESHOLDS.EPSILON ? 'auto' :
                       combinedConfidence >= CONFIDENCE_THRESHOLDS.AI_ASSIST - CONFIDENCE_THRESHOLDS.EPSILON ? 'ai_assist' : 'review';

        // Update GROUP
        if (suggestion.suggestedGroup && (!result.group || result.groupCohort === 'review')) {
          updatedResult = {
            ...updatedResult,
            group: suggestion.suggestedGroup,
            groupConfidence: combinedConfidence,
            groupMatchType: 'unified_confidence',
            groupReason: `Similar: ${(unifiedResult.calculation.similar.score * 100).toFixed(0)}%`,
            groupCohort: cohort
          };
        }

        // Update CATEGORY
        if (suggestion.suggestedCategoryCode && (!result.categoryCode || result.categoryCohort === 'review')) {
          const category = categoryMapping.find(c => c.code === suggestion.suggestedCategoryCode);
          updatedResult = {
            ...updatedResult,
            categoryCode: suggestion.suggestedCategoryCode,
            categoryName: category?.name || null,
            categoryConfidence: combinedConfidence,
            categoryMatchType: 'unified_confidence',
            categoryReason: `Similar: ${(unifiedResult.calculation.similar.score * 100).toFixed(0)}%`,
            categoryCohort: cohort,
            category: category || null
          };
        }

        // Add unified confidence details
        updatedResult.unifiedConfidence = combinedConfidence;
        updatedResult.unifiedCohort = unifiedResult.cohort;
        updatedResult.calculationDetails = unifiedResult.calculation;
        updatedResult.similarTransactionMatch = {
          group: suggestion.suggestedGroup,
          category: suggestion.suggestedCategoryCode,
          confidence: combinedConfidence,
          evidence: suggestion.evidence,
          alternatives: suggestion.alternatives?.map(a => a.categoryCode)
        };

        if (enableVerbose) {
          console.log(`[Similar Match] "${result.details?.substring(0, 30)}..." → ${suggestion.suggestedGroup}/${suggestion.suggestedCategoryCode} (${Math.round(combinedConfidence * 100)}% → ${cohort.toUpperCase()})`);
        }
      }
      // No matches at all - still add calculation details for transparency
      else {
        updatedResult.unifiedConfidence = 0;
        updatedResult.unifiedCohort = 'review';
        updatedResult.calculationDetails = unifiedResult.calculation;
      }

      return updatedResult;
    });
  }

  // FINAL PASS: Ensure ALL identifier-matched transactions have proper unifiedConfidence and calculationDetails
  // This handles the case where existingTransactions was empty or not provided
  results = results.map(result => {
    // Skip if already has unified confidence set
    if (result.unifiedConfidence !== undefined && result.unifiedConfidence > 0) {
      return result;
    }

    // Check for identifier match
    const hasIdentifierMatch = result.groupMatchType === 'identifier' || result.categoryMatchType === 'identifier';

    if (hasIdentifierMatch) {
      // Identifier-only match gets high confidence (95% base from identifier matching)
      const identifierOnlyConfidence = result.groupConfidence || result.categoryConfidence || 0.95;
      const matchedIdentifier = result.groupMatchedIdentifier || result.categoryMatchedIdentifier || '';

      return {
        ...result,
        unifiedConfidence: identifierOnlyConfidence,
        unifiedCohort: identifierOnlyConfidence >= CONFIDENCE_THRESHOLDS.AUTO_ACCEPT - CONFIDENCE_THRESHOLDS.EPSILON ? 'auto' : 'ai_assist',
        calculationDetails: {
          similar: {
            matches: [],
            avgDiffRatio: 0,
            count: 0,
            formula: 'No similar transactions to compare',
            score: 0
          },
          identifier: {
            bestMatch: matchedIdentifier,
            matchedChars: matchedIdentifier.length,
            totalChars: matchedIdentifier.length,
            matchType: 'exact',
            score: 1.0  // 100% for exact identifier match
          },
          weights: { similar: 0.9, identifier: 0.1 },
          formula: `Identifier match: "${matchedIdentifier}" → ${(identifierOnlyConfidence * 100).toFixed(0)}%`,
          final: identifierOnlyConfidence
        }
      };
    }

    // No identifier match and no unified confidence - set defaults for review cohort
    if (!result.unifiedConfidence) {
      return {
        ...result,
        unifiedConfidence: 0,
        unifiedCohort: 'review',
        calculationDetails: {
          similar: { matches: [], avgDiffRatio: 0, count: 0, formula: 'No matches', score: 0 },
          identifier: { bestMatch: null, matchedChars: 0, totalChars: 0, matchType: 'none', score: 0 },
          weights: { similar: 0.9, identifier: 0.1 },
          formula: 'No identifier or similar transaction matches found',
          final: 0
        }
      };
    }

    return result;
  });

  // Calculate statistics
  const stats = {
    total: results.length,

    // Type stats
    income: results.filter(r => r.type === 'income').length,
    expense: results.filter(r => r.type === 'expense').length,
    typeAnomalies: results.filter(r => r.typeAnomaly).length,

    // Group stats by cohort
    groupAuto: results.filter(r => r.groupCohort === 'auto').length,
    groupAiAssist: results.filter(r => r.groupCohort === 'ai_assist').length,
    groupReview: results.filter(r => r.groupCohort === 'review').length,
    groupConflicts: results.filter(r => r.groupCohort === 'conflict').length,

    // Category stats by cohort
    categoryAuto: results.filter(r => r.categoryCohort === 'auto').length,
    categoryAiAssist: results.filter(r => r.categoryCohort === 'ai_assist').length,
    categoryReview: results.filter(r => r.categoryCohort === 'review').length,
    categoryConflicts: results.filter(r => r.categoryCohort === 'conflict').length,

    // Unified confidence matching stats
    unifiedConfidenceMatches: results.filter(r => r.groupMatchType === 'unified_confidence' || r.categoryMatchType === 'unified_confidence').length,
    identifierMatches: results.filter(r => r.groupMatchType === 'identifier' || r.categoryMatchType === 'identifier').length,

    // Confidence distribution
    highConfidence: results.filter(r => (r.unifiedConfidence || 0) >= 0.90).length,
    mediumConfidence: results.filter(r => (r.unifiedConfidence || 0) >= 0.50 && (r.unifiedConfidence || 0) < 0.90).length,
    lowConfidence: results.filter(r => (r.unifiedConfidence || 0) < 0.50).length
  };

  // Log summary
  console.log(`[Categorization] Results: ${stats.identifierMatches} identifier matches, ${stats.unifiedConfidenceMatches} unified confidence matches`);
  console.log(`[Categorization] Confidence distribution: ${stats.highConfidence} high (≥90%), ${stats.mediumConfidence} medium (50-89%), ${stats.lowConfidence} low (<50%)`);
  console.log(`[Categorization] Cohorts: AUTO=${stats.groupAuto}, AI_ASSIST=${stats.groupAiAssist}, REVIEW=${stats.groupReview}, CONFLICT=${stats.groupConflicts}`);

  return { results, stats };
}

// =============================================================================
// CONFLICT DETECTION
// =============================================================================

/**
 * Analyze identifier quality across all categories
 * @param {Array} categoryMapping - Category definitions
 * @returns {Object} { duplicates, conflicts, tooBrief, total }
 */
export function analyzeIdentifierQuality(categoryMapping) {
  const issues = {
    duplicates: [],   // Same identifier in multiple categories
    conflicts: [],    // Substring conflicts (e.g., "SHELL" vs "SHELL GARAGE")
    tooBrief: []      // Identifiers that are too short or generic
  };

  const identifierIndex = buildIdentifierIndex(categoryMapping);

  // Find duplicates (exact matches across different categories)
  identifierIndex.forEach((categories, identifier) => {
    if (categories.length > 1) {
      issues.duplicates.push({
        identifier: categories[0].original,
        categories: categories.map(c => ({
          code: c.categoryCode,
          name: c.categoryName
        }))
      });
    }
  });

  // Find conflicts (substring matches in different categories)
  const allIdentifiers = Array.from(identifierIndex.keys());

  allIdentifiers.forEach((id1, i) => {
    allIdentifiers.forEach((id2, j) => {
      if (i !== j && id1.length < id2.length && id2.includes(id1)) {
        const cats1 = identifierIndex.get(id1);
        const cats2 = identifierIndex.get(id2);

        // Only flag if they're in different categories
        const differentCategories = cats1.some(c1 =>
          !cats2.some(c2 => c2.categoryCode === c1.categoryCode)
        );

        if (differentCategories) {
          const alreadyExists = issues.conflicts.some(c =>
            c.shorter === id1 && c.longer === id2
          );

          if (!alreadyExists) {
            issues.conflicts.push({
              shorter: id1,
              shorterCategories: cats1.map(c => ({ code: c.categoryCode, name: c.categoryName })),
              longer: id2,
              longerCategories: cats2.map(c => ({ code: c.categoryCode, name: c.categoryName }))
            });
          }
        }
      }
    });
  });

  // Find too brief or generic identifiers
  identifierIndex.forEach((categories, identifier) => {
    const isTooBrief = identifier.length <= 3;
    const isGeneric = GENERIC_WORDS.has(identifier.toUpperCase());

    if (isTooBrief || isGeneric) {
      issues.tooBrief.push({
        identifier: categories[0].original,
        reason: isTooBrief ? 'too_short' : 'generic',
        categories: categories.map(c => ({ code: c.categoryCode, name: c.categoryName }))
      });
    }
  });

  return {
    ...issues,
    total: issues.duplicates.length + issues.conflicts.length + issues.tooBrief.length
  };
}

// =============================================================================
// PATTERN EXTRACTION
// =============================================================================

/**
 * Extract a pattern from transaction details for learning
 * @param {string} details - Transaction details
 * @returns {string} Extracted pattern or empty string
 */
export function extractPattern(details) {
  if (!details) return '';

  // Try numeric/alphanumeric patterns first (like account numbers)
  const numericMatch = details.match(/[\d\-]{8,}/);
  if (numericMatch) {
    const numericStr = numericMatch[0];
    // Keep ~70% as the pattern (removes variable trailing digits)
    const keepLength = Math.floor(numericStr.length * 0.7);
    if (keepLength >= 6) {
      return numericStr.substring(0, keepLength);
    }
  }

  // Fall back to word-based extraction
  const words = details.split(/\s+/).filter(word => {
    const upper = word.toUpperCase();
    return word.length >= 4 &&
      !GENERIC_WORDS.has(upper) &&
      !upper.startsWith('POS') &&
      !/^POS\d/.test(upper);
  });

  if (words.length > 0) {
    // Return the longest meaningful word
    return words.sort((a, b) => b.length - a.length)[0].toUpperCase();
  }

  return '';
}

/**
 * Find the longest common substring across multiple transaction details
 * @param {Array} transactions - Array of { details } objects
 * @returns {string} Common substring
 */
export function findLongestCommonSubstring(transactions) {
  if (transactions.length === 0) return '';
  if (transactions.length === 1) return transactions[0].details?.trim() || '';

  const details = transactions.map(t => (t.details || '').toUpperCase().trim());
  const longest = details.reduce((max, str) => str.length > max.length ? str : max);

  // Generate candidates from longest to shortest
  for (let length = longest.length; length >= 4; length--) {
    for (let start = 0; start <= longest.length - length; start++) {
      const candidate = longest.substring(start, start + length).trim();

      if (candidate.length >= 4 && details.every(d => d.includes(candidate))) {
        // Clean the identifier
        return cleanIdentifier(candidate);
      }
    }
  }

  return transactions[0].details?.trim() || '';
}

/**
 * Clean an identifier by removing date patterns and noise
 * @param {string} identifier - Raw identifier
 * @returns {string} Cleaned identifier
 */
function cleanIdentifier(identifier) {
  let cleaned = identifier.trim();

  // Remove month abbreviations from start
  cleaned = cleaned.replace(/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/i, '');

  // Remove day numbers at start
  cleaned = cleaned.replace(/^(0?[1-9]|[12][0-9]|3[01])\s*/, '');

  // Remove year patterns at start
  cleaned = cleaned.replace(/^(20\d{2}|'\d{2}|\d{2})\s*/, '');

  // Remove POS prefix with date patterns
  cleaned = cleaned.replace(/^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/i, '');

  return cleaned.trim().length >= 4 ? cleaned.trim() : identifier.trim();
}

/**
 * Score a potential new identifier for quality
 * @param {string} pattern - Candidate identifier
 * @param {Array} categoryMapping - Existing categories
 * @returns {Object} { score, conflicts, isGeneric, isTooShort }
 */
export function scoreIdentifierCandidate(pattern, categoryMapping) {
  const patternUpper = pattern.toUpperCase();
  const patternLower = pattern.toLowerCase();

  const isTooShort = pattern.length < 4;
  const isGeneric = GENERIC_WORDS.has(patternUpper);

  // Check for conflicts with existing identifiers
  const conflicts = [];

  categoryMapping.forEach(category => {
    (category.identifiers || []).forEach(existingId => {
      const existingLower = existingId.toLowerCase();

      // Check for exact match
      if (existingLower === patternLower) {
        conflicts.push({
          type: 'duplicate',
          identifier: existingId,
          categoryCode: category.code,
          categoryName: category.name
        });
      }
      // Check for substring conflicts
      else if (existingLower.includes(patternLower) || patternLower.includes(existingLower)) {
        conflicts.push({
          type: 'substring',
          identifier: existingId,
          categoryCode: category.code,
          categoryName: category.name
        });
      }
    });
  });

  // Calculate quality score
  let score = 1.0;

  if (isTooShort) score -= 0.5;
  if (isGeneric) score -= 0.4;
  if (conflicts.length > 0) score -= 0.3 * conflicts.length;

  // Bonus for longer identifiers
  score += Math.min(pattern.length / 20, 0.2);

  return {
    score: Math.max(0, Math.min(1, score)),
    conflicts,
    isGeneric,
    isTooShort,
    isAcceptable: score >= 0.5 && conflicts.filter(c => c.type === 'duplicate').length === 0
  };
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export { SECTION_TO_GROUP };
