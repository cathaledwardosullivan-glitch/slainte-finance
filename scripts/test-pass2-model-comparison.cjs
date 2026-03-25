/**
 * Test Pass 2 Category Assignment — Model Comparison
 *
 * Runs the category assignment prompt against ground truth using
 * Haiku, Sonnet, and Opus, comparing accuracy at multiple thresholds.
 *
 * Usage: node scripts/test-pass2-model-comparison.cjs [haiku|sonnet|opus|all]
 * Default: runs all three models sequentially
 */

const engine = require('../electron/utils/categorizationBundle.cjs');
const { runConvergenceLoop } = require('../electron/utils/convergenceLoop.cjs');
const { buildCategoryPrompt, CATEGORY_AUTO_THRESHOLD, BATCH_SIZE } = require('../electron/utils/categoryAssignmentPass.cjs');
const { MODELS } = require('../electron/modelConfig.cjs');
const fs = require('fs');
const path = require('path');

// ============================================================================
// SETUP
// ============================================================================

const gt = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-data', 'ground-truth-2026-03-21-corrected.json'), 'utf8'));
const sectionToGroup = engine.SECTION_TO_GROUP;

// Run convergence to get the uncategorised set (same as Pass 1 tests)
const stripped = gt.transactions.map(t => ({
  id: t.id, details: t.details, debit: t.debit, credit: t.credit,
  amount: t.amount, type: t.type, isIncome: t.isIncome,
}));

const origLog = console.log;
console.log = () => {};
console.warn = () => {};
const convergenceResult = runConvergenceLoop(stripped, gt.categoryMapping, [], gt.practiceProfile);
console.log = origLog;
console.warn = origLog;

// Build corpus: convergence-categorised transactions with group assigned
const corpus = convergenceResult.categorized.filter(t => t.categoryCode).map(t => {
  const cat = gt.categoryMapping.find(c => c.code === t.categoryCode);
  const group = cat ? sectionToGroup[cat.section] : null;
  return { ...t, suggestedGroup: group };
}).filter(t => t.suggestedGroup);

origLog(`Corpus: ${corpus.length} categorised transactions with groups`);

// Simulate Pass 1 succeeded: assign correct group from ground truth
const testSet = convergenceResult.uncategorized.map(t => {
  const truth = gt.transactions.find(g => g.id === t.id);
  const cat = truth ? gt.categoryMapping.find(c => c.code === truth.categoryCode) : null;
  const group = cat ? sectionToGroup[cat.section] : null;
  return { ...t, suggestedGroup: group, groupConfirmed: true };
}).filter(t => t.suggestedGroup);

origLog(`\nTest set: ${testSet.length} transactions (uncategorised after convergence, with GT groups)`);

// Build ground truth lookup: txn id → { categoryCode, categoryName, group }
const truthMap = new Map();
for (const t of gt.transactions) {
  const cat = gt.categoryMapping.find(c => c.code === t.categoryCode);
  if (cat) {
    truthMap.set(t.id, {
      categoryCode: t.categoryCode,
      categoryName: cat.name,
      group: sectionToGroup[cat.section],
    });
  }
}

// Build category list per group (same as categoryAssignmentPass.cjs)
const categoriesByGroup = {};
for (const cat of gt.categoryMapping) {
  const group = sectionToGroup[cat.section];
  if (!group) continue;
  if (!categoriesByGroup[group]) categoriesByGroup[group] = [];
  if (!categoriesByGroup[group].find(c => c.code === cat.code)) {
    categoriesByGroup[group].push({
      code: cat.code,
      name: cat.name,
      section: cat.section,
      accountantLine: cat.accountantLine,
    });
  }
}

// Group test transactions by group
const byGroup = {};
for (const txn of testSet) {
  const g = txn.suggestedGroup;
  if (!byGroup[g]) byGroup[g] = [];
  byGroup[g].push(txn);
}

origLog('By group:');
Object.entries(byGroup).sort((a, b) => b[1].length - a[1].length).forEach(([g, txns]) => {
  const cats = categoriesByGroup[g] || [];
  origLog(`  ${g}: ${txns.length} txns, ${cats.length} categories`);
});

// Load API key
const userDataPath = path.join(process.env.APPDATA, 'slainte-finance-v2');
const storageData = JSON.parse(fs.readFileSync(path.join(userDataPath, 'localStorage.json'), 'utf8'));
const apiKey = storageData.claude_api_key;

if (!apiKey) {
  origLog('\nERROR: No API key found in localStorage.json');
  process.exit(1);
}

// ============================================================================
// API CALL (parameterised by model)
// ============================================================================

async function callAPI(model, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const usage = data.usage || {};

  const text = data.content?.[0]?.text || '';
  let jsonText = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1];

  const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
  if (jsonMatch) return { results: JSON.parse(jsonMatch[0]), usage };

  // Try salvaging truncated response
  const partial = jsonText.match(/\[[\s\S]*/);
  if (partial) {
    const lastComplete = partial[0].lastIndexOf('}');
    if (lastComplete > 0) {
      const salvaged = JSON.parse(partial[0].substring(0, lastComplete + 1) + ']');
      origLog(`  Salvaged ${salvaged.length} from truncated response`);
      return { results: salvaged, usage };
    }
  }

  throw new Error('Could not parse JSON from response');
}

// ============================================================================
// RUN TEST FOR ONE MODEL
// ============================================================================

async function runModelTest(modelId, modelName) {
  origLog(`\n${'='.repeat(70)}`);
  origLog(`MODEL: ${modelName} (${modelId})`);
  origLog('='.repeat(70));

  const allResults = []; // { txnId, predicted, truth, confidence, reasoning }
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let apiErrors = 0;

  for (const [groupCode, groupTxns] of Object.entries(byGroup)) {
    const groupDef = engine.GROUPS[groupCode];
    if (!groupDef) continue;
    const groupCategories = categoriesByGroup[groupCode] || [];
    if (groupCategories.length === 0) continue;

    // Batch within group
    for (let i = 0; i < groupTxns.length; i += BATCH_SIZE) {
      const batch = groupTxns.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(groupTxns.length / BATCH_SIZE);

      origLog(`  ${groupCode} batch ${batchNum}/${totalBatches}: ${batch.length} txns, ${groupCategories.length} cats`);

      try {
        const prompt = buildCategoryPrompt(batch, groupCode, groupDef.name, groupCategories, gt.practiceProfile, corpus, gt.categoryMapping);
        const { results: batchResults, usage } = await callAPI(modelId, prompt);

        totalInputTokens += usage.input_tokens || 0;
        totalOutputTokens += usage.output_tokens || 0;

        const respondedIndices = new Set();
        for (const r of batchResults) {
          const idx = r.index - 1;
          if (idx < 0 || idx >= batch.length) continue;
          respondedIndices.add(idx);

          const txn = batch[idx];
          const truth = truthMap.get(txn.id);

          // Validate category code is in group
          let predictedCode = r.categoryCode;
          if (predictedCode === 'UNCERTAIN') {
            allResults.push({
              txnId: txn.id,
              details: txn.details,
              group: groupCode,
              predicted: 'UNCERTAIN',
              truth: truth?.categoryCode,
              truthName: truth?.categoryName,
              confidence: 0,
              reasoning: r.reasoning,
            });
            continue;
          }

          const validCat = groupCategories.find(c => c.code === predictedCode);
          if (!validCat) {
            // Hallucinated code — mark as invalid
            allResults.push({
              txnId: txn.id,
              details: txn.details,
              group: groupCode,
              predicted: `INVALID:${predictedCode}`,
              truth: truth?.categoryCode,
              truthName: truth?.categoryName,
              confidence: r.confidence || 0,
              reasoning: r.reasoning,
            });
            continue;
          }

          allResults.push({
            txnId: txn.id,
            details: txn.details,
            group: groupCode,
            predicted: predictedCode,
            predictedName: validCat.name,
            truth: truth?.categoryCode,
            truthName: truth?.categoryName,
            confidence: r.confidence || 0,
            reasoning: r.reasoning,
          });
        }

        // Transactions not in response
        for (let j = 0; j < batch.length; j++) {
          if (!respondedIndices.has(j)) {
            const txn = batch[j];
            const truth = truthMap.get(txn.id);
            allResults.push({
              txnId: txn.id,
              details: txn.details,
              group: groupCode,
              predicted: 'SKIPPED',
              truth: truth?.categoryCode,
              truthName: truth?.categoryName,
              confidence: 0,
              reasoning: 'Not in AI response',
            });
          }
        }
      } catch (error) {
        origLog(`    ERROR: ${error.message}`);
        apiErrors += batch.length;
      }
    }
  }

  // ============================================================================
  // ANALYSIS
  // ============================================================================

  origLog(`\n--- Results for ${modelName} ---`);
  origLog(`Total tokens: ${totalInputTokens} in, ${totalOutputTokens} out`);
  origLog(`API errors: ${apiErrors}`);

  const uncertain = allResults.filter(r => r.predicted === 'UNCERTAIN').length;
  const invalid = allResults.filter(r => r.predicted?.startsWith('INVALID:')).length;
  const skipped = allResults.filter(r => r.predicted === 'SKIPPED').length;
  origLog(`Uncertain: ${uncertain}, Invalid codes: ${invalid}, Skipped: ${skipped}`);

  // Accuracy at multiple thresholds
  const thresholds = [0.90, 0.85, 0.82, 0.80, 0.70, 0.00];

  for (const threshold of thresholds) {
    const eligible = allResults.filter(r =>
      !r.predicted?.startsWith('INVALID:') &&
      r.predicted !== 'UNCERTAIN' &&
      r.predicted !== 'SKIPPED' &&
      r.confidence >= threshold
    );

    const correct = eligible.filter(r => r.predicted === r.truth).length;
    const wrong = eligible.length - correct;
    const pct = eligible.length > 0 ? (correct / eligible.length * 100).toFixed(1) : 'N/A';
    const coverage = (eligible.length / testSet.length * 100).toFixed(1);

    origLog(`\n  Threshold >= ${threshold}:`);
    origLog(`    Coverage: ${eligible.length}/${testSet.length} (${coverage}%)`);
    origLog(`    Correct:  ${correct}/${eligible.length} (${pct}%)`);
    origLog(`    Wrong:    ${wrong}`);

    // Show wrong details at the auto-confirm threshold
    if (threshold === CATEGORY_AUTO_THRESHOLD && wrong > 0) {
      origLog(`    --- Wrong at auto-confirm threshold (${CATEGORY_AUTO_THRESHOLD}) ---`);
      eligible.filter(r => r.predicted !== r.truth).forEach(r => {
        origLog(`      ${(r.details || '').substring(0, 40).padEnd(42)} AI: ${(r.predictedName || r.predicted).substring(0, 25).padEnd(27)} Truth: ${(r.truthName || r.truth).substring(0, 25).padEnd(27)} conf: ${r.confidence}`);
      });
    }
  }

  // Confidence distribution
  const confBands = { '0.95+': 0, '0.90-0.94': 0, '0.85-0.89': 0, '0.82-0.84': 0, '0.80-0.81': 0, '<0.80': 0 };
  const validResults = allResults.filter(r => !r.predicted?.startsWith('INVALID:') && r.predicted !== 'UNCERTAIN' && r.predicted !== 'SKIPPED');
  for (const r of validResults) {
    if (r.confidence >= 0.95) confBands['0.95+']++;
    else if (r.confidence >= 0.90) confBands['0.90-0.94']++;
    else if (r.confidence >= 0.85) confBands['0.85-0.89']++;
    else if (r.confidence >= 0.82) confBands['0.82-0.84']++;
    else if (r.confidence >= 0.80) confBands['0.80-0.81']++;
    else confBands['<0.80']++;
  }
  origLog('\n  Confidence distribution:');
  Object.entries(confBands).forEach(([b, c]) => origLog(`    ${b}: ${c}`));

  // Per-group accuracy
  origLog('\n  Per-group accuracy (all confidences):');
  for (const [groupCode, groupTxns] of Object.entries(byGroup).sort((a, b) => b[1].length - a[1].length)) {
    const groupResults = allResults.filter(r => r.group === groupCode && !r.predicted?.startsWith('INVALID:') && r.predicted !== 'UNCERTAIN' && r.predicted !== 'SKIPPED');
    const correct = groupResults.filter(r => r.predicted === r.truth).length;
    const pct = groupResults.length > 0 ? (correct / groupResults.length * 100).toFixed(1) : 'N/A';
    origLog(`    ${groupCode.padEnd(14)} ${correct}/${groupResults.length} (${pct}%)`);
  }

  return {
    model: modelName,
    modelId,
    totalResults: allResults.length,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    uncertain,
    invalid,
    allResults,
  };
}

// ============================================================================
// MAIN
// ============================================================================

const MODEL_MAP = {
  haiku:  { id: MODELS.FAST, name: 'Haiku' },
  sonnet: { id: MODELS.STANDARD, name: 'Sonnet' },
  opus:   { id: MODELS.STRATEGIC, name: 'Opus' },
};

(async () => {
  const arg = process.argv[2] || 'all';
  const modelsToTest = arg === 'all'
    ? ['haiku', 'sonnet', 'opus']
    : [arg];

  const summaries = [];

  for (const modelKey of modelsToTest) {
    const model = MODEL_MAP[modelKey];
    if (!model) {
      origLog(`Unknown model: ${modelKey}. Use haiku, sonnet, opus, or all.`);
      continue;
    }

    const result = await runModelTest(model.id, model.name);
    summaries.push(result);
  }

  // Comparison table
  if (summaries.length > 1) {
    origLog(`\n${'='.repeat(70)}`);
    origLog('COMPARISON SUMMARY');
    origLog('='.repeat(70));

    const header = 'Metric'.padEnd(30) + summaries.map(s => s.model.padEnd(15)).join('');
    origLog(header);
    origLog('-'.repeat(header.length));

    // Accuracy at auto-confirm threshold
    for (const threshold of [0.82, 0.85, 0.90]) {
      const row = `Accuracy >= ${threshold}`.padEnd(30);
      const values = summaries.map(s => {
        const eligible = s.allResults.filter(r =>
          !r.predicted?.startsWith('INVALID:') && r.predicted !== 'UNCERTAIN' && r.predicted !== 'SKIPPED' && r.confidence >= threshold
        );
        const correct = eligible.filter(r => r.predicted === r.truth).length;
        const pct = eligible.length > 0 ? `${(correct / eligible.length * 100).toFixed(1)}%` : 'N/A';
        return pct.padEnd(15);
      });
      origLog(row + values.join(''));
    }

    // Coverage at auto-confirm
    const coverRow = `Coverage >= ${CATEGORY_AUTO_THRESHOLD}`.padEnd(30);
    const coverValues = summaries.map(s => {
      const eligible = s.allResults.filter(r =>
        !r.predicted?.startsWith('INVALID:') && r.predicted !== 'UNCERTAIN' && r.predicted !== 'SKIPPED' && r.confidence >= CATEGORY_AUTO_THRESHOLD
      );
      return `${eligible.length}/${testSet.length}`.padEnd(15);
    });
    origLog(coverRow + coverValues.join(''));

    // Tokens
    const tokenRow = 'Total tokens'.padEnd(30);
    const tokenValues = summaries.map(s => `${s.inputTokens + s.outputTokens}`.padEnd(15));
    origLog(tokenRow + tokenValues.join(''));

    // Uncertain + invalid
    const issueRow = 'Uncertain + Invalid'.padEnd(30);
    const issueValues = summaries.map(s => `${s.uncertain + s.invalid}`.padEnd(15));
    origLog(issueRow + issueValues.join(''));
  }

  origLog('\nDone.');
})();
