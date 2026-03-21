/**
 * Test Opus group-level classification with enriched group descriptions.
 * Includes category lists and guidance for each group.
 */

const engine = require('../electron/utils/categorizationBundle.cjs');
const { runConvergenceLoop } = require('../electron/utils/convergenceLoop.cjs');
const { MODELS } = require('../electron/modelConfig.cjs');
const fs = require('fs');
const path = require('path');

const gt = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-data', 'ground-truth-2026-03-21-corrected.json'), 'utf8'));
const stripped = gt.transactions.map(t => ({
  id: t.id, details: t.details, debit: t.debit, credit: t.credit,
  amount: t.amount, type: t.type, isIncome: t.isIncome,
}));

// Run convergence to get uncategorized set
const origLog = console.log;
const origWarn = console.warn;
console.log = () => {};
console.warn = () => {};
const result = runConvergenceLoop(stripped, gt.categoryMapping, [], gt.practiceProfile);
console.log = origLog;
console.warn = origWarn;

const uncategorized = result.uncategorized;
console.log('Uncategorized:', uncategorized.length);

// Build rich group descriptions from category mapping
const sectionToGroup = engine.SECTION_TO_GROUP;
const groupCategories = {};
for (const cat of gt.categoryMapping) {
  const group = sectionToGroup[cat.section];
  if (!group) continue;
  if (!groupCategories[group]) groupCategories[group] = [];
  groupCategories[group].push(cat.name);
}

const groups = engine.GROUPS;
const groupLines = Object.entries(groups).map(([key, g]) => {
  const cats = [...new Set(groupCategories[key] || [])];
  return `${key}: ${g.name}\n  Categories include: ${cats.length > 0 ? cats.join(', ') : 'none defined'}`;
}).join('\n\n');

// Format transactions
const txnList = uncategorized.map((t, i) => {
  const type = t.isIncome || t.type === 'income' ? 'CREDIT' : 'DEBIT';
  const amount = Math.abs(t.amount || t.debit || t.credit || 0);
  return `${i + 1}. [${type}] €${amount.toFixed(2)} | "${t.details}"`;
}).join('\n');

const prompt = `You are analysing bank transactions from an Irish GP practice.

AVAILABLE GROUPS (with the categories each contains):

${groupLines}

IMPORTANT GUIDANCE:
- Bank charges, card processing fees, and foreign exchange charges (e.g. NEPOSCHG) belong to PROFESSIONAL (which contains Bank Charges and Card Processing Fees categories)
- Staff meals, gifts, fruit deliveries, catering, and sundry purchases belong to OTHER (Petty Cash / Other), NOT to PREMISES
- PREMISES is strictly for rent, rates, utilities (electricity/gas/water), cleaning services, building insurance, and building maintenance/repairs only
- NON_BUSINESS is ONLY for clearly personal expenses with absolutely no business justification (e.g. personal holidays). Staff gifts and staff social events are business expenses (OTHER), not personal.
- Software subscriptions and IT costs belong to OFFICE
- Professional body memberships, CPD, conferences, and journal subscriptions belong to PROFESSIONAL

TRANSACTIONS TO CLASSIFY BY GROUP:
${txnList}

For each transaction, assign it to the most appropriate GROUP. Respond with a JSON array:
[{"index": 1, "group": "GROUP_KEY", "confidence": 0.95, "reasoning": "brief"}]

Respond ONLY with the JSON array.`;

// Load API key
const userDataPath = path.join(process.env.APPDATA, 'slainte-finance-v2');
const apiKey = JSON.parse(fs.readFileSync(path.join(userDataPath, 'localStorage.json'), 'utf8')).claude_api_key;

(async () => {
  console.log('Calling Opus with enriched group descriptions...');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELS.STRATEGIC,
      max_tokens: 8192,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  if (data.usage) console.log('Tokens — input:', data.usage.input_tokens, 'output:', data.usage.output_tokens);

  const text = data.content?.[0]?.text || '';

  // Parse JSON
  let jsonText = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1];

  let results;
  const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    results = JSON.parse(jsonMatch[0]);
  } else {
    const partial = jsonText.match(/\[[\s\S]*/);
    if (partial) {
      const lastComplete = partial[0].lastIndexOf('}');
      results = JSON.parse(partial[0].substring(0, lastComplete + 1) + ']');
      console.log('Salvaged', results.length, 'from truncated response');
    } else {
      console.error('Could not parse response:', text.substring(0, 200));
      process.exit(1);
    }
  }

  console.log('Results:', results.length);

  // Evaluate
  let correct = 0, wrong = 0, highConfCorrect = 0, highConfTotal = 0;
  const wrongExamples = [];

  for (const r of results) {
    const idx = r.index - 1;
    if (idx < 0 || idx >= uncategorized.length) continue;
    const txn = uncategorized[idx];
    const truth = gt.transactions.find(t => t.id === txn.id);
    if (!truth) continue;
    const truthCat = gt.categoryMapping.find(c => c.code === truth.categoryCode);
    const truthGroup = truthCat?.section ? sectionToGroup[truthCat.section] : null;

    if (r.confidence >= 0.80) highConfTotal++;
    if (r.group === truthGroup) {
      correct++;
      if (r.confidence >= 0.80) highConfCorrect++;
    } else {
      wrong++;
      wrongExamples.push({
        details: txn.details?.substring(0, 40),
        opus: r.group,
        truth: truthGroup,
        truthSection: truthCat?.section,
        conf: r.confidence,
        reason: (r.reasoning || '').substring(0, 80),
      });
    }
  }

  console.log('\n=== GROUP-LEVEL ACCURACY (enriched prompt) ===');
  console.log('Correct:', correct, '/', correct + wrong, '(' + (correct / (correct + wrong) * 100).toFixed(1) + '%)');
  console.log('Wrong:', wrong);
  console.log('High conf (>=0.80):', highConfCorrect + '/' + highConfTotal,
    '(' + (highConfTotal > 0 ? (highConfCorrect / highConfTotal * 100).toFixed(1) : 'N/A') + '%)');

  // Compare to previous run
  console.log('\nPrevious run (bare groups): 51.2% overall, 97.8% high-conf');

  const confBands = { '0.90+': 0, '0.80-0.89': 0, '0.70-0.79': 0, '<0.70': 0 };
  results.forEach(r => {
    if (r.confidence >= 0.90) confBands['0.90+']++;
    else if (r.confidence >= 0.80) confBands['0.80-0.89']++;
    else if (r.confidence >= 0.70) confBands['0.70-0.79']++;
    else confBands['<0.70']++;
  });
  console.log('\nConfidence distribution:');
  Object.entries(confBands).forEach(([b, c]) => console.log(' ', b + ':', c));

  if (wrongExamples.length > 0) {
    console.log('\nWrong assignments (' + wrongExamples.length + '):');
    wrongExamples.forEach(e => {
      console.log(' ', e.details.padEnd(42), 'Opus:', e.opus.padEnd(14), 'Truth:', (e.truth || '?').padEnd(14), 'conf:', e.conf);
      console.log('  ', e.reason);
    });
  }
})();
