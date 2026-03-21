/**
 * Ground Truth Test Harness for the Convergence Loop
 *
 * Loads categorized transactions, strips their categories, runs the engine,
 * and compares results against ground truth. Measures accuracy, coverage,
 * and convergence characteristics.
 *
 * Usage:
 *   node scripts/test-convergence-loop.cjs                    # All tests
 *   node scripts/test-convergence-loop.cjs --cold             # Cold start only
 *   node scripts/test-convergence-loop.cjs --warm             # Warm corpus only
 *   node scripts/test-convergence-loop.cjs --data path/to/ground-truth.json
 *   node scripts/test-convergence-loop.cjs --verbose          # Show per-transaction failures
 *   node scripts/test-convergence-loop.cjs --cold --opus      # Cold start with Opus pass (costs €)
 */

const fs = require('fs');
const path = require('path');

// Shared convergence loop and anomaly detection (single source of truth)
const { runConvergenceLoop, runAnomalyDetection } = require('../electron/utils/convergenceLoop.cjs');

// Opus deep analysis pass
const { shouldRunOpusPass, runOpusPass } = require('../electron/utils/opusAnalysisPass.cjs');

// --- Configuration ---

const CONFIDENCE_AUTO_THRESHOLD = 0.90;

// --- CLI Args ---

const args = process.argv.slice(2);
const coldOnly = args.includes('--cold');
const warmOnly = args.includes('--warm');
const verbose = args.includes('--verbose');
const withOpus = args.includes('--opus');
const dataIdx = args.indexOf('--data');

// --- Load Ground Truth ---

function findGroundTruth() {
  if (dataIdx !== -1 && args[dataIdx + 1]) {
    return path.resolve(args[dataIdx + 1]);
  }
  const testDataDir = path.join(__dirname, '..', 'test-data');
  if (!fs.existsSync(testDataDir)) {
    console.error('[test] No test-data/ directory found. Run: node scripts/export-ground-truth.cjs');
    process.exit(1);
  }
  const files = fs.readdirSync(testDataDir)
    .filter(f => f.startsWith('ground-truth-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) {
    console.error('[test] No ground-truth-*.json files found. Run: node scripts/export-ground-truth.cjs');
    process.exit(1);
  }
  return path.join(testDataDir, files[0]);
}

const groundTruthPath = findGroundTruth();
console.log(`[test] Loading ground truth from: ${groundTruthPath}`);
const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));

console.log(`[test] ${groundTruth.transactions.length} transactions, ${groundTruth.categoryMapping.length} categories`);
console.log(`[test] ${groundTruth.stats.categoriesWithIdentifiers} categories have identifiers`);
console.log('');

// --- Accuracy Evaluation ---

function evaluate(categorized, uncategorized, groundTruthMap, label) {
  const total = categorized.length + uncategorized.length;

  // Auto vs review based on confidence threshold
  const auto = categorized.filter(t => t.unifiedConfidence >= CONFIDENCE_AUTO_THRESHOLD);
  const review = categorized.filter(t => t.unifiedConfidence < CONFIDENCE_AUTO_THRESHOLD);

  // Accuracy: compare predicted category against ground truth
  let truePositives = 0;
  let falsePositives = 0;
  const failures = [];

  for (const txn of auto) {
    const truth = groundTruthMap.get(txn.id);
    if (!truth) continue;

    if (txn.categoryCode === truth.categoryCode) {
      truePositives++;
    } else {
      falsePositives++;
      failures.push({
        details: txn.details,
        predicted: `${txn.categoryCode} (${txn.categoryName})`,
        actual: `${truth.categoryCode} (${truth.categoryName})`,
        confidence: txn.unifiedConfidence.toFixed(3),
        pass: txn.convergencePass,
        iteration: txn.convergenceIteration,
      });
    }
  }

  const accuracy = auto.length > 0 ? truePositives / auto.length : 0;
  const fpRate = auto.length > 0 ? falsePositives / auto.length : 0;
  const coverageRate = total > 0 ? auto.length / total : 0;

  // Pass breakdown
  const byPass = {};
  for (const txn of categorized) {
    byPass[txn.convergencePass] = (byPass[txn.convergencePass] || 0) + 1;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Total transactions:        ${total}`);
  console.log(`  Auto-categorized (≥0.90):  ${auto.length} (${(coverageRate * 100).toFixed(1)}%)`);
  console.log(`  Needs review (<0.90):      ${review.length + uncategorized.length}`);
  console.log(`  Uncategorized (no match):  ${uncategorized.length}`);
  console.log('');
  console.log(`  Accuracy (auto-cat):       ${(accuracy * 100).toFixed(1)}%  (${truePositives}/${auto.length})`);
  console.log(`  False positive rate:       ${(fpRate * 100).toFixed(1)}%  (${falsePositives}/${auto.length})`);
  console.log('');
  console.log('  By pass:');
  for (const [pass, count] of Object.entries(byPass).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pass.padEnd(20)} ${count}`);
  }

  if (verbose && failures.length > 0) {
    console.log(`\n  Failures (${failures.length}):`);
    for (const f of failures.slice(0, 30)) {
      console.log(`    "${f.details.substring(0, 40).padEnd(40)}" → ${f.predicted}`);
      console.log(`${''.padEnd(48)}expected: ${f.actual}  [${f.pass}, iter ${f.iteration}, conf ${f.confidence}]`);
    }
    if (failures.length > 30) {
      console.log(`    ... and ${failures.length - 30} more`);
    }
  }

  return { total, auto: auto.length, accuracy, fpRate, coverageRate, failures };
}

// --- Test Runners ---

function stripCategories(transactions) {
  return transactions.map(t => ({
    id: t.id,
    date: t.date,
    details: t.details,
    debit: t.debit,
    credit: t.credit,
    amount: t.amount,
    type: t.type,
    isIncome: t.isIncome,
  }));
}

function buildGroundTruthMap(transactions) {
  const map = new Map();
  for (const t of transactions) {
    map.set(t.id, t);
  }
  return map;
}

async function runTest(label, incoming, categoryMapping, existingCorpus, practiceProfile, groundTruthMap, useOpus = false) {
  const start = Date.now();
  const result = runConvergenceLoop(incoming, categoryMapping, existingCorpus, practiceProfile);

  // Optional Opus pass
  let opusStats = null;
  if (useOpus && shouldRunOpusPass(incoming.length, result.uncategorized.length)) {
    const apiKey = loadApiKey();
    if (apiKey) {
      console.log(`\n  Running Opus pass on ${result.uncategorized.length} uncategorized transactions...`);
      const opusResult = await runOpusPass(
        result.uncategorized, result.categorized, categoryMapping, practiceProfile, apiKey
      );
      if (opusResult.results.length > 0) {
        const opusCategorizedIds = new Set(opusResult.results.map(r => r.id));
        result.uncategorized = result.uncategorized.filter(t => !opusCategorizedIds.has(t.id));
        result.categorized.push(...opusResult.results);

        // Post-AI cascade
        if (result.uncategorized.length > 0) {
          const cascadeCorpus = [...existingCorpus, ...result.categorized];
          const postAi = runConvergenceLoop(
            result.uncategorized, categoryMapping, cascadeCorpus, practiceProfile, { maxIterations: 3 }
          );
          if (postAi.categorized.length > 0) {
            for (const txn of postAi.categorized) txn.convergencePass = 'post_ai_cascade';
            result.categorized.push(...postAi.categorized);
            result.uncategorized = postAi.uncategorized;
          }
        }

        opusStats = {
          opusCategorized: opusResult.results.length,
          postAiCascade: result.categorized.filter(t => t.convergencePass === 'post_ai_cascade').length,
          skipped: opusResult.skipped,
        };
      }
      if (opusResult.error) {
        console.log(`  Opus error: ${opusResult.error}`);
      }
    } else {
      console.log('  Opus pass skipped: no API key found');
    }
  }

  const anomalies = runAnomalyDetection(result.categorized, categoryMapping, practiceProfile);
  const elapsed = Date.now() - start;

  const evalResult = evaluate(result.categorized, result.uncategorized, groundTruthMap, label);

  console.log('');
  console.log(`  Convergence: ${result.iterations} iteration(s), ${elapsed}ms`);
  for (const iter of result.passBreakdown) {
    console.log(`    Iter ${iter.iteration}: A=${iter.passA} B=${iter.passB} C=${iter.passC} D=${iter.passD} (total=${iter.total})`);
  }
  if (opusStats) {
    console.log(`  Opus pass: ${opusStats.opusCategorized} categorized, ${opusStats.postAiCascade} post-AI cascade`);
  }
  if (anomalies.demoted.length > 0) {
    console.log(`  Anomaly flags: ${anomalies.demoted.length} transactions flagged (advisory)`);
  }
  if (anomalies.warnings.length > 0) {
    anomalies.warnings.forEach(w => console.log(`  Warning: ${w}`));
  }

  return { ...evalResult, elapsed, iterations: result.iterations, anomaliesDemoted: anomalies.demoted.length, opusStats };
}

function loadApiKey() {
  try {
    const userDataPath = path.join(
      process.env.APPDATA || path.join(process.env.HOME, '.config'),
      'slainte-finance-v2'
    );
    const storagePath = path.join(userDataPath, 'localStorage.json');
    if (!fs.existsSync(storagePath)) return null;
    const data = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    return data.claude_api_key || null;
  } catch {
    return null;
  }
}

// --- Main ---

async function main() {
  const { transactions, categoryMapping, practiceProfile } = groundTruth;
  const groundTruthMap = buildGroundTruthMap(transactions);
  const stripped = stripCategories(transactions);

  // Suppress engine debug logging
  const originalLog = console.log;
  const originalWarn = console.warn;
  const suppressLog = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[Categorization]')) return;
    if (typeof args[0] === 'string' && args[0].startsWith('[Clustering]')) return;
    originalLog(...args);
  };

  const results = {};

  if (!warmOnly) {
    const testLabel = withOpus
      ? 'Test B: Cold Start — With Opus'
      : 'Test A: Cold Start — Deterministic Only';
    console.log = suppressLog;
    console.warn = () => {};
    results.cold = await runTest(
      testLabel,
      stripped,
      categoryMapping,
      [],
      practiceProfile,
      groundTruthMap,
      withOpus
    );
    console.log = originalLog;
    console.warn = originalWarn;
  }

  if (!coldOnly) {
    const shuffled = [...transactions].sort(() => Math.random() - 0.5);
    const splitIdx = Math.floor(shuffled.length * 0.7);
    const corpusTransactions = shuffled.slice(0, splitIdx);
    const testTransactions = shuffled.slice(splitIdx);
    const testStripped = stripCategories(testTransactions);
    const testGroundTruthMap = buildGroundTruthMap(testTransactions);

    const warmCorpus = corpusTransactions.map(t => ({
      ...t,
      category: categoryMapping.find(c => c.code === t.categoryCode),
      unifiedConfidence: t.unifiedConfidence || 0.95,
    }));

    const testLabel = withOpus
      ? `Test D: Warm Corpus — With Opus (${corpusTransactions.length} corpus, ${testTransactions.length} test)`
      : `Test C: Warm Corpus — Deterministic Only (${corpusTransactions.length} corpus, ${testTransactions.length} test)`;
    console.log = suppressLog;
    console.warn = () => {};
    results.warm = await runTest(
      testLabel,
      testStripped,
      categoryMapping,
      warmCorpus,
      practiceProfile,
      testGroundTruthMap,
      withOpus
    );
    console.log = originalLog;
    console.warn = originalWarn;
  }

  // --- Summary ---
  console.log(`\n${'='.repeat(60)}`);
  console.log('  SUMMARY');
  console.log(`${'='.repeat(60)}`);

  if (results.cold) {
    const r = results.cold;
    const label = withOpus ? 'Cold start (with Opus)' : 'Cold start (deterministic)';
    console.log(`\n  ${label}:`);
    console.log(`    Coverage:  ${(r.coverageRate * 100).toFixed(1)}%  | Accuracy: ${(r.accuracy * 100).toFixed(1)}%  | FP: ${(r.fpRate * 100).toFixed(1)}%  | ${r.elapsed}ms`);
    if (r.opusStats) {
      console.log(`    Opus: ${r.opusStats.opusCategorized} categorized, ${r.opusStats.postAiCascade} cascaded`);
    }
  }
  if (results.warm) {
    const r = results.warm;
    const label = withOpus ? 'Warm corpus (with Opus)' : 'Warm corpus (deterministic)';
    console.log(`\n  ${label}:`);
    console.log(`    Coverage:  ${(r.coverageRate * 100).toFixed(1)}%  | Accuracy: ${(r.accuracy * 100).toFixed(1)}%  | FP: ${(r.fpRate * 100).toFixed(1)}%  | ${r.elapsed}ms`);
    if (r.opusStats) {
      console.log(`    Opus: ${r.opusStats.opusCategorized} categorized, ${r.opusStats.postAiCascade} cascaded`);
    }
  }

  console.log(`\n  Targets from plan:`);
  console.log(`    Auto-cat rate (cold, with AI):        > 80%`);
  console.log(`    Auto-cat rate (warm):                 > 90%`);
  console.log(`    Accuracy of auto-categorized:         > 95%`);
  console.log(`    False positive rate:                  < 2%`);
  console.log(`    User decisions (cold, 1000 txns):     < 40`);
  console.log(`    User decisions (warm, 500 txns):      < 15`);
  console.log('');
}

main().catch(err => {
  console.error('Test harness error:', err);
  process.exit(1);
});
