/**
 * Opus 4.6 Deep Analysis Pass
 *
 * Runs after the deterministic convergence loop when a significant number
 * of transactions remain uncategorized (typically first-time users with thin corpus).
 *
 * The Opus call receives:
 * - Practice profile context
 * - Summary of what the engine already categorized (financial shape)
 * - Available categories with descriptions
 * - The uncategorized transactions needing analysis
 *
 * Opus reasons structurally about the practice's finances rather than
 * categorizing each transaction in isolation.
 */

const { MODELS } = require('../modelConfig.cjs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPUS_TRIGGER_PERCENT = 0.15; // >15% uncategorized
const OPUS_TRIGGER_ABSOLUTE = 50;  // OR >50 uncategorized
const MAX_TRANSACTIONS_PER_CALL = 500;

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
 * Build the categorization summary from already-categorized transactions.
 * Groups by category and provides counts + average amounts.
 */
function buildCategorizationSummary(categorized) {
  const groups = new Map();
  for (const txn of categorized) {
    if (!txn.categoryCode) continue;
    const key = `${txn.categoryCode} ${txn.categoryName || 'Unknown'}`;
    if (!groups.has(key)) {
      groups.set(key, { code: txn.categoryCode, name: txn.categoryName, count: 0, totalAmount: 0 });
    }
    const group = groups.get(key);
    group.count++;
    group.totalAmount += Math.abs(txn.amount || txn.debit || txn.credit || 0);
  }

  return Array.from(groups.values())
    .sort((a, b) => b.count - a.count)
    .map(g => {
      const avg = g.count > 0 ? g.totalAmount / g.count : 0;
      return `- ${g.count}× ${g.name} (code: ${g.code}, avg €${avg.toFixed(0)}, total €${g.totalAmount.toFixed(0)})`;
    })
    .join('\n');
}

/**
 * Build the available categories list, grouped by section.
 */
function buildCategoryList(categoryMapping) {
  const sections = new Map();
  for (const cat of categoryMapping) {
    const section = cat.section || 'OTHER';
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section).push(cat);
  }

  const lines = [];
  for (const [section, cats] of sections) {
    lines.push(`\n[${section}]`);
    for (const cat of cats) {
      const desc = cat.description ? ` — ${cat.description}` : '';
      lines.push(`  ${cat.code}: ${cat.name}${desc}`);
    }
  }
  return lines.join('\n');
}

/**
 * Format uncategorized transactions for the prompt.
 */
function formatUncategorizedTransactions(transactions) {
  return transactions.map((t, i) => {
    const type = t.isIncome || t.type === 'income' ? 'CREDIT' : 'DEBIT';
    const amount = Math.abs(t.amount || t.debit || t.credit || 0);
    const date = t.date ? new Date(t.date).toISOString().split('T')[0] : 'unknown';
    return `${i + 1}. [${type}] €${amount.toFixed(2)} | ${date} | "${t.details}"`;
  }).join('\n');
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
    lines.push(`Staff: ${staffDetails.length} (${staffDetails.map(s => s.role || 'staff').join(', ')})`);
  }

  const fee = practiceProfile?.privatePatients?.averageConsultationFee;
  if (fee) lines.push(`Consultation fee: €${fee}`);

  return lines.length > 0 ? lines.join('\n') : 'No practice profile available';
}

/**
 * Build the full Opus prompt.
 */
function buildOpusPrompt(uncategorized, categorized, categoryMapping, practiceProfile) {
  const profileContext = buildProfileContext(practiceProfile);
  const catSummary = buildCategorizationSummary(categorized);
  const categoryList = buildCategoryList(categoryMapping);
  const txnList = formatUncategorizedTransactions(uncategorized);

  return `You are analysing bank transactions from an Irish GP practice.

PRACTICE PROFILE:
${profileContext}

ALREADY CATEGORIZED BY OUR ENGINE (for context — do not re-categorize these):
${catSummary}

AVAILABLE CATEGORIES:
${categoryList}

UNCATEGORIZED TRANSACTIONS NEEDING YOUR ANALYSIS:
${txnList}

For each transaction, respond with a JSON array. Each element:
{
  "index": <1-based index from the list above>,
  "categoryCode": "<best matching category code>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>"
}

Guidelines:
- Use your knowledge of Irish businesses, banks, and GP practice operations.
- Reason structurally — identify patterns across transactions (recurring payments, related vendors, salary vs locum patterns) rather than categorizing each in isolation.
- Cross-reference against the already-categorized data to identify what roles are filled and what expenses are accounted for.
- If you cannot determine a category with reasonable confidence, set confidence below 0.5 and explain why.
- "SEPA DD" means direct debit (usually an expense). "SP" at the end usually means standing payment (can be income or expense).
- Account transfer references like "01-101020003806672 SP" are payments to/from other accounts — categorize based on the amount pattern and context.

Respond ONLY with the JSON array, no other text.`;
}

// ============================================================================
// API CALL
// ============================================================================

/**
 * Call the Opus API.
 * @param {string} apiKey
 * @param {string} prompt
 * @returns {Promise<Array<{index, categoryCode, confidence, reasoning}>>}
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
      max_tokens: 16384,
      temperature: 0.2, // Low temperature for consistent categorization
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

  // Parse the response
  const text = data.content?.[0]?.text || '';

  // Extract JSON array from response (may be wrapped in markdown code blocks)
  // Try raw extraction first, then strip code fences
  let jsonText = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1];
  }

  const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    // If response was truncated (hit max_tokens), try to salvage partial results
    const partialMatch = jsonText.match(/\[[\s\S]*/);
    if (partialMatch) {
      // Find last complete JSON object in the truncated array
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

  return JSON.parse(jsonMatch[0]);
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Run the Opus deep analysis pass on uncategorized transactions.
 *
 * @param {Array} uncategorized - Transactions that the convergence loop couldn't categorize
 * @param {Array} categorized - Transactions that were categorized (for context)
 * @param {Array} categoryMapping - Full category mapping
 * @param {Object} practiceProfile - Practice profile
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<{results: Array, skipped: number, error: string|null}>}
 */
async function runOpusPass(uncategorized, categorized, categoryMapping, practiceProfile, apiKey) {
  if (!apiKey) {
    return { results: [], skipped: uncategorized.length, error: 'No API key available' };
  }

  // Limit to MAX_TRANSACTIONS_PER_CALL — send largest clusters first
  let toAnalyze = uncategorized;
  let skipped = 0;
  if (uncategorized.length > MAX_TRANSACTIONS_PER_CALL) {
    toAnalyze = uncategorized.slice(0, MAX_TRANSACTIONS_PER_CALL);
    skipped = uncategorized.length - MAX_TRANSACTIONS_PER_CALL;
    console.log(`[OpusPass] Limiting to ${MAX_TRANSACTIONS_PER_CALL} transactions (${skipped} skipped)`);
  }

  console.log(`[OpusPass] Analyzing ${toAnalyze.length} uncategorized transactions with ${MODELS.STRATEGIC}`);

  const prompt = buildOpusPrompt(toAnalyze, categorized, categoryMapping, practiceProfile);

  try {
    const opusResults = await callOpus(apiKey, prompt);

    // Map Opus results back to transactions
    const enriched = [];
    for (const result of opusResults) {
      const idx = result.index - 1; // 1-based to 0-based
      if (idx < 0 || idx >= toAnalyze.length) continue;

      const txn = toAnalyze[idx];
      const cat = categoryMapping.find(c => c.code === result.categoryCode);

      enriched.push({
        ...txn,
        categoryCode: result.categoryCode,
        categoryName: cat?.name || result.categoryCode,
        category: cat,
        unifiedConfidence: Math.min(result.confidence, 0.95), // Cap at 0.95 — AI is not certain
        convergencePass: 'opus_ai',
        opusReasoning: result.reasoning,
      });
    }

    console.log(`[OpusPass] Opus categorized ${enriched.length} of ${toAnalyze.length} transactions`);

    return { results: enriched, skipped, error: null };
  } catch (error) {
    console.error('[OpusPass] Error:', error.message);
    return { results: [], skipped: uncategorized.length, error: error.message };
  }
}

module.exports = {
  shouldRunOpusPass,
  runOpusPass,
  buildOpusPrompt,
  OPUS_TRIGGER_PERCENT,
  OPUS_TRIGGER_ABSOLUTE,
};
