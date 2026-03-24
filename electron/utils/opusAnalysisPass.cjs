/**
 * Opus 4.6 Group-Level Analysis Pass
 *
 * Runs after the deterministic convergence loop when a significant number
 * of transactions remain uncategorized (typically first-time users with thin corpus).
 *
 * TWO-PASS ARCHITECTURE:
 *   Pass 1 (this file): Assigns one of 10 GROUPS to each transaction.
 *     Groups are sufficient for the dashboard and financial overview.
 *   Pass 2 (future): Assigns specific CATEGORIES within confirmed groups.
 *     Triggered on-demand when detailed reports (P&L) are needed.
 *
 * Group-first approach tested at 99.2% accuracy (>=0.85 threshold) vs ~72%
 * for category-level assignment. See scripts/test-opus-group-fewshot.cjs.
 */

const { MODELS } = require('../modelConfig.cjs');

// Bundled engine — we need GROUPS, SECTION_TO_GROUP for building the prompt
const engine = require('./categorizationBundle.cjs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPUS_TRIGGER_PERCENT = 0.15; // >15% uncategorized
const OPUS_TRIGGER_ABSOLUTE = 50;  // OR >50 uncategorized
const BATCH_SIZE = 100;            // Optimal batch size (avoids lazy LLM at 500)
const GROUP_AUTO_THRESHOLD = 0.85; // Auto-confirm group at this confidence

// ============================================================================
// TRIGGER CHECK
// ============================================================================

/**
 * Should the Opus pass run?
 * @param {number} totalTransactions
 * @param {number} uncategorizedCount
 * @returns {boolean}
 */
function shouldRunOpusPass(totalTransactions, uncategorizedCount) {
  if (uncategorizedCount === 0) return false;
  const percentUncategorized = uncategorizedCount / totalTransactions;
  return percentUncategorized > OPUS_TRIGGER_PERCENT || uncategorizedCount > OPUS_TRIGGER_ABSOLUTE;
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

/**
 * Build group descriptions with their categories for the prompt.
 * This is the critical element — without category lists, accuracy was 51.2%.
 */
function buildGroupLines(categoryMapping) {
  const sectionToGroup = engine.SECTION_TO_GROUP;
  const groups = engine.GROUPS;

  // Build category lists per group
  const groupCategories = {};
  for (const cat of categoryMapping) {
    const group = sectionToGroup[cat.section];
    if (!group) continue;
    if (!groupCategories[group]) groupCategories[group] = [];
    groupCategories[group].push(cat.name);
  }

  return Object.entries(groups).map(([key, g]) => {
    const cats = [...new Set(groupCategories[key] || [])];
    return `${key}: ${g.name}\n  Categories include: ${cats.length > 0 ? cats.join(', ') : 'none defined'}`;
  }).join('\n\n');
}

/**
 * Build the practice profile context section.
 */
function buildProfileContext(practiceProfile) {
  const lines = [];

  if (practiceProfile?.practiceDetails) {
    const pd = practiceProfile.practiceDetails;
    if (pd.practiceName) lines.push(`Practice: ${pd.practiceName}`);
    if (pd.location) lines.push(`Location: ${pd.location}`);
  }

  const gpCount = Array.isArray(practiceProfile?.gps) ? practiceProfile.gps.length : 0;
  if (gpCount > 0) lines.push(`GPs: ${gpCount}`);

  const staffDetails = practiceProfile?.staff?.staffDetails;
  if (Array.isArray(staffDetails) && staffDetails.length > 0) {
    lines.push(`Staff: ${staffDetails.length} (${staffDetails.map(s => s.name || s.role || 'staff').join(', ')})`);
  }

  const fee = practiceProfile?.privatePatients?.averageConsultationFee;
  if (fee) lines.push(`Consultation fee: €${fee}`);

  return lines.length > 0 ? lines.join('\n') : 'No practice profile available';
}

/**
 * Format transactions for the prompt.
 */
function formatTransactions(transactions) {
  return transactions.map((t, i) => {
    const type = t.isIncome || t.type === 'income' ? 'CREDIT' : 'DEBIT';
    const amount = Math.abs(t.amount || t.debit || t.credit || 0);
    return `${i + 1}. [${type}] €${amount.toFixed(2)} | "${t.details}"`;
  }).join('\n');
}

/**
 * Build the group-level Opus prompt with few-shot examples.
 */
function buildOpusPrompt(transactions, categoryMapping, practiceProfile) {
  const profileContext = buildProfileContext(practiceProfile);
  const groupLines = buildGroupLines(categoryMapping);
  const txnList = formatTransactions(transactions);

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

// ============================================================================
// API CALL
// ============================================================================

/**
 * Call the Opus API for a single batch.
 * @param {string} apiKey
 * @param {string} prompt
 * @returns {Promise<Array<{index, group, confidence, reasoning}>>}
 */
async function callOpus(apiKey, prompt) {
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

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Opus API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();

  if (data.usage) {
    console.log(`[OpusPass] Token usage — input: ${data.usage.input_tokens}, output: ${data.usage.output_tokens}`);
  }

  // Parse the response — extract JSON array, handling code fences and truncation
  const text = data.content?.[0]?.text || '';
  let jsonText = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1];
  }

  const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);

  // Try salvaging truncated response
  const partialMatch = jsonText.match(/\[[\s\S]*/);
  if (partialMatch) {
    const partial = partialMatch[0];
    const lastComplete = partial.lastIndexOf('}');
    if (lastComplete > 0) {
      const salvaged = partial.substring(0, lastComplete + 1) + ']';
      try {
        const results = JSON.parse(salvaged);
        console.log(`[OpusPass] Salvaged ${results.length} results from truncated response`);
        return results;
      } catch {
        // Fall through to error
      }
    }
  }

  console.error('[OpusPass] Could not extract JSON from response:', text.substring(0, 200));
  throw new Error('Opus response did not contain a valid JSON array');
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Run the Opus group-level analysis pass on uncategorized transactions.
 *
 * Returns transactions enriched with group assignments:
 * - suggestedGroup: GROUP_KEY (e.g. "PROFESSIONAL", "INCOME")
 * - opusGroupConfidence: 0.0 to 1.0
 * - opusReasoning: brief explanation
 * - groupConfirmed: true if confidence >= GROUP_AUTO_THRESHOLD (auto-assigned)
 *
 * @param {Array} uncategorized - Transactions the convergence loop couldn't categorize
 * @param {Array} categoryMapping - Full category mapping (for building group descriptions)
 * @param {Object} practiceProfile - Practice profile
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<{results: Array, uncertain: Array, skipped: number, error: string|null}>}
 */
async function runOpusPass(uncategorized, categoryMapping, practiceProfile, apiKey) {
  if (!apiKey) {
    return { results: [], uncertain: [], skipped: uncategorized.length, error: 'No API key available' };
  }

  console.log(`[OpusPass] Analyzing ${uncategorized.length} uncategorized transactions with ${MODELS.STRATEGIC} (group-level)`);

  const allResults = [];
  const allUncertain = [];
  let skipped = 0;

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < uncategorized.length; i += BATCH_SIZE) {
    const batch = uncategorized.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(uncategorized.length / BATCH_SIZE);

    console.log(`[OpusPass] Batch ${batchNum}/${totalBatches}: ${batch.length} transactions`);

    try {
      const prompt = buildOpusPrompt(batch, categoryMapping, practiceProfile);
      const batchResults = await callOpus(apiKey, prompt);

      // Map results back to transactions
      for (const result of batchResults) {
        const idx = result.index - 1; // 1-based to 0-based
        if (idx < 0 || idx >= batch.length) continue;

        const txn = batch[idx];

        if (result.group === 'UNCERTAIN') {
          allUncertain.push({
            ...txn,
            suggestedGroup: null,
            opusGroupConfidence: 0,
            opusReasoning: result.reasoning || 'Opus could not determine group',
            groupConfirmed: false,
            convergencePass: 'opus_group',
            categoryMatchType: 'finn-background',
          });
        } else {
          const confidence = Math.min(result.confidence, 0.98); // Cap — AI is not certain
          const confirmed = confidence >= GROUP_AUTO_THRESHOLD;

          allResults.push({
            ...txn,
            suggestedGroup: result.group,
            opusGroupConfidence: confidence,
            opusReasoning: result.reasoning,
            groupConfirmed: confirmed,
            convergencePass: 'opus_group',
            categoryMatchType: 'finn-background',
          });
        }
      }

      // Check for transactions in this batch that weren't in the response
      const respondedIndices = new Set(batchResults.map(r => r.index - 1));
      for (let j = 0; j < batch.length; j++) {
        if (!respondedIndices.has(j)) {
          skipped++;
          allUncertain.push({
            ...batch[j],
            suggestedGroup: null,
            opusGroupConfidence: 0,
            opusReasoning: 'Not included in Opus response',
            groupConfirmed: false,
            convergencePass: 'opus_group',
            categoryMatchType: 'finn-background',
          });
        }
      }
    } catch (error) {
      console.error(`[OpusPass] Batch ${batchNum} error:`, error.message);
      // Mark entire batch as uncertain on error
      for (const txn of batch) {
        allUncertain.push({
          ...txn,
          suggestedGroup: null,
          opusGroupConfidence: 0,
          opusReasoning: `Opus error: ${error.message}`,
          groupConfirmed: false,
          convergencePass: 'opus_group',
          categoryMatchType: 'finn-background',
        });
      }
      skipped += batch.length;
    }
  }

  const confirmed = allResults.filter(r => r.groupConfirmed).length;
  const hinted = allResults.filter(r => !r.groupConfirmed).length;
  console.log(`[OpusPass] Complete: ${confirmed} auto-confirmed, ${hinted} hints, ${allUncertain.length} uncertain, ${skipped} skipped`);

  return { results: allResults, uncertain: allUncertain, skipped, error: null };
}

module.exports = {
  shouldRunOpusPass,
  runOpusPass,
  buildOpusPrompt,
  buildGroupLines,
  GROUP_AUTO_THRESHOLD,
  OPUS_TRIGGER_PERCENT,
  OPUS_TRIGGER_ABSOLUTE,
  BATCH_SIZE,
};
