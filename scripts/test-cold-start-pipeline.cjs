/**
 * True Cold Start Pipeline Test
 *
 * Simulates a brand new user with:
 * - Only default (hardcoded) identifiers from categoryMappings.js
 * - Practice profile data (staff names, consultation fee)
 * - Opus group-level assignment (few-shot, 0.85 threshold)
 * - Similarity-based group propagation for remaining transactions
 *
 * Measures: how many transactions get a reliable group assignment
 * before the user answers any questions.
 */

const engine = require('../electron/utils/categorizationBundle.cjs');
const { MODELS } = require('../electron/modelConfig.cjs');
const fs = require('fs');
const path = require('path');

// ============================================================================
// LOAD DATA
// ============================================================================

const gt = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'test-data', 'ground-truth-2026-03-21-corrected.json'), 'utf8'
));

// Load DEFAULT category mappings (what ships with the app, no user-learned identifiers)
// Exported as JSON from src/data/categoryMappings.js (ESM) for CJS compatibility
const defaultMappingPath = path.join(__dirname, '..', 'test-data', 'default-category-mapping.json');
if (!fs.existsSync(defaultMappingPath)) {
  console.error('Default category mapping not found. Run:');
  console.error('  node --input-type=module -e "import {CATEGORY_MAPPING} from \'./src/data/categoryMappings.js\'; import {writeFileSync} from \'fs\'; writeFileSync(\'test-data/default-category-mapping.json\', JSON.stringify(CATEGORY_MAPPING, null, 2));"');
  process.exit(1);
}
const defaultMapping = JSON.parse(fs.readFileSync(defaultMappingPath, 'utf8'));

// Count identifiers
const defaultIdCount = defaultMapping.reduce((sum, c) => sum + (c.identifiers?.length || 0), 0);
const userIdCount = gt.categoryMapping.reduce((sum, c) => sum + (c.identifiers?.length || 0), 0);
console.log(`Default identifiers: ${defaultIdCount} (across ${defaultMapping.filter(c => c.identifiers?.length > 0).length} categories)`);
console.log(`User-learned identifiers: ${userIdCount} (across ${gt.categoryMapping.filter(c => c.identifiers?.length > 0).length} categories)`);
console.log(`Transactions: ${gt.transactions.length}`);

// ============================================================================
// STEP 1: IDENTIFIER MATCHING (default identifiers only)
// ============================================================================

console.log('\n=== STEP 1: Default Identifier Matching ===');

const identifierIndex = engine.buildIdentifierIndex(defaultMapping);
const sectionToGroup = engine.SECTION_TO_GROUP;

const step1Matched = [];
const step1Unmatched = [];

for (const txn of gt.transactions) {
  const stripped = {
    id: txn.id, details: txn.details, debit: txn.debit, credit: txn.credit,
    amount: txn.amount, type: txn.type, isIncome: txn.isIncome,
  };

  const match = engine.findIdentifierMatch(stripped.details, identifierIndex);
  if (match) {
    const catCode = match.categories[0]?.categoryCode;
    const cat = defaultMapping.find(c => c.code === catCode);
    const group = sectionToGroup[cat?.section] || 'UNKNOWN';
    step1Matched.push({
      ...stripped,
      categoryCode: catCode,
      categoryName: cat?.name,
      group,
      matchSource: 'identifier',
    });
  } else {
    step1Unmatched.push(stripped);
  }
}

console.log(`Matched: ${step1Matched.length} (${(step1Matched.length / gt.transactions.length * 100).toFixed(1)}%)`);
console.log(`Unmatched: ${step1Unmatched.length}`);

// ============================================================================
// STEP 2: PRACTICE PROFILE MATCHING (staff names, fees)
// ============================================================================

console.log('\n=== STEP 2: Practice Profile Matching ===');

const profile = gt.practiceProfile;
const staffNames = [];
if (Array.isArray(profile?.staff?.staffDetails)) {
  for (const staff of profile.staff.staffDetails) {
    if (staff.name) staffNames.push(staff.name.toUpperCase());
  }
}
const consultationFee = profile?.privatePatients?.averageConsultationFee;

console.log(`Staff names: ${staffNames.length} (${staffNames.slice(0, 5).join(', ')}${staffNames.length > 5 ? '...' : ''})`);
console.log(`Consultation fee: €${consultationFee || 'none'}`);

const step2Matched = [];
const step2Unmatched = [];

for (const txn of step1Unmatched) {
  const detailsUpper = txn.details.toUpperCase();

  // Check staff names
  const staffMatch = staffNames.find(name => {
    // Match on surname (last word of name) or full name
    const parts = name.split(/\s+/);
    const surname = parts[parts.length - 1];
    return detailsUpper.includes(name) || (surname.length >= 4 && detailsUpper.includes(surname));
  });

  if (staffMatch) {
    step2Matched.push({
      ...txn,
      group: 'STAFF',
      matchSource: 'profile_staff',
      matchDetail: staffMatch,
    });
    continue;
  }

  // Check consultation fee (income transactions with exact amount match)
  if (consultationFee && txn.isIncome) {
    const credit = parseFloat(txn.credit) || 0;
    if (credit > 0 && Math.abs(credit - consultationFee) < 0.01) {
      step2Matched.push({
        ...txn,
        group: 'INCOME',
        matchSource: 'profile_fee',
      });
      continue;
    }
  }

  // Income type detection (all credits → INCOME group)
  if (txn.isIncome || txn.type === 'income') {
    step2Matched.push({
      ...txn,
      group: 'INCOME',
      matchSource: 'type_income',
    });
    continue;
  }

  step2Unmatched.push(txn);
}

console.log(`Matched: ${step2Matched.length} (staff: ${step2Matched.filter(t => t.matchSource === 'profile_staff').length}, fee: ${step2Matched.filter(t => t.matchSource === 'profile_fee').length}, income type: ${step2Matched.filter(t => t.matchSource === 'type_income').length})`);
console.log(`Remaining: ${step2Unmatched.length}`);

// ============================================================================
// STEP 3: OPUS GROUP-LEVEL ASSIGNMENT
// ============================================================================

console.log('\n=== STEP 3: Opus Group-Level Assignment ===');

// Build group descriptions
const groupCategories = {};
for (const cat of defaultMapping) {
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

// Practice profile for prompt
const profileLines = [];
if (profile?.practiceDetails?.practiceName) profileLines.push(`Practice: ${profile.practiceDetails.practiceName}`);
const gpCount = Array.isArray(profile?.gps) ? profile.gps.length : 0;
if (gpCount > 0) profileLines.push(`GPs: ${gpCount}`);
if (Array.isArray(profile?.staff?.staffDetails) && profile.staff.staffDetails.length > 0) {
  profileLines.push(`Staff: ${profile.staff.staffDetails.length} (${profile.staff.staffDetails.map(s => s.name || s.role).join(', ')})`);
}
if (consultationFee) profileLines.push(`Consultation fee: €${consultationFee}`);

function buildGroupPrompt(transactions) {
  const txnList = transactions.map((t, i) => {
    const type = t.isIncome || t.type === 'income' ? 'CREDIT' : 'DEBIT';
    const amount = Math.abs(t.amount || t.debit || t.credit || 0);
    return `${i + 1}. [${type}] €${amount.toFixed(2)} | "${t.details}"`;
  }).join('\n');

  return `You are analysing bank transactions from an Irish GP practice.

PRACTICE PROFILE:
${profileLines.join('\n')}

AVAILABLE GROUPS (with the categories each contains):

${groupLines}

You may also respond with UNCERTAIN if you cannot determine the group with reasonable confidence.

EXAMPLES:
1. [DEBIT] €2.59 | "NEPOSCHGUSD 000002.59" → {"group": "PROFESSIONAL", "confidence": 0.95, "reasoning": "NEPOSCHG = Non-Euro POS Charge, a bank foreign exchange fee"}
2. [CREDIT] €180.00 | "2000124130/INV/DPR SP" → {"group": "INCOME", "confidence": 0.90, "reasoning": "DPR/INV reference with round amount — insurance report payment to the practice"}
3. [CREDIT] €1103.74 | "01-101020003806672 SP" → {"group": "INCOME", "confidence": 0.85, "reasoning": "Account transfer credit ending in SP — incoming payment, likely patient or insurance income"}
4. [DEBIT] €120.00 | "POS04FEB THE FRUIT PE" → {"group": "OTHER", "confidence": 0.85, "reasoning": "The Fruit People — fruit delivery for staff kitchen, sundry business expense"}
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

const userDataPath = path.join(process.env.APPDATA, 'slainte-finance-v2');
const apiKey = JSON.parse(fs.readFileSync(path.join(userDataPath, 'localStorage.json'), 'utf8')).claude_api_key;

async function callOpusBatch(transactions) {
  const prompt = buildGroupPrompt(transactions);
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
  if (data.usage) console.log(`  Tokens: ${data.usage.input_tokens} in, ${data.usage.output_tokens} out`);

  const text = data.content?.[0]?.text || '';
  let jsonText = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1];

  const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);

  const partial = jsonText.match(/\[[\s\S]*/);
  if (partial) {
    const lastComplete = partial[0].lastIndexOf('}');
    return JSON.parse(partial[0].substring(0, lastComplete + 1) + ']');
  }
  throw new Error('Could not parse Opus response');
}

(async () => {
  const BATCH_SIZE = 100;
  const opusResults = [];

  for (let i = 0; i < step2Unmatched.length; i += BATCH_SIZE) {
    const batch = step2Unmatched.slice(i, i + BATCH_SIZE);
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} transactions...`);
    const batchResults = await callOpusBatch(batch);
    for (const r of batchResults) {
      r.index = r.index + i; // Adjust to global index
    }
    opusResults.push(...batchResults);
  }

  const OPUS_THRESHOLD = 0.85;
  const step3Matched = [];
  const step3Unmatched = [];
  const step3Uncertain = [];

  for (const r of opusResults) {
    const idx = r.index - 1;
    if (idx < 0 || idx >= step2Unmatched.length) continue;
    const txn = step2Unmatched[idx];

    if (r.group === 'UNCERTAIN') {
      step3Uncertain.push({ ...txn, opusReasoning: r.reasoning });
    } else if (r.confidence >= OPUS_THRESHOLD) {
      step3Matched.push({
        ...txn,
        group: r.group,
        opusConfidence: r.confidence,
        matchSource: 'opus_group',
        opusReasoning: r.reasoning,
      });
    } else {
      step3Unmatched.push({
        ...txn,
        opusSuggestedGroup: r.group,
        opusConfidence: r.confidence,
        opusReasoning: r.reasoning,
      });
    }
  }

  console.log(`Matched (>=${OPUS_THRESHOLD}): ${step3Matched.length}`);
  console.log(`Below threshold: ${step3Unmatched.length}`);
  console.log(`Uncertain: ${step3Uncertain.length}`);

  // ============================================================================
  // STEP 4: SIMILARITY-BASED GROUP PROPAGATION
  // ============================================================================

  console.log('\n=== STEP 4: Similarity-Based Group Propagation ===');

  // Build corpus from all group-assigned transactions so far
  const groupCorpus = [
    ...step1Matched,
    ...step2Matched,
    ...step3Matched,
  ];

  console.log(`Group corpus size: ${groupCorpus.length}`);

  // For each remaining unmatched transaction, find similar transactions in corpus
  // and inherit the group from the best match
  const step4Matched = [];
  const step4Unmatched = [];

  const toMatch = [...step3Unmatched, ...step3Uncertain];

  for (const txn of toMatch) {
    const similar = engine.findSimilarCategorizedTransactions(
      txn,
      groupCorpus,
      0.70 // minSimilarity
    );

    if (similar && similar.length > 0) {
      // Use calculateUnifiedConfidence with group-level identifiers
      const bestGroup = similar[0].group;

      // Get identifiers for the suggested group
      const groupIdentifierIndex = engine.buildGroupIdentifierIndex(defaultMapping);
      const groupIds = groupIdentifierIndex.get(bestGroup);
      const identifiersList = groupIds ? Array.from(groupIds) : [];

      const confidence = engine.calculateUnifiedConfidence(
        txn.details,
        similar,
        identifiersList,
        { existingTransactionsCount: groupCorpus.length }
      );

      const confValue = typeof confidence === 'object' ? confidence.confidence : confidence;

      // Group consensus from similar matches
      const agreeing = similar.filter(s => s.group === bestGroup).length;
      const consensus = agreeing / similar.length;

      // Combined: use the higher of unified confidence or raw similarity × consensus
      const rawScore = similar[0].similarity * consensus;
      const finalScore = Math.max(confValue, rawScore);

      if (finalScore >= 0.80) { // Slightly lower threshold for propagation
        step4Matched.push({
          ...txn,
          group: bestGroup,
          similarityScore: finalScore,
          matchSource: 'similarity_group',
          bestMatchDetails: similar[0].details?.substring(0, 40),
        });
      } else {
        step4Unmatched.push({
          ...txn,
          bestSimilarGroup: bestGroup,
          bestSimilarScore: finalScore,
        });
      }
    } else {
      step4Unmatched.push(txn);
    }
  }

  console.log(`Matched: ${step4Matched.length}`);
  console.log(`Still unmatched: ${step4Unmatched.length}`);

  // ============================================================================
  // EVALUATION
  // ============================================================================

  console.log('\n=== PIPELINE SUMMARY ===');

  const allAssigned = [...step1Matched, ...step2Matched, ...step3Matched, ...step4Matched];
  const totalTxns = gt.transactions.length;

  console.log(`\nTotal transactions: ${totalTxns}`);
  console.log(`\nStep 1 (Identifiers):     ${step1Matched.length.toString().padStart(5)} (${(step1Matched.length / totalTxns * 100).toFixed(1)}%)`);
  console.log(`Step 2 (Profile/Type):    ${step2Matched.length.toString().padStart(5)} (${(step2Matched.length / totalTxns * 100).toFixed(1)}%)`);
  console.log(`Step 3 (Opus >=0.85):     ${step3Matched.length.toString().padStart(5)} (${(step3Matched.length / totalTxns * 100).toFixed(1)}%)`);
  console.log(`Step 4 (Similarity):      ${step4Matched.length.toString().padStart(5)} (${(step4Matched.length / totalTxns * 100).toFixed(1)}%)`);
  console.log(`─────────────────────────────────`);
  console.log(`Total assigned:           ${allAssigned.length.toString().padStart(5)} (${(allAssigned.length / totalTxns * 100).toFixed(1)}%)`);
  console.log(`Remaining for user:       ${step4Unmatched.length.toString().padStart(5)} (${(step4Unmatched.length / totalTxns * 100).toFixed(1)}%)`);

  // Group-level accuracy
  let groupCorrect = 0, groupWrong = 0;
  const wrongByStep = { identifier: 0, profile: 0, opus: 0, similarity: 0 };

  for (const txn of allAssigned) {
    const truth = gt.transactions.find(t => t.id === txn.id);
    if (!truth) continue;
    const truthCat = gt.categoryMapping.find(c => c.code === truth.categoryCode);
    const truthGroup = truthCat?.section ? sectionToGroup[truthCat.section] : null;

    if (txn.group === truthGroup) {
      groupCorrect++;
    } else {
      groupWrong++;
      const source = txn.matchSource.startsWith('profile') || txn.matchSource === 'type_income' ? 'profile' :
        txn.matchSource === 'opus_group' ? 'opus' :
        txn.matchSource === 'similarity_group' ? 'similarity' : 'identifier';
      wrongByStep[source]++;
    }
  }

  console.log(`\nGroup-level accuracy: ${groupCorrect}/${allAssigned.length} (${(groupCorrect / allAssigned.length * 100).toFixed(1)}%)`);
  console.log(`Wrong: ${groupWrong} (identifier: ${wrongByStep.identifier}, profile: ${wrongByStep.profile}, opus: ${wrongByStep.opus}, similarity: ${wrongByStep.similarity})`);

  // What's left for the user?
  console.log(`\n=== REMAINING FOR USER REVIEW ===`);
  console.log(`${step4Unmatched.length} transactions need group assignment`);

  // Cluster the remaining for strategic handover
  if (step4Unmatched.length > 0) {
    const clusters = engine.clusterSimilarTransactions(step4Unmatched);
    const multiClusters = clusters.filter(c => c.size > 1);
    const singletons = clusters.filter(c => c.size === 1);

    console.log(`Clusters: ${multiClusters.length} multi-transaction, ${singletons.length} singletons`);
    console.log(`User decisions needed: ~${multiClusters.length + singletons.length} (1 per cluster)`);

    if (multiClusters.length > 0) {
      console.log('\nLargest clusters:');
      multiClusters.sort((a, b) => b.size - a.size).slice(0, 10).forEach(c => {
        const opus = c.representative.opusSuggestedGroup || c.representative.opusReasoning ? ` (Opus suggested: ${c.representative.opusSuggestedGroup || 'uncertain'})` : '';
        console.log(`  ×${c.size} "${c.representative.details?.substring(0, 45)}"${opus}`);
      });
    }
  }
})();
