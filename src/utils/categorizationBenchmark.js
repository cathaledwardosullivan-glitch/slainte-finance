/**
 * Categorization Benchmark Utility
 *
 * Tests the new categorization engine against existing verified transactions
 * to measure accuracy before full deployment.
 *
 * Usage (in browser console):
 *   import { runBenchmark } from './utils/categorizationBenchmark';
 *   const results = runBenchmark(transactions, categoryMapping);
 *   console.table(results.summary);
 */

import {
  categorizeTransactionBatch,
  analyzeIdentifierQuality,
  GROUPS,
  CONFIDENCE_THRESHOLDS
} from './categorizationEngine';

/**
 * Run benchmark comparing new engine results to existing categorizations
 * @param {Array} transactions - Existing transactions with category field
 * @param {Array} categoryMapping - Category definitions
 * @returns {Object} Benchmark results with accuracy metrics
 */
export function runBenchmark(transactions, categoryMapping) {
  console.log('🔬 Running categorization benchmark...');
  console.log(`   Transactions: ${transactions.length}`);
  console.log(`   Categories: ${categoryMapping.length}`);

  const startTime = performance.now();

  // Run new engine on all transactions
  const { results, stats } = categorizeTransactionBatch(transactions, categoryMapping);

  const endTime = performance.now();
  const duration = endTime - startTime;

  // Compare results to existing categorizations
  const comparison = results.map(result => {
    const existingCategory = result.category; // From original transaction
    const newCategory = result.category;      // From new engine (same field, overwritten)

    // Get the original category from the transaction before we overwrote it
    // We need to compare result.categoryCode with what was originally there
    const originalCategoryCode = transactions.find(t => t.id === result.id)?.category?.code;

    return {
      id: result.id,
      details: result.details?.substring(0, 50),

      // Original
      originalCategoryCode,
      originalType: transactions.find(t => t.id === result.id)?.category?.type,

      // New engine results
      newType: result.type,
      newGroup: result.group,
      newCategoryCode: result.categoryCode,
      newGroupConfidence: result.groupConfidence,
      newCategoryConfidence: result.categoryConfidence,

      // Match analysis
      typeMatch: result.type === (transactions.find(t => t.id === result.id)?.category?.type),
      categoryMatch: result.categoryCode === originalCategoryCode,

      // Cohorts
      groupCohort: result.groupCohort,
      categoryCohort: result.categoryCohort
    };
  });

  // Calculate accuracy metrics
  const withOriginalCategory = comparison.filter(c => c.originalCategoryCode);
  const typeMatches = comparison.filter(c => c.typeMatch).length;
  const categoryMatches = withOriginalCategory.filter(c => c.categoryMatch).length;

  const mismatches = withOriginalCategory.filter(c => !c.categoryMatch);

  const summary = {
    // Overall
    totalTransactions: transactions.length,
    processingTimeMs: Math.round(duration),
    transactionsPerSecond: Math.round(transactions.length / (duration / 1000)),

    // Type accuracy (comparing income/expense)
    typeAccuracy: `${((typeMatches / comparison.length) * 100).toFixed(1)}%`,

    // Category accuracy (only for transactions that had categories)
    transactionsWithCategories: withOriginalCategory.length,
    categoryMatches,
    categoryAccuracy: withOriginalCategory.length > 0
      ? `${((categoryMatches / withOriginalCategory.length) * 100).toFixed(1)}%`
      : 'N/A',

    // Cohort distribution
    ...stats
  };

  // Analyze mismatches
  const mismatchAnalysis = mismatches.slice(0, 20).map(m => ({
    details: m.details,
    expected: m.originalCategoryCode,
    got: m.newCategoryCode,
    confidence: `${(m.newCategoryConfidence * 100).toFixed(0)}%`,
    cohort: m.categoryCohort
  }));

  // Analyze identifier quality
  const identifierQuality = analyzeIdentifierQuality(categoryMapping);

  console.log('\n📊 BENCHMARK RESULTS');
  console.log('====================');
  console.log(`Processing time: ${summary.processingTimeMs}ms (${summary.transactionsPerSecond} tx/sec)`);
  console.log(`Type accuracy: ${summary.typeAccuracy}`);
  console.log(`Category accuracy: ${summary.categoryAccuracy} (${categoryMatches}/${withOriginalCategory.length})`);
  console.log('\nCohort distribution (Group level):');
  console.log(`  - Auto (≥90%): ${stats.groupAuto}`);
  console.log(`  - AI Assist (50-90%): ${stats.groupAiAssist}`);
  console.log(`  - Review (<50%): ${stats.groupReview}`);
  console.log(`  - Conflicts: ${stats.groupConflicts}`);
  console.log('\nCohort distribution (Category level):');
  console.log(`  - Auto (≥90%): ${stats.categoryAuto}`);
  console.log(`  - AI Assist (50-90%): ${stats.categoryAiAssist}`);
  console.log(`  - Review (<50%): ${stats.categoryReview}`);
  console.log(`  - Conflicts: ${stats.categoryConflicts}`);
  console.log('\nIdentifier quality issues:');
  console.log(`  - Duplicates: ${identifierQuality.duplicates.length}`);
  console.log(`  - Conflicts: ${identifierQuality.conflicts.length}`);
  console.log(`  - Too brief: ${identifierQuality.tooBrief.length}`);

  if (mismatchAnalysis.length > 0) {
    console.log('\n❌ Sample mismatches (first 20):');
    console.table(mismatchAnalysis);
  }

  return {
    summary,
    stats,
    comparison,
    mismatches: mismatchAnalysis,
    identifierQuality,
    rawResults: results
  };
}

/**
 * Analyze confidence distribution
 * @param {Array} results - Results from categorizeTransactionBatch
 * @returns {Object} Confidence distribution analysis
 */
export function analyzeConfidenceDistribution(results) {
  const groupConfidences = results.map(r => r.groupConfidence);
  const categoryConfidences = results.map(r => r.categoryConfidence);

  const distribution = (values, label) => {
    const ranges = [
      { name: '0-10%', min: 0, max: 0.1 },
      { name: '10-30%', min: 0.1, max: 0.3 },
      { name: '30-50%', min: 0.3, max: 0.5 },
      { name: '50-70%', min: 0.5, max: 0.7 },
      { name: '70-90%', min: 0.7, max: 0.9 },
      { name: '90-100%', min: 0.9, max: 1.01 }
    ];

    return ranges.map(range => ({
      range: range.name,
      count: values.filter(v => v >= range.min && v < range.max).length,
      percentage: `${((values.filter(v => v >= range.min && v < range.max).length / values.length) * 100).toFixed(1)}%`
    }));
  };

  return {
    group: distribution(groupConfidences, 'Group'),
    category: distribution(categoryConfidences, 'Category')
  };
}

/**
 * Export benchmark results as CSV for analysis
 * @param {Array} comparison - Comparison results from runBenchmark
 * @returns {string} CSV string
 */
export function exportBenchmarkCSV(comparison) {
  const headers = [
    'ID', 'Details', 'Original Category', 'New Category', 'Match',
    'New Type', 'New Group', 'Group Confidence', 'Category Confidence',
    'Group Cohort', 'Category Cohort'
  ];

  const rows = comparison.map(c => [
    c.id,
    `"${(c.details || '').replace(/"/g, '""')}"`,
    c.originalCategoryCode || '',
    c.newCategoryCode || '',
    c.categoryMatch ? 'YES' : 'NO',
    c.newType,
    c.newGroup || '',
    (c.newGroupConfidence * 100).toFixed(0),
    (c.newCategoryConfidence * 100).toFixed(0),
    c.groupCohort,
    c.categoryCohort
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Quick test function to verify engine is working
 * @param {Array} categoryMapping - Category definitions
 */
export function quickTest(categoryMapping) {
  const testTransactions = [
    { id: 'test1', details: 'SALARY PAYMENT SANDRA', debit: 2500, credit: 0 },
    { id: 'test2', details: 'ESB ELECTRICITY BILL', debit: 150, credit: 0 },
    { id: 'test3', details: 'GMS PAYMENT PCRS', debit: 0, credit: 5000 },
    { id: 'test4', details: 'SHELL GARAGE FUEL', debit: 80, credit: 0 },
    { id: 'test5', details: 'RANDOM UNKNOWN VENDOR', debit: 100, credit: 0 }
  ];

  console.log('🧪 Quick test with sample transactions:');

  const { results } = categorizeTransactionBatch(testTransactions, categoryMapping);

  results.forEach(r => {
    console.log(`\n"${r.details}"`);
    console.log(`  Type: ${r.type} (${(r.typeConfidence * 100).toFixed(0)}%)`);
    console.log(`  Group: ${r.group || 'none'} (${(r.groupConfidence * 100).toFixed(0)}%) - ${r.groupCohort}`);
    console.log(`  Category: ${r.categoryCode || 'none'} (${(r.categoryConfidence * 100).toFixed(0)}%) - ${r.categoryCohort}`);
    if (r.groupMatchedIdentifier) {
      console.log(`  Matched on: "${r.groupMatchedIdentifier}"`);
    }
  });
}
