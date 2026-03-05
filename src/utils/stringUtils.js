/**
 * String Utility Functions for Transaction Matching
 *
 * Provides character-level similarity functions for the unified confidence scoring system.
 */

// =============================================================================
// LEVENSHTEIN DISTANCE
// =============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * needed to transform str1 into str2.
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(str1, str2) {
  const s1 = str1.toUpperCase();
  const s2 = str2.toUpperCase();

  const m = s1.length;
  const n = s2.length;

  // Handle edge cases
  if (m === 0) return n;
  if (n === 0) return m;

  // Create distance matrix
  const d = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialize first column
  for (let i = 0; i <= m; i++) {
    d[i][0] = i;
  }

  // Initialize first row
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // Deletion
        d[i][j - 1] + 1,      // Insertion
        d[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Calculate Levenshtein similarity ratio (0-1)
 * Higher = more similar
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity ratio between 0 and 1
 */
export function levenshteinSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1; // Both empty strings are identical

  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * Calculate difference ratio for the exponential formula
 * Returns diffChars / totalChars
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Difference ratio between 0 and 1
 */
export function differenceRatio(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 0; // Both empty strings have no difference

  const distance = levenshteinDistance(str1, str2);
  return distance / maxLen;
}

// =============================================================================
// LONGEST COMMON SUBSEQUENCE
// =============================================================================

/**
 * Calculate the length of the Longest Common Subsequence (LCS) between two strings
 * LCS allows non-contiguous matches, unlike substring matching.
 *
 * Example: LCS("APPLEGREEN", "APPLEGREE") = 9 (missing the final 'N')
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Length of LCS
 */
export function longestCommonSubsequenceLength(str1, str2) {
  const s1 = str1.toUpperCase();
  const s2 = str2.toUpperCase();

  const m = s1.length;
  const n = s2.length;

  // Handle edge cases
  if (m === 0 || n === 0) return 0;

  // Create DP table
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Fill the table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate LCS similarity ratio (0-1)
 * Measures how much of the shorter string appears in the longer string
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity ratio between 0 and 1
 */
export function lcsRatio(str1, str2) {
  const minLen = Math.min(str1.length, str2.length);
  if (minLen === 0) return 0;

  const lcsLen = longestCommonSubsequenceLength(str1, str2);
  return lcsLen / minLen;
}

// =============================================================================
// IDENTIFIER MATCHING
// =============================================================================

/**
 * Find how much of an identifier is present in a transaction string
 *
 * Matching priority:
 * 1. Exact substring match → 100% (e.g., "APPLEGREEN" in "POS12OCT APPLEGREEN FUEL")
 * 2. Typo-tolerant match → 90%+ (e.g., "APPLEGREE" matches "APPLEGREEN" - 1 char typo)
 * 3. No match → 0%
 *
 * Typo tolerance: Allows 1-2 character differences for near-matches.
 * This catches OCR errors and typos while rejecting unrelated strings.
 *
 * @param {string} transaction - Transaction details string
 * @param {string} identifier - Identifier to match
 * @returns {Object} { matchedChars, totalChars, ratio, matchType }
 */
export function identifierMatchScore(transaction, identifier) {
  const txUpper = transaction.toUpperCase();
  const idUpper = identifier.toUpperCase();

  // ==========================================================================
  // PRIORITY 1: Exact substring match (100%)
  // ==========================================================================
  if (txUpper.includes(idUpper)) {
    return {
      matchedChars: idUpper.length,
      totalChars: idUpper.length,
      ratio: 1.0,
      matchType: 'exact'
    };
  }

  // ==========================================================================
  // PRIORITY 2: Typo-tolerant matching using sliding window + Levenshtein
  // ==========================================================================
  // Find the best-matching window in the transaction that's similar to the identifier
  // Allow up to 2 character differences (typos, OCR errors)

  const idLen = idUpper.length;

  // Skip typo matching for very short identifiers (too prone to false positives)
  if (idLen < 5) {
    return {
      matchedChars: 0,
      totalChars: idLen,
      ratio: 0,
      matchType: 'none'
    };
  }

  // Maximum allowed edit distance: 2 for identifiers up to 15 chars,
  // or ~15% of identifier length for longer ones
  const maxAllowedDistance = idLen <= 15 ? 2 : Math.ceil(idLen * 0.15);

  let bestDistance = Infinity;
  let bestWindow = '';

  // Slide a window across the transaction to find the best matching segment
  // Window sizes: exact length, ±1, ±2 to account for missing/extra characters
  const windowSizes = [idLen - 2, idLen - 1, idLen, idLen + 1, idLen + 2].filter(s => s > 0);

  for (const windowSize of windowSizes) {
    for (let i = 0; i <= txUpper.length - windowSize; i++) {
      const window = txUpper.substring(i, i + windowSize);

      // CRITICAL: Reject windows that contain spaces - identifiers shouldn't span words
      // This prevents false positives like "T NURS" matching "TONERS"
      if (window.includes(' ')) {
        continue;
      }

      // Quick filter: first character should match or be adjacent
      // This dramatically reduces the number of Levenshtein calculations
      if (Math.abs(window.charCodeAt(0) - idUpper.charCodeAt(0)) > 1) {
        continue;
      }

      const distance = levenshteinDistance(window, idUpper);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestWindow = window;

        // Early exit if we found an exact or near-exact match
        if (distance <= 1) break;
      }
    }

    if (bestDistance <= 1) break;
  }

  // Check if the best match is good enough (within allowed typo tolerance)
  if (bestDistance <= maxAllowedDistance) {
    // Score based on how close the match is
    // Distance 0 = 100%, Distance 1 = ~93%, Distance 2 = ~87%
    const ratio = 1 - (bestDistance / idLen);

    return {
      matchedChars: idLen - bestDistance,
      totalChars: idLen,
      ratio: Math.max(ratio, 0.85), // Minimum 85% for typo matches
      matchType: 'typo',
      typoDetails: {
        bestWindow,
        editDistance: bestDistance,
        maxAllowed: maxAllowedDistance
      }
    };
  }

  // ==========================================================================
  // NO MATCH: Identifier not found (exact or with typos)
  // ==========================================================================
  return {
    matchedChars: 0,
    totalChars: idLen,
    ratio: 0,
    matchType: 'none'
  };
}

// =============================================================================
// ADAPTIVE WEIGHTING FOR FIRST-TIME UPLOADS
// =============================================================================

/**
 * Phase thresholds for adaptive weighting
 * During wave 1 (bootstrap), we rely on identifiers. After wave 1, we trust similar matches.
 * UPDATED: Faster transition to similar-heavy weighting after first wave completes.
 */
const ADAPTIVE_THRESHOLDS = {
  PHASE_1: 0,      // Wave 1 bootstrap: 10:90 similar:identifier (rely on identifiers)
  PHASE_2: 50,     // Mid-wave 1: start trusting similar matches
  PHASE_3: 100     // Wave 2+: standard mode 90:10 (trust similar matches heavily)
};

/**
 * Calculate adaptive weights based on existing transaction count
 *
 * UPDATED: After the first wave (~100 transactions), we should trust similar
 * transaction matches heavily since we now have a good corpus to match against.
 *
 * Wave 1 first half (0-49): 10:90 similar:identifier - bootstrap with identifiers
 * Wave 1 second half (50-99): Quick transition to trust similar matches
 * Wave 2+ (100+): 90:10 similar:identifier - trust the corpus
 *
 * @param {number} existingCount - Number of already-processed transactions
 * @returns {{ similar: number, identifier: number }} Weight pair summing to 1.0
 */
export function getAdaptiveWeights(existingCount = 0) {
  if (existingCount < ADAPTIVE_THRESHOLDS.PHASE_2) {
    // Phase 1 (0-49 transactions): 10% similar, 90% identifier
    // First half of wave 1 - rely heavily on identifiers
    return { similar: 0.10, identifier: 0.90 };
  } else if (existingCount < ADAPTIVE_THRESHOLDS.PHASE_3) {
    // Phase 2 (50-99): Quick transition from 10:90 → 90:10
    // Second half of wave 1 - start trusting similar matches
    const progress = (existingCount - 50) / 50;
    return {
      similar: 0.10 + (progress * 0.80),   // 10% → 90%
      identifier: 0.90 - (progress * 0.80) // 90% → 10%
    };
  } else {
    // Phase 3 (100+): Standard mode - 90% similar, 10% identifier
    // Wave 2 onwards - trust similar transactions heavily
    return { similar: 0.90, identifier: 0.10 };
  }
}

// =============================================================================
// UNIFIED CONFIDENCE CALCULATION
// =============================================================================

/**
 * Calculate unified confidence score for a transaction
 *
 * Formula:
 * - Similar Transactions Score: 1 - (avgDiffRatio)^n where n = count
 * - Identifier Score: LCS ratio
 * - Combined: (similarScore × weights.similar) + (identifierScore × weights.identifier)
 *
 * Weights are adaptive based on existingTransactionsCount:
 * - Wave 1 (0-99 processed): 10:90 similar:identifier
 * - Wave 3 (300 processed): 50:50 balanced
 * - Wave 5+ (500+ processed): 90:10 similar:identifier (standard)
 *
 * @param {string} transactionDetails - The transaction text to categorize
 * @param {Array} similarTransactions - Array of { details, group, category } from past transactions
 * @param {Array} identifiers - Array of identifier strings for the target group/category
 * @param {Object} options - Optional configuration
 * @param {number} options.existingTransactionsCount - Count of already-processed transactions for adaptive weighting
 * @returns {Object} { confidence, calculation }
 */
export function calculateUnifiedConfidence(transactionDetails, similarTransactions = [], identifiers = [], options = {}) {
  const txUpper = transactionDetails.toUpperCase();
  // Clean version strips generic banking boilerplate (SEPA DD, etc.)
  // so that "Eurofins SEPA DD" vs "Rentokil SEPA DD" aren't inflated by shared suffixes
  const txCleaned = cleanForSimilarity(transactionDetails);

  // =========================================================================
  // COMPONENT 1: Similar Transaction Score (90% weight)
  // =========================================================================
  let similarScore = 0;
  let similarCalc = {
    matches: [],
    avgDiffRatio: 0,
    count: 0,
    formula: '',
    score: 0
  };

  if (similarTransactions.length > 0) {
    // Calculate difference ratio for each similar transaction
    // Uses cleaned strings so generic banking terms don't inflate similarity
    const diffRatios = similarTransactions.map(sim => {
      const simCleaned = cleanForSimilarity(sim.details || '');
      const diffRatio = differenceRatio(txCleaned, simCleaned);
      return {
        details: sim.details,
        group: sim.group,
        category: sim.categoryCode || sim.category?.code,
        diffRatio,
        similarity: 1 - diffRatio
      };
    });

    // Sort by similarity (best first)
    diffRatios.sort((a, b) => a.diffRatio - b.diffRatio);

    // CRITICAL FIX: If best match is significantly better than others, use only the best
    // This prevents one excellent match (e.g., 81% similar) from being diluted by
    // weak matches (e.g., 52% similar) through averaging
    const bestMatch = diffRatios[0];
    const secondBestMatch = diffRatios.length > 1 ? diffRatios[1] : null;

    // Use best match only if:
    // 1. Best is >10% better than second best (in similarity terms), OR
    // 2. Best is ≥60% similar AND second best is <55% similar (clear quality gap), OR
    // 3. Best is >25% better than second best in relative terms (e.g., 62% vs 48% = 29% better)
    const absoluteDiff = secondBestMatch ? (bestMatch.similarity - secondBestMatch.similarity) : 0;
    const relativeDiff = secondBestMatch && secondBestMatch.similarity > 0
      ? (bestMatch.similarity - secondBestMatch.similarity) / secondBestMatch.similarity
      : 0;
    const qualityGap = bestMatch.similarity >= 0.60 && secondBestMatch && secondBestMatch.similarity < 0.55;

    const useBestOnly = !secondBestMatch ||
      absoluteDiff > 0.10 ||
      relativeDiff > 0.25 ||
      qualityGap;

    let effectiveSimilarity;
    let effectiveCount;
    let formula;

    if (useBestOnly || diffRatios.length === 1) {
      // Use only the best match
      effectiveSimilarity = bestMatch.similarity;
      effectiveCount = 1;
      const reason = !secondBestMatch ? 'single match' :
        absoluteDiff > 0.10 ? `${(absoluteDiff * 100).toFixed(0)}% better` :
        relativeDiff > 0.25 ? `${(relativeDiff * 100).toFixed(0)}% relatively better` :
        'quality gap';
      formula = `${(effectiveSimilarity * 100).toFixed(1)}% (best match only - ${reason})`;
    } else {
      // Average similarity, but only include matches that are reasonably close to the best
      // Filter out matches that are >15% worse than best (in diff ratio terms)
      const goodMatches = diffRatios.filter(d =>
        d.diffRatio <= bestMatch.diffRatio + 0.15 || d.similarity >= 0.65
      );

      effectiveSimilarity = goodMatches.reduce((sum, d) => sum + d.similarity, 0) / goodMatches.length;
      effectiveCount = goodMatches.length;

      // Diminishing returns boost for multiple GOOD matches
      const countMultiplier = 1 + Math.min(0.15 * Math.log2(Math.max(effectiveCount, 1)), 0.30);
      effectiveSimilarity = Math.min(effectiveSimilarity * countMultiplier, 1.0);
      formula = `${((goodMatches.reduce((sum, d) => sum + d.similarity, 0) / goodMatches.length) * 100).toFixed(1)}% avg × ${countMultiplier.toFixed(2)} (n=${effectiveCount})`;
    }

    similarScore = effectiveSimilarity;

    similarCalc = {
      matches: diffRatios.slice(0, 5), // Top 5 for debug output (sorted by similarity)
      avgDiffRatio: 1 - effectiveSimilarity,
      count: effectiveCount,
      totalFound: diffRatios.length,
      usedBestOnly: useBestOnly || diffRatios.length === 1,
      formula,
      score: similarScore
    };
  }

  // =========================================================================
  // COMPONENT 2: Identifier Score (10% weight)
  // =========================================================================
  let identifierScore = 0;
  let identifierCalc = {
    bestMatch: null,
    matchedChars: 0,
    totalChars: 0,
    score: 0
  };

  if (identifiers.length > 0) {
    // Find best matching identifier
    for (const identifier of identifiers) {
      const matchResult = identifierMatchScore(txUpper, identifier);

      if (matchResult.ratio > identifierScore) {
        identifierScore = matchResult.ratio;
        identifierCalc = {
          bestMatch: identifier,
          matchedChars: matchResult.matchedChars,
          totalChars: matchResult.totalChars,
          matchType: matchResult.matchType,
          score: matchResult.ratio
        };
      }
    }
  }

  // =========================================================================
  // COMPONENT 3: Combined Confidence (with Adaptive Weighting)
  // =========================================================================
  const existingCount = options.existingTransactionsCount || 0;
  const weights = getAdaptiveWeights(existingCount);

  let finalConfidence;
  let combinedFormula;

  if (similarTransactions.length > 0 && similarScore > 0) {
    // Weighted combination using adaptive weights
    finalConfidence = (similarScore * weights.similar) + (identifierScore * weights.identifier);
    combinedFormula = `(${similarScore.toFixed(4)} × ${weights.similar.toFixed(2)}) + (${identifierScore.toFixed(4)} × ${weights.identifier.toFixed(2)})`;

    // CRITICAL FIX: Strong identifier matches should not be dragged below a reasonable
    // floor by weak similar matches. A 100% identifier match producing 35% confidence
    // is nonsensical — the identifier IS a confirmed pattern. Apply identifier as floor.
    if (identifierScore >= 0.85) {
      const isWave1 = existingCount < 100;
      const identifierFloor = isWave1 ? 0.90 : 0.80;
      if (finalConfidence < identifierFloor) {
        combinedFormula += ` → floored from ${(finalConfidence * 100).toFixed(1)}% to ${(identifierFloor * 100).toFixed(1)}% (strong identifier)`;
        finalConfidence = identifierFloor;
      }
    }
  } else if (identifierScore > 0) {
    // No similar matches available - use identifier with wave-aware cap
    // Wave 1 (first 100 transactions): Allow up to 95% for strong identifier matches
    // Later waves: Cap at 85% (encourage similar transaction matching)
    const isWave1 = existingCount < 100;
    const cap = isWave1 ? 0.95 : 0.85;
    finalConfidence = Math.min(identifierScore, cap);
    combinedFormula = `min(${identifierScore.toFixed(4)}, ${cap}) [identifier-only, wave=${isWave1 ? '1' : '2+'}]`;
  } else {
    // No evidence
    finalConfidence = 0;
    combinedFormula = 'No evidence found';
  }

  // Determine cohort (use small tolerance for floating-point precision)
  // 89.99% should count as 90%, not 89%
  let cohort;
  const EPSILON = 0.0001;
  if (finalConfidence >= 0.90 - EPSILON) {
    cohort = 'auto';
  } else if (finalConfidence >= 0.50 - EPSILON) {
    cohort = 'ai_assist';
  } else {
    cohort = 'review';
  }

  return {
    confidence: finalConfidence,
    cohort,
    calculation: {
      similar: similarCalc,
      identifier: identifierCalc,
      weights,
      existingCount,
      isAdaptive: existingCount < 500,
      formula: combinedFormula,
      final: finalConfidence
    }
  };
}

// =============================================================================
// TRANSACTION CLUSTERING FOR BATCH PROCESSING
// =============================================================================

/**
 * Generic banking prefixes and patterns to strip before clustering
 */
const CLUSTER_STRIP_PATTERNS = [
  /^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi,
  /^\d{1,2}\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi,
  /^(SEPA\s*DD|SEPA\s*CT|DD\s*|SO\s*|TRF\s*|FPI\s*|BGC\s*CHQ\s*)/gi,
  /^(THE|A|AN)\s+/gi,
  /\s*REF\s*[\dA-Z]+$/gi,
  /\s+\d{6,}$/g  // Reference numbers at end
];

/**
 * Patterns to strip before similarity comparison (prefix AND suffix positions)
 * These are generic banking/payment method terms that inflate similarity scores
 * between completely unrelated transactions (e.g., "Eurofins SEPA DD" vs "Rentokil SEPA DD")
 */
const SIMILARITY_STRIP_PATTERNS = [
  // Payment method terms — at START or END of string
  /\bSEPA\s*DD\b/gi,
  /\bSEPA\s*CT\b/gi,
  /\bSEPA\s*CREDIT\s*TRANSFER\b/gi,
  /\bDIRECT\s*DEBIT\b/gi,
  /\bSTANDING\s*ORDER\b/gi,
  // Common prefix-only patterns
  /^(DD|SO|TRF|FPI|BGC|CHQ)\s+/gi,
  /^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi,
  /^\d{1,2}\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi,
  // Reference numbers and trailing noise
  /\s*REF\s*[\dA-Z]+$/gi,
  /\s+\d{6,}$/g,
];

/**
 * Clean transaction details for similarity comparison
 * Strips generic banking boilerplate (SEPA DD, reference numbers, etc.)
 * that would otherwise inflate similarity between unrelated transactions.
 *
 * @param {string} details - Raw transaction details
 * @returns {string} Cleaned details for similarity scoring
 */
export function cleanForSimilarity(details) {
  if (!details) return '';

  let cleaned = details.toUpperCase().trim();

  for (const pattern of SIMILARITY_STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Collapse multiple spaces left after stripping
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

/**
 * Clean transaction details for clustering comparison
 * Strips date prefixes, reference numbers, and normalizes text
 *
 * @param {string} details - Raw transaction details
 * @returns {string} Cleaned details for clustering
 */
export function cleanForClustering(details) {
  if (!details) return '';

  let cleaned = details.toUpperCase().trim();

  // Apply all strip patterns
  for (const pattern of CLUSTER_STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * Calculate quick similarity score for clustering (optimized for speed)
 * Uses a simplified check before expensive Levenshtein
 *
 * @param {string} str1 - First string (already cleaned)
 * @param {string} str2 - Second string (already cleaned)
 * @returns {number} Similarity score 0-1
 */
function quickSimilarity(str1, str2) {
  // Quick length check - strings with very different lengths are unlikely to be similar
  const lenRatio = Math.min(str1.length, str2.length) / Math.max(str1.length, str2.length);
  if (lenRatio < 0.6) return 0;

  // Quick prefix check - if first 5 chars don't match, likely not similar enough
  const prefixLen = Math.min(5, str1.length, str2.length);
  const prefix1 = str1.substring(0, prefixLen);
  const prefix2 = str2.substring(0, prefixLen);
  if (prefix1 !== prefix2) {
    // Allow 1 character difference in prefix
    let diffs = 0;
    for (let i = 0; i < prefixLen; i++) {
      if (prefix1[i] !== prefix2[i]) diffs++;
    }
    if (diffs > 1) return 0;
  }

  // Full Levenshtein for final score
  return levenshteinSimilarity(str1, str2);
}

/**
 * Cluster similar transactions together using Union-Find algorithm
 * Transactions in the same cluster are similar enough to be categorized together
 *
 * @param {Array} transactions - Array of transaction objects with `details` field
 * @param {number} similarityThreshold - Minimum similarity to cluster (default 0.85 = 85% similar)
 * @returns {Array} Array of clusters, each cluster is { representative, transactions, cleanedDetails }
 */
export function clusterSimilarTransactions(transactions, similarityThreshold = 0.85) {
  if (!transactions || transactions.length === 0) return [];
  if (transactions.length === 1) {
    return [{
      representative: transactions[0],
      transactions: transactions,
      cleanedDetails: cleanForClustering(transactions[0].details),
      size: 1
    }];
  }

  console.log(`[Clustering] Clustering ${transactions.length} transactions with threshold ${similarityThreshold}`);

  // Precompute cleaned details for all transactions
  const cleanedDetails = transactions.map(t => cleanForClustering(t.details || ''));

  // Union-Find data structure for clustering
  const parent = transactions.map((_, i) => i);
  const rank = transactions.map(() => 0);

  const find = (i) => {
    if (parent[i] !== i) {
      parent[i] = find(parent[i]); // Path compression
    }
    return parent[i];
  };

  const union = (i, j) => {
    const pi = find(i);
    const pj = find(j);
    if (pi === pj) return;

    // Union by rank
    if (rank[pi] < rank[pj]) {
      parent[pi] = pj;
    } else if (rank[pi] > rank[pj]) {
      parent[pj] = pi;
    } else {
      parent[pj] = pi;
      rank[pi]++;
    }
  };

  // Compare all pairs and union similar ones
  // For large datasets, use a smarter approach: group by first N chars first
  const prefixGroups = new Map();
  const prefixLen = 8;

  for (let i = 0; i < transactions.length; i++) {
    const prefix = cleanedDetails[i].substring(0, prefixLen);
    if (!prefixGroups.has(prefix)) {
      prefixGroups.set(prefix, []);
    }
    prefixGroups.get(prefix).push(i);
  }

  // Only compare within prefix groups (O(n) instead of O(n^2) for most cases)
  for (const [prefix, indices] of prefixGroups) {
    if (indices.length === 1) continue;

    // Compare all pairs within this prefix group
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const idx1 = indices[i];
        const idx2 = indices[j];
        const similarity = quickSimilarity(cleanedDetails[idx1], cleanedDetails[idx2]);

        if (similarity >= similarityThreshold) {
          union(idx1, idx2);
        }
      }
    }
  }

  // Also do cross-prefix comparisons for similar prefixes (handles typos in prefix)
  const prefixList = Array.from(prefixGroups.keys());
  for (let i = 0; i < prefixList.length; i++) {
    for (let j = i + 1; j < prefixList.length; j++) {
      // Quick check: are these prefixes similar?
      const p1 = prefixList[i];
      const p2 = prefixList[j];
      if (levenshteinSimilarity(p1, p2) >= 0.75) {
        // Compare one representative from each group
        const rep1 = prefixGroups.get(p1)[0];
        const rep2 = prefixGroups.get(p2)[0];
        if (quickSimilarity(cleanedDetails[rep1], cleanedDetails[rep2]) >= similarityThreshold) {
          // These groups should be merged - compare all pairs
          for (const idx1 of prefixGroups.get(p1)) {
            for (const idx2 of prefixGroups.get(p2)) {
              if (quickSimilarity(cleanedDetails[idx1], cleanedDetails[idx2]) >= similarityThreshold) {
                union(idx1, idx2);
              }
            }
          }
        }
      }
    }
  }

  // Group transactions by their root parent
  const clusterMap = new Map();
  for (let i = 0; i < transactions.length; i++) {
    const root = find(i);
    if (!clusterMap.has(root)) {
      clusterMap.set(root, []);
    }
    clusterMap.get(root).push({
      transaction: transactions[i],
      cleanedDetails: cleanedDetails[i],
      index: i
    });
  }

  // Build cluster objects
  const clusters = [];
  for (const [root, members] of clusterMap) {
    // Sort members by details length (longest = most complete = representative)
    members.sort((a, b) => b.cleanedDetails.length - a.cleanedDetails.length);

    const representative = members[0].transaction;
    const clusterTransactions = members.map(m => m.transaction);

    clusters.push({
      representative,
      transactions: clusterTransactions,
      cleanedDetails: members[0].cleanedDetails,
      size: clusterTransactions.length
    });
  }

  // Sort clusters by size (largest first)
  clusters.sort((a, b) => b.size - a.size);

  // Log clustering results
  const multiMemberClusters = clusters.filter(c => c.size > 1);
  if (multiMemberClusters.length > 0) {
    console.log(`[Clustering] Created ${clusters.length} clusters:`);
    console.log(`  - ${multiMemberClusters.length} clusters with 2+ transactions`);
    console.log(`  - Largest cluster: ${clusters[0].size} transactions`);
    console.log(`  - Total batched: ${multiMemberClusters.reduce((sum, c) => sum + c.size, 0)} of ${transactions.length}`);
    // Log top 3 clusters for debugging
    multiMemberClusters.slice(0, 3).forEach((c, i) => {
      console.log(`  [Cluster ${i + 1}] "${c.cleanedDetails.substring(0, 40)}..." (${c.size} transactions)`);
    });
  } else {
    console.log(`[Clustering] No similar transactions found - ${clusters.length} unique transactions`);
  }

  return clusters;
}

/**
 * Find similar transactions within a set (for UI grouping)
 * Returns a map of transaction ID to its similar transaction IDs
 *
 * @param {Array} transactions - Array of transaction objects
 * @param {number} threshold - Similarity threshold (default 0.80)
 * @returns {Map} transactionId -> Set of similar transaction IDs
 */
export function findSimilarTransactionGroups(transactions, threshold = 0.80) {
  const clusters = clusterSimilarTransactions(transactions, threshold);
  const similarMap = new Map();

  for (const cluster of clusters) {
    if (cluster.size > 1) {
      const allIds = new Set(cluster.transactions.map(t => t.id));
      for (const tx of cluster.transactions) {
        // Each transaction's similar set is all other transactions in the cluster
        const similarIds = new Set(allIds);
        similarIds.delete(tx.id);
        similarMap.set(tx.id, similarIds);
      }
    }
  }

  return similarMap;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  levenshteinDistance,
  levenshteinSimilarity,
  differenceRatio,
  longestCommonSubsequenceLength,
  lcsRatio,
  identifierMatchScore,
  calculateUnifiedConfidence,
  getAdaptiveWeights,
  ADAPTIVE_THRESHOLDS,
  cleanForClustering,
  cleanForSimilarity,
  clusterSimilarTransactions,
  findSimilarTransactionGroups
};

// Also export thresholds for testing/debugging
export { ADAPTIVE_THRESHOLDS };
