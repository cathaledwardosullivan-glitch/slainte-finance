/**
 * Test Opus group-level classification with:
 * - Few-shot examples
 * - Escape hatch (UNCERTAIN)
 * - 100 transactions per batch
 * - Practice profile context
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
console.log = () => {};
console.warn = () => {};
const result = runConvergenceLoop(stripped, gt.categoryMapping, [], gt.practiceProfile);
console.log = origLog;
console.warn = origLog;

const uncategorized = result.uncategorized;
origLog('Uncategorized:', uncategorized.length);

// Build group descriptions with categories
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

// Build practice profile context
const profile = gt.practiceProfile;
const profileLines = [];
if (profile?.practiceDetails?.practiceName) profileLines.push(`Practice: ${profile.practiceDetails.practiceName}`);
const gpCount = Array.isArray(profile?.gps) ? profile.gps.length : 0;
if (gpCount > 0) profileLines.push(`GPs: ${gpCount}`);
const staffDetails = profile?.staff?.staffDetails;
if (Array.isArray(staffDetails) && staffDetails.length > 0) {
  profileLines.push(`Staff: ${staffDetails.length} (${staffDetails.map(s => s.name || s.role || 'staff').join(', ')})`);
}
if (profile?.privatePatients?.averageConsultationFee) {
  profileLines.push(`Consultation fee: €${profile.privatePatients.averageConsultationFee}`);
}
const profileContext = profileLines.length > 0 ? profileLines.join('\n') : 'No profile available';

// Build the prompt
function buildPrompt(transactions) {
  const txnList = transactions.map((t, i) => {
    const type = t.isIncome || t.type === 'income' ? 'CREDIT' : 'DEBIT';
    const amount = Math.abs(t.amount || t.debit || t.credit || 0);
    return `${i + 1}. [${type}] €${amount.toFixed(2)} | "${t.details}"`;
  }).join('\n');

  return `You are analysing bank transactions from an Irish GP practice.

PRACTICE PROFILE:
${profileContext}

AVAILABLE GROUPS (with the categories each contains):

${groupLines}

You may also respond with UNCERTAIN if you cannot determine the group with reasonable confidence.

EXAMPLES:
1. [DEBIT] €2.59 | "NEPOSCHGUSD 000002.59" → {"group": "PROFESSIONAL", "confidence": 0.95, "reasoning": "NEPOSCHG = Non-Euro POS Charge, a bank foreign exchange fee"}
2. [CREDIT] €180.00 | "2000124130/INV/DPR SP" → {"group": "INCOME", "confidence": 0.90, "reasoning": "DPR/INV reference with round amount — insurance report payment to the practice"}
3. [CREDIT] €1103.74 | "01-101020003806672 SP" → {"group": "INCOME", "confidence": 0.85, "reasoning": "Account transfer credit ending in SP — incoming payment, likely patient or insurance income"}
4. [DEBIT] €120.00 | "POS04FEB THE FRUIT PE" → {"group": "OTHER", "confidence": 0.85, "reasoning": "The Fruit People — fruit delivery service for staff kitchen, sundry business expense"}
5. [DEBIT] €100.00 | "Eurofins Biom SEPA DD" → {"group": "MEDICAL", "confidence": 0.90, "reasoning": "Eurofins Biomnis — Irish laboratory services provider, medical supplies"}
6. [DEBIT] €99.63 | "BRIGHTHR SEPA DD" → {"group": "OFFICE", "confidence": 0.90, "reasoning": "BrightHR — HR management software platform, software subscription"}
7. [DEBIT] €750.00 | "TO COMFORT AIR CONDIT" → {"group": "PREMISES", "confidence": 0.90, "reasoning": "Comfort Air Conditioning — HVAC maintenance for practice premises"}
8. [DEBIT] €213.50 | "POS24JUN Brown Thomas" → {"group": "OTHER", "confidence": 0.80, "reasoning": "Department store — likely staff gift or practice event purchase, sundry business expense"}

KEY RULES:
- NEPOSCHG* (foreign exchange charges) → PROFESSIONAL (Bank Charges category)
- Staff meals, gifts, fruit deliveries, department store purchases → OTHER, not PREMISES or NON_BUSINESS
- PREMISES is strictly: rent, rates, utilities, cleaning, building insurance, building maintenance/repairs
- NON_BUSINESS is ONLY for partner drawings and clearly personal expenses. Staff gifts and social events are OTHER.
- Foreign currency recurring subscriptions (USD/GBP amounts) → default to OFFICE unless vendor is clearly a professional body
- Credits ending in "SP" from account references → INCOME
- If genuinely uncertain, respond with "UNCERTAIN" rather than guessing

TRANSACTIONS TO CLASSIFY:
${txnList}

For each transaction, respond with a JSON array:
[{"index": 1, "group": "GROUP_KEY", "confidence": 0.95, "reasoning": "1-2 sentences"}]

Respond ONLY with the JSON array.`;
}

// Load API key
const userDataPath = path.join(process.env.APPDATA, 'slainte-finance-v2');
const apiKey = JSON.parse(fs.readFileSync(path.join(userDataPath, 'localStorage.json'), 'utf8')).claude_api_key;

async function callOpusBatch(transactions) {
  const prompt = buildPrompt(transactions);
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
  if (data.usage) origLog(`  Tokens: ${data.usage.input_tokens} in, ${data.usage.output_tokens} out`);

  const text = data.content?.[0]?.text || '';
  let jsonText = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1];

  const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);

  // Try salvaging truncated response
  const partial = jsonText.match(/\[[\s\S]*/);
  if (partial) {
    const lastComplete = partial[0].lastIndexOf('}');
    const salvaged = JSON.parse(partial[0].substring(0, lastComplete + 1) + ']');
    origLog(`  Salvaged ${salvaged.length} from truncated response`);
    return salvaged;
  }

  throw new Error('Could not parse response');
}

(async () => {
  // Batch into chunks of 100
  const BATCH_SIZE = 100;
  const allResults = [];

  for (let i = 0; i < uncategorized.length; i += BATCH_SIZE) {
    const batch = uncategorized.slice(i, i + BATCH_SIZE);
    origLog(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} transactions...`);
    const batchResults = await callOpusBatch(batch);

    // Adjust indices to be global
    for (const r of batchResults) {
      r.index = r.index + i; // Convert from batch-local to global
    }
    allResults.push(...batchResults);
  }

  origLog('\nTotal results:', allResults.length);

  // Count UNCERTAIN
  const uncertain = allResults.filter(r => r.group === 'UNCERTAIN');
  origLog('UNCERTAIN:', uncertain.length);

  // Evaluate at multiple thresholds
  const thresholds = [0.90, 0.85, 0.80, 0.70];

  for (const threshold of thresholds) {
    let correct = 0, wrong = 0, total = 0;
    const wrongDetails = [];

    for (const r of allResults) {
      if (r.group === 'UNCERTAIN') continue;
      if (r.confidence < threshold) continue;
      total++;
      const idx = r.index - 1; // 1-based to 0-based
      if (idx < 0 || idx >= uncategorized.length) continue;
      const txn = uncategorized[idx];
      const truth = gt.transactions.find(t => t.id === txn.id);
      if (!truth) continue;
      const truthCat = gt.categoryMapping.find(c => c.code === truth.categoryCode);
      const truthGroup = truthCat?.section ? sectionToGroup[truthCat.section] : null;

      if (r.group === truthGroup) {
        correct++;
      } else {
        wrong++;
        wrongDetails.push({
          details: txn.details?.substring(0, 40),
          opus: r.group,
          truth: truthGroup,
          conf: r.confidence,
          reason: (r.reasoning || '').substring(0, 80),
        });
      }
    }

    origLog(`\nThreshold >= ${threshold}:`);
    origLog(`  Count: ${total} / ${allResults.length} (${(total / allResults.length * 100).toFixed(1)}%)`);
    origLog(`  Correct: ${correct} / ${total} (${total > 0 ? (correct / total * 100).toFixed(1) : 'N/A'}%)`);
    origLog(`  Wrong: ${wrong}`);

    if (threshold === 0.85 && wrongDetails.length > 0) {
      origLog('  Wrong at >= 0.85:');
      wrongDetails.forEach(e => {
        origLog(`    ${e.details.padEnd(42)} Opus: ${e.opus.padEnd(14)} Truth: ${(e.truth || '?').padEnd(14)} conf: ${e.conf}`);
        origLog(`      ${e.reason}`);
      });
    }
  }

  // Show uncertain transactions
  if (uncertain.length > 0) {
    origLog('\nUNCERTAIN transactions:');
    uncertain.forEach(r => {
      const idx = r.index - 1;
      if (idx >= 0 && idx < uncategorized.length) {
        origLog(`  ${uncategorized[idx].details?.substring(0, 45)} — ${r.reasoning || 'no reason'}`);
      }
    });
  }

  // Confidence distribution
  const confBands = { '0.90+': 0, '0.85-0.89': 0, '0.80-0.84': 0, '0.70-0.79': 0, '<0.70': 0, 'UNCERTAIN': uncertain.length };
  allResults.forEach(r => {
    if (r.group === 'UNCERTAIN') return;
    if (r.confidence >= 0.90) confBands['0.90+']++;
    else if (r.confidence >= 0.85) confBands['0.85-0.89']++;
    else if (r.confidence >= 0.80) confBands['0.80-0.84']++;
    else if (r.confidence >= 0.70) confBands['0.70-0.79']++;
    else confBands['<0.70']++;
  });
  origLog('\nConfidence distribution:');
  Object.entries(confBands).forEach(([b, c]) => origLog(`  ${b}: ${c}`));
})();
