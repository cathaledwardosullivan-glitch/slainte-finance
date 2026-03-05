/**
 * Wave Processor for First-Time Transaction Uploads
 *
 * During onboarding, there are no existing transactions to compare against.
 * The wave processor solves this by:
 * 1. Dividing the initial upload into waves (e.g., 500 transactions each)
 * 2. Processing Wave 1 with identifier-heavy confidence (90% identifier weight)
 * 3. Using AUTO-cohort transactions from Wave 1 as "existing" for Wave 2
 * 4. Gradually shifting to similar-transaction-heavy confidence as corpus grows
 *
 * This allows the system to bootstrap itself during first-time uploads.
 */

import { categorizeTransactionBatch, CONFIDENCE_THRESHOLDS } from './categorizationEngine';
import { getAdaptiveWeights, ADAPTIVE_THRESHOLDS } from './stringUtils';

// =============================================================================
// WAVE CONFIGURATION
// =============================================================================

/**
 * Default wave configuration
 *
 * IMPORTANT: Wave sizes are adaptive to match the confidence weighting thresholds:
 * - First 5 waves (0-500 transactions): 100 per wave - allows adaptive weighting to evolve
 * - Subsequent waves: 500 per wave - efficient bulk processing in standard mode
 *
 * This ensures the weighting transitions (10:90 → 50:50 → 90:10) are meaningful.
 */
export const WAVE_CONFIG = {
  INITIAL_WAVE_SIZE: 100,        // First 5 waves: small to enable adaptive weighting
  STANDARD_WAVE_SIZE: 500,       // After 500 transactions: larger for efficiency
  ADAPTIVE_THRESHOLD: 500,       // Switch to standard wave size after this count
  MAX_WAVES: 20,                 // Maximum number of waves (5 small + 15 large = 8000 txns)
  AUTO_COHORT_ONLY: true,        // Only add AUTO cohort to existing corpus
  VERBOSE_LOGGING: false         // Enable detailed logging
};

/**
 * Get appropriate wave size based on how many transactions have been processed
 * @param {number} processedCount - Transactions already processed
 * @returns {number} Wave size to use
 */
export function getAdaptiveWaveSize(processedCount) {
  if (processedCount < WAVE_CONFIG.ADAPTIVE_THRESHOLD) {
    // First 500 transactions: use small waves (100 each)
    // This allows the confidence weighting to adapt meaningfully
    return WAVE_CONFIG.INITIAL_WAVE_SIZE;
  }
  // After 500 transactions: use larger waves for efficiency
  return WAVE_CONFIG.STANDARD_WAVE_SIZE;
}

// =============================================================================
// WAVE PROCESSOR
// =============================================================================

/**
 * Process transactions in waves for first-time uploads
 *
 * Wave sizes are ADAPTIVE to match confidence weighting thresholds:
 * - Waves 1-5 (0-500 txns): 100 per wave - allows adaptive weighting to evolve
 * - Waves 6+: 500 per wave - efficient bulk processing in standard mode
 *
 * @param {Array} transactions - All transactions to categorize
 * @param {Array} categoryMapping - Category definitions
 * @param {Object} options - Processing options
 * @param {boolean} options.autoOnly - Only add AUTO cohort to corpus (default: true)
 * @param {boolean} options.verbose - Enable detailed logging (default: false)
 * @param {Function} options.onWaveComplete - Callback after each wave (optional)
 * @param {Function} options.onProgress - Progress callback (processed, total) (optional)
 * @returns {Promise<Object>} { results, stats, waveDetails }
 */
export async function processInWaves(transactions, categoryMapping, options = {}) {
  const {
    autoOnly = WAVE_CONFIG.AUTO_COHORT_ONLY,
    verbose = WAVE_CONFIG.VERBOSE_LOGGING,
    onWaveComplete = null,
    onProgress = null
  } = options;

  // Validate inputs
  if (!transactions || transactions.length === 0) {
    return {
      results: [],
      stats: { total: 0, waveCount: 0 },
      waveDetails: []
    };
  }

  // Divide into adaptive waves (smaller initial waves, larger later)
  const waves = createAdaptiveWaves(transactions);
  const waveCount = Math.min(waves.length, WAVE_CONFIG.MAX_WAVES);

  if (verbose) {
    console.log(`[WaveProcessor] Processing ${transactions.length} transactions in ${waveCount} adaptive waves`);
  }

  // Track processed transactions for similarity matching
  let existingTransactions = [];
  let allResults = [];
  const waveDetails = [];

  // Process each wave
  for (let waveIndex = 0; waveIndex < waveCount; waveIndex++) {
    const wave = waves[waveIndex];
    const existingCount = existingTransactions.length;

    // Calculate current weights for logging
    const weights = getAdaptiveWeights(existingCount);

    if (verbose) {
      console.log(`\n[WaveProcessor] === Wave ${waveIndex + 1}/${waveCount} ===`);
      console.log(`[WaveProcessor] Transactions: ${wave.length}`);
      console.log(`[WaveProcessor] Existing corpus: ${existingCount}`);
      console.log(`[WaveProcessor] Weights: similar=${(weights.similar * 100).toFixed(0)}%, identifier=${(weights.identifier * 100).toFixed(0)}%`);
    }

    // Process this wave with the current existing transactions
    const { results: waveResults, stats: waveStats } = categorizeTransactionBatch(
      wave,
      categoryMapping,
      existingTransactions
    );

    // Inject existingTransactionsCount into each result for adaptive weighting tracking
    const resultsWithCount = waveResults.map(result => ({
      ...result,
      _waveIndex: waveIndex + 1,
      _existingCountAtProcessing: existingCount
    }));

    // Extract AUTO cohort transactions to add to existing corpus
    const autoTransactions = resultsWithCount.filter(r => {
      if (autoOnly) {
        return r.unifiedCohort === 'auto' || r.categoryCohort === 'auto';
      }
      // Include AI_ASSIST as well if not autoOnly
      return r.unifiedCohort === 'auto' || r.unifiedCohort === 'ai_assist' ||
             r.categoryCohort === 'auto' || r.categoryCohort === 'ai_assist';
    });

    // Calculate wave statistics
    const waveDetail = {
      waveNumber: waveIndex + 1,
      transactionCount: wave.length,
      existingCountBefore: existingCount,
      weights: { ...weights },
      stats: {
        auto: resultsWithCount.filter(r => r.unifiedCohort === 'auto').length,
        aiAssist: resultsWithCount.filter(r => r.unifiedCohort === 'ai_assist').length,
        review: resultsWithCount.filter(r => r.unifiedCohort === 'review').length,
        addedToCorpus: autoTransactions.length
      }
    };
    waveDetails.push(waveDetail);

    if (verbose) {
      console.log(`[WaveProcessor] Wave ${waveIndex + 1} results:`);
      console.log(`  AUTO: ${waveDetail.stats.auto} (${((waveDetail.stats.auto / wave.length) * 100).toFixed(1)}%)`);
      console.log(`  AI_ASSIST: ${waveDetail.stats.aiAssist} (${((waveDetail.stats.aiAssist / wave.length) * 100).toFixed(1)}%)`);
      console.log(`  REVIEW: ${waveDetail.stats.review} (${((waveDetail.stats.review / wave.length) * 100).toFixed(1)}%)`);
      console.log(`  Added to corpus: ${waveDetail.stats.addedToCorpus}`);
    }

    // Add results to all results
    allResults = [...allResults, ...resultsWithCount];

    // Add AUTO transactions to existing corpus for next wave
    existingTransactions = [...existingTransactions, ...autoTransactions];

    // Fire callbacks
    if (onWaveComplete) {
      onWaveComplete({
        waveNumber: waveIndex + 1,
        totalWaves: waveCount,
        waveDetail,
        cumulativeResults: allResults.length
      });
    }

    if (onProgress) {
      onProgress(allResults.length, transactions.length);
    }
  }

  // Calculate final statistics
  const finalStats = calculateFinalStats(allResults, waveDetails);

  if (verbose) {
    console.log('\n[WaveProcessor] === Final Statistics ===');
    console.log(`Total: ${finalStats.total}`);
    console.log(`AUTO: ${finalStats.autoCohort} (${finalStats.autoPercent.toFixed(1)}%)`);
    console.log(`AI_ASSIST: ${finalStats.aiAssistCohort} (${finalStats.aiAssistPercent.toFixed(1)}%)`);
    console.log(`REVIEW: ${finalStats.reviewCohort} (${finalStats.reviewPercent.toFixed(1)}%)`);
    console.log(`Final corpus size: ${existingTransactions.length}`);
  }

  return {
    results: allResults,
    stats: finalStats,
    waveDetails,
    finalCorpusSize: existingTransactions.length
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Split array into chunks of specified size
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} Array of chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Create adaptive waves that match confidence weighting thresholds
 *
 * Strategy:
 * - First 500 transactions: 5 waves of 100 each (allows weighting to adapt)
 * - Remaining transactions: waves of 500 each (efficient bulk processing)
 *
 * @param {Array} transactions - All transactions
 * @returns {Array} Array of transaction waves
 */
function createAdaptiveWaves(transactions) {
  const waves = [];
  let remaining = [...transactions];
  let processedCount = 0;

  while (remaining.length > 0 && waves.length < WAVE_CONFIG.MAX_WAVES) {
    // Get appropriate wave size based on how many we've queued
    const waveSize = getAdaptiveWaveSize(processedCount);

    // Take the next wave
    const wave = remaining.slice(0, waveSize);
    waves.push(wave);

    // Update tracking
    remaining = remaining.slice(waveSize);
    processedCount += wave.length;
  }

  return waves;
}

/**
 * Calculate final statistics from all results
 * @param {Array} results - All categorization results
 * @param {Array} waveDetails - Details from each wave
 * @returns {Object} Final statistics
 */
function calculateFinalStats(results, waveDetails) {
  const total = results.length;

  const autoCohort = results.filter(r => r.unifiedCohort === 'auto').length;
  const aiAssistCohort = results.filter(r => r.unifiedCohort === 'ai_assist').length;
  const reviewCohort = results.filter(r => r.unifiedCohort === 'review').length;

  const identifierMatches = results.filter(r =>
    r.groupMatchType === 'identifier' || r.categoryMatchType === 'identifier'
  ).length;

  const similarMatches = results.filter(r =>
    r.groupMatchType === 'unified_confidence' || r.categoryMatchType === 'unified_confidence'
  ).length;

  // Calculate confidence distribution
  const highConfidence = results.filter(r => (r.unifiedConfidence || 0) >= 0.90).length;
  const mediumConfidence = results.filter(r =>
    (r.unifiedConfidence || 0) >= 0.50 && (r.unifiedConfidence || 0) < 0.90
  ).length;
  const lowConfidence = results.filter(r => (r.unifiedConfidence || 0) < 0.50).length;

  // Wave progression stats
  const waveProgression = waveDetails.map(w => ({
    wave: w.waveNumber,
    autoPercent: (w.stats.auto / w.transactionCount) * 100,
    corpusSizeBefore: w.existingCountBefore,
    weights: w.weights
  }));

  return {
    total,
    waveCount: waveDetails.length,

    // Cohort counts
    autoCohort,
    aiAssistCohort,
    reviewCohort,

    // Percentages
    autoPercent: total > 0 ? (autoCohort / total) * 100 : 0,
    aiAssistPercent: total > 0 ? (aiAssistCohort / total) * 100 : 0,
    reviewPercent: total > 0 ? (reviewCohort / total) * 100 : 0,

    // Match types
    identifierMatches,
    similarMatches,
    noMatch: total - identifierMatches - similarMatches,

    // Confidence distribution
    highConfidence,
    mediumConfidence,
    lowConfidence,

    // Wave progression
    waveProgression
  };
}

/**
 * Get wave processing summary for display
 * @param {Object} waveResult - Result from processInWaves
 * @returns {Object} Summary for UI display
 */
export function getWaveProcessingSummary(waveResult) {
  const { stats, waveDetails } = waveResult;

  return {
    totalTransactions: stats.total,
    wavesProcessed: stats.waveCount,

    cohortBreakdown: {
      auto: {
        count: stats.autoCohort,
        percent: stats.autoPercent.toFixed(1)
      },
      aiAssist: {
        count: stats.aiAssistCohort,
        percent: stats.aiAssistPercent.toFixed(1)
      },
      review: {
        count: stats.reviewCohort,
        percent: stats.reviewPercent.toFixed(1)
      }
    },

    waveProgress: waveDetails.map(w => ({
      wave: w.waveNumber,
      size: w.transactionCount,
      autoRate: ((w.stats.auto / w.transactionCount) * 100).toFixed(1) + '%',
      identifierWeight: (w.weights.identifier * 100).toFixed(0) + '%',
      similarWeight: (w.weights.similar * 100).toFixed(0) + '%'
    })),

    improvementAcrossWaves: waveDetails.length > 1
      ? calculateImprovement(waveDetails)
      : null
  };
}

/**
 * Calculate improvement in AUTO rate across waves
 * @param {Array} waveDetails - Wave details array
 * @returns {Object} Improvement metrics
 */
function calculateImprovement(waveDetails) {
  if (waveDetails.length < 2) return null;

  const firstWave = waveDetails[0];
  const lastWave = waveDetails[waveDetails.length - 1];

  const firstAutoRate = (firstWave.stats.auto / firstWave.transactionCount) * 100;
  const lastAutoRate = (lastWave.stats.auto / lastWave.transactionCount) * 100;

  return {
    firstWaveAutoRate: firstAutoRate.toFixed(1) + '%',
    lastWaveAutoRate: lastAutoRate.toFixed(1) + '%',
    improvement: (lastAutoRate - firstAutoRate).toFixed(1) + '%',
    improved: lastAutoRate > firstAutoRate
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  processInWaves,
  getWaveProcessingSummary,
  WAVE_CONFIG
};
