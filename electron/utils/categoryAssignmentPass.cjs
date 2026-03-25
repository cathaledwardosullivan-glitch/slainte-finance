/**
 * Pass 2: Category Assignment Within Confirmed Groups
 *
 * After Pass 1 assigns one of 10 GROUPS to every transaction, Pass 2
 * assigns a specific CATEGORY within each group. The narrowed option space
 * (6-10 categories per group vs 125 total) dramatically improves accuracy.
 *
 * Pipeline:
 *   1. Skip transactions that already have a categoryCode (identifier/cascade matches)
 *   2. Deterministic similarity within group (cheap, instant)
 *   3. AI call per group with narrowed category list + corpus examples + domain hints
 *   4. Remaining → review panel with category picker filtered by group
 *
 * Called on-demand: manual button, Finn suggestion, or report gate.
 */

const { MODELS } = require('../modelConfig.cjs');

const engine = require('./categorizationBundle.cjs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CATEGORY_AUTO_THRESHOLD = 0.85; // Auto-confirm category at this confidence (matches Pass 1)
const BATCH_SIZE = 80;                // Smaller batches — prompts are more focused
const SIMILARITY_THRESHOLD = 0.80;    // Minimum similarity for deterministic match
const MAX_EXAMPLES_PER_CATEGORY = 2;  // Dynamic few-shot examples from corpus

// ============================================================================
// SIMILARITY WITHIN GROUP
// ============================================================================

/**
 * Try to assign categories by similarity matching against already-categorised
 * transactions within the same group. This is free and instant.
 *
 * @param {Array} uncategorised - Transactions with group but no category
 * @param {Array} corpus - All transactions with both group AND category
 * @returns {{ matched: Array, remaining: Array }}
 */
function runSimilarityWithinGroup(uncategorised, corpus) {
  const matched = [];
  const remaining = [];

  // Index corpus by group for fast lookup
  const corpusByGroup = {};
  for (const t of corpus) {
    const g = t.suggestedGroup || t.groupCode;
    if (!g || !t.categoryCode) continue;
    if (!corpusByGroup[g]) corpusByGroup[g] = [];
    corpusByGroup[g].push(t);
  }

  for (const txn of uncategorised) {
    const group = txn.suggestedGroup;
    const groupCorpus = corpusByGroup[group];

    if (!groupCorpus || groupCorpus.length === 0) {
      remaining.push(txn);
      continue;
    }

    // Find best match within this group's corpus
    const txnClean = engine.cleanForSimilarity(txn.details || '');
    let bestMatch = null;
    let bestScore = 0;

    for (const ref of groupCorpus) {
      const refClean = engine.cleanForSimilarity(ref.details || '');
      const score = engine.calculateSimilarity(txnClean, refClean);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ref;
      }
    }

    if (bestMatch && bestScore >= SIMILARITY_THRESHOLD) {
      matched.push({
        ...txn,
        categoryCode: bestMatch.categoryCode,
        categoryName: bestMatch.categoryName,
        categorySection: bestMatch.categorySection || bestMatch.section,
        categoryCohort: 'auto',
        categoryConfidence: bestScore,
        categoryMatchType: 'similarity-within-group',
        convergencePass: 'pass2_similarity',
      });
    } else {
      remaining.push(txn);
    }
  }

  return { matched, remaining };
}

// ============================================================================
// GROUP-SPECIFIC DOMAIN HINTS
// ============================================================================

const GROUP_HINTS = {
  INCOME: `- PCRS payments always contain "HSE PCRS" or "PCRS" in the description. They are large monthly payments (typically €10,000+).
- DSP payments contain "DSP-" in the description.
- Generic bank account transfers (numeric format like "01-1010200...SP") without any institution marker are most commonly direct patient fee payments — the default for unidentifiable credits.
- Insurance/medicolegal reports: "Claims" with "HEAL" suffix = health insurer claim settlement. "INV/DPR" = invoice/doctor payment report from an insurer. "IEL1" suffix = Irish Life insurance.
- State contracts (HSE non-PCRS): contain "HSE" but NOT "PCRS", or reference specific contract numbers.
- When in doubt between Patient Fees and PCRS: if there is no "PCRS" or "HSE PCRS" text, it is almost certainly Patient Fees.`,

  OTHER: `- General Sundry Costs: recurring or small operational purchases (fruit delivery, milk, cleaning supplies, minor office refreshments).
- One-off/Unusual Expenses: gift cards (ONE4ALL), department store purchases (Brown Thomas), event catering, one-time purchases that don't recur.
- If the vendor appears multiple times in the batch, it's likely sundry (recurring). Single appearances lean toward one-off.`,

  OFFICE: `- Foreign currency charges in format "P1906GB375.00@1.17112" or "P2206US166.05@0.87070": if the same amount recurs monthly (e.g. $135, $18.45), it is likely a Software Subscription, not Unclassified. Only use Office & Admin Unclassified for truly one-off unidentifiable foreign charges.
- Named software vendors (Microsoft, Wix, BrightHR, etc.) → Software Subscriptions.
- "WP*www.gppra" or similar WP* prefixes = WordPress/web platform → Software Subscriptions (not Website Costs — Website Costs is for one-off design/development).
- Computer/electronics retailers (Currys, Dell) → Computer Equipment.
- IT service providers (HPM Services, Clanwilliam) → IT Support & Maintenance.`,

  PROFESSIONAL: `- NEPOSCHG* (Non-Euro POS Charge, foreign exchange fees) → Bank Charges.
- "ROYAL MEDICAL BENE" = Royal College/Medical benevolent fund → Medical Council Fees (not Professional Body Subscriptions).
- NEJM (New England Journal of Medicine) → Professional Body Subscriptions (journal subscription).
- CPD/training courses (Menopause Society, named medical education providers) → Continuing Professional Development.
- Conference attendance (Kingsbridge, hotel/venue names associated with medical conferences) → Courses & Training.
- Distinguish: CPD is structured professional education/training; Courses & Training is attending specific events/workshops; Conference Attendance is for large multi-day medical conferences. When unclear, prefer Continuing Professional Development.`,

  PREMISES: `- Repairs & Maintenance: locksmiths, appliance repair, tradespeople, general maintenance contractors, blinds/shutters.
- Building Maintenance: structural work, HVAC (Comfort Air Conditioning), plumbing contractors, major building systems, leasing companies for building equipment (e.g. Cathedral Leasing).
- Water services → Water. Waste services → Waste Disposal.`,

  MEDICAL: `- Eurofins Biomnis = laboratory services → Laboratory Supplies.
- Medguard, dressing/wound care suppliers → Dressings & Consumables.
- Medisave = medical equipment supplier → Medical Equipment (small items).
- Tonstix = tonsil swab product → Surgical Supplies.
- Boots Retail = likely medications/pharmacy → Medications & Drugs.`,

  STAFF: `- Staff payments are typically "TO [NAME]" format. Match to named staff categories using the person's name.
- Corporate Workware = staff uniforms supplier → Staff Uniforms.
- If a name doesn't match any known staff member category, use the most likely role-based category.`,

  NON_BUSINESS: `- Partner drawings are personal payments to practice partners, usually "TO [PARTNER NAME]" or "[PARTNER NAME] SO" format.
- Match to the specific partner's drawing category using their name.`,
};

// ============================================================================
// PROMPT BUILDING
// ============================================================================

/**
 * Build dynamic few-shot examples from the corpus for a specific group.
 * Picks up to MAX_EXAMPLES_PER_CATEGORY diverse examples per category.
 */
function buildCorpusExamples(groupCode, corpus, categoryMapping) {
  const sectionToGroup = engine.SECTION_TO_GROUP;

  // Index corpus by category within this group
  const byCat = {};
  for (const t of corpus) {
    const g = t.suggestedGroup || (t.categoryCode ? (() => {
      const cat = categoryMapping.find(c => c.code === t.categoryCode);
      return cat ? sectionToGroup[cat.section] : null;
    })() : null);
    if (g !== groupCode || !t.categoryCode) continue;

    if (!byCat[t.categoryCode]) byCat[t.categoryCode] = [];
    byCat[t.categoryCode].push(t);
  }

  const lines = [];
  for (const [catCode, txns] of Object.entries(byCat)) {
    const cat = categoryMapping.find(c => c.code === catCode);
    if (!cat) continue;

    // Pick up to N diverse examples (prefer different description prefixes)
    const seen = new Set();
    const examples = [];
    for (const t of txns) {
      const prefix = (t.details || '').substring(0, 12).toUpperCase();
      if (seen.has(prefix) && examples.length > 0) continue;
      seen.add(prefix);
      examples.push(t);
      if (examples.length >= MAX_EXAMPLES_PER_CATEGORY) break;
    }

    for (const ex of examples) {
      const type = ex.isIncome || ex.type === 'income' ? 'CREDIT' : 'DEBIT';
      const amount = Math.abs(ex.amount || ex.debit || ex.credit || 0);
      lines.push(`- [${type}] €${amount.toFixed(2)} | "${(ex.details || '').substring(0, 50)}" → ${catCode}: ${cat.name}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Build a category-level prompt for transactions within a single group.
 * Includes corpus examples, domain hints, and confidence calibration.
 */
function buildCategoryPrompt(transactions, groupCode, groupName, categories, practiceProfile, corpus, categoryMapping, correctionsBlock = '') {
  const profileContext = buildProfileContext(practiceProfile);

  const categoryLines = categories.map(c =>
    `${c.code}: ${c.name}${c.accountantLine ? ` (P&L: ${c.accountantLine})` : ''}`
  ).join('\n');

  const txnList = transactions.map((t, i) => {
    const type = t.isIncome || t.type === 'income' ? 'CREDIT' : 'DEBIT';
    const amount = Math.abs(t.amount || t.debit || t.credit || 0);
    return `${i + 1}. [${type}] €${amount.toFixed(2)} | "${t.details}"`;
  }).join('\n');

  // Dynamic few-shot examples from corpus
  const corpusExamples = corpus && categoryMapping
    ? buildCorpusExamples(groupCode, corpus, categoryMapping)
    : null;

  // Group-specific domain hints
  const hints = GROUP_HINTS[groupCode] || null;

  // Use group-appropriate wording (income vs expense)
  const categoryType = groupCode === 'INCOME' ? 'income' : 'expense';

  let prompt = `You are assigning ${categoryType} categories to Irish GP practice bank transactions.

PRACTICE PROFILE:
${profileContext}

All transactions below belong to the group: ${groupCode} (${groupName})

Available categories in this group:
${categoryLines}`;

  if (corpusExamples) {
    prompt += `

REFERENCE EXAMPLES (already categorised transactions in this group):
${corpusExamples}`;
  }

  if (hints) {
    prompt += `

GROUP-SPECIFIC GUIDANCE:
${hints}`;
  }

  if (correctionsBlock) {
    prompt += correctionsBlock;
  }

  prompt += `

CONFIDENCE CALIBRATION:
- 0.90-0.98: Clear match — identifiable vendor, obvious pattern from examples above
- 0.85-0.89: Strong match — context clues like amount patterns, keywords, or similarity to reference examples
- 0.75-0.84: Reasonable match but some ambiguity between 2 categories
- Below 0.75 or UNCERTAIN: genuinely cannot determine

KEY RULES:
- Choose the most specific category. Prefer named categories over "Other/Unclassified" variants.
- If a transaction closely resembles a reference example, use the same category with high confidence.
- If uncertain between two categories, pick the more commonly used one and note it in reasoning.

TRANSACTIONS TO CLASSIFY:
${txnList}

For each transaction, respond with a JSON array:
[{"index": 1, "categoryCode": "${(categories.find(c => c.code.includes('.')) || categories[0])?.code || 'X.X'}", "confidence": 0.90, "reasoning": "brief explanation"}]

Respond ONLY with the JSON array.`;

  return prompt;
}

/**
 * Build practice profile context (mirrors opusAnalysisPass).
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
  return lines.length > 0 ? lines.join('\n') : 'No practice profile available';
}

// ============================================================================
// API CALL
// ============================================================================

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 529]);
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 2000;

/**
 * Call the API for a single batch of transactions within one group.
 * Uses Sonnet (STANDARD tier) — best accuracy/cost ratio with improved prompt.
 * Retries on transient errors (429, 500, 502, 503, 529) with exponential backoff.
 */
async function callCategoryAPI(apiKey, prompt) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.log(`[CategoryPass] Retry ${attempt}/${MAX_RETRIES} after ${backoff}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELS.STANDARD,
        max_tokens: 4096,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      lastError = new Error(`Category API error: ${response.status} - ${errorBody}`);

      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
        console.warn(`[CategoryPass] Transient error (${response.status}), will retry`);
        continue;
      }
      throw lastError;
    }

    // Success — parse the response
    const data = await response.json();

    if (data.usage) {
      console.log(`[CategoryPass] Token usage — input: ${data.usage.input_tokens}, output: ${data.usage.output_tokens}`);
    }

    // Parse response — same robust extraction as opusAnalysisPass
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
          console.log(`[CategoryPass] Salvaged ${results.length} results from truncated response`);
          return results;
        } catch {
          // Fall through
        }
      }
    }

    console.error('[CategoryPass] Could not extract JSON from response:', text.substring(0, 200));
    throw new Error('Category API response did not contain a valid JSON array');
  }

  // All retries exhausted
  throw lastError;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Run Pass 2: Category assignment within confirmed groups.
 *
 * @param {Array} transactions - Transactions with confirmed groups but no category
 * @param {Array} categoryMapping - Full category mapping
 * @param {Array} corpus - Already-categorised transactions (for similarity matching)
 * @param {Object} practiceProfile - Practice profile
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<{ results: Array, uncertain: Array, similarityMatched: number, aiMatched: number, error: string|null }>}
 */
async function runCategoryAssignmentPass(transactions, categoryMapping, corpus, practiceProfile, apiKey, correctionsBlock = '') {
  if (!apiKey) {
    return { results: [], uncertain: [], similarityMatched: 0, aiMatched: 0, error: 'No API key available' };
  }

  if (transactions.length === 0) {
    return { results: [], uncertain: [], similarityMatched: 0, aiMatched: 0, error: null };
  }

  console.log(`[CategoryPass] Processing ${transactions.length} grouped-but-uncategorised transactions`);

  const sectionToGroup = engine.SECTION_TO_GROUP;

  // Step 1: Deterministic similarity within group
  const { matched: similarityMatched, remaining: afterSimilarity } = runSimilarityWithinGroup(transactions, corpus);
  console.log(`[CategoryPass] Similarity within group: ${similarityMatched.length} matched, ${afterSimilarity.length} remaining`);

  if (afterSimilarity.length === 0) {
    return {
      results: similarityMatched,
      uncertain: [],
      similarityMatched: similarityMatched.length,
      aiMatched: 0,
      error: null,
    };
  }

  // Step 2: Group remaining transactions by their confirmed group
  const byGroup = {};
  for (const txn of afterSimilarity) {
    const g = txn.suggestedGroup;
    if (!g) continue;
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(txn);
  }

  // Build category list per group from categoryMapping
  const categoriesByGroup = {};
  for (const cat of categoryMapping) {
    const group = sectionToGroup[cat.section];
    if (!group) continue;
    if (!categoriesByGroup[group]) categoriesByGroup[group] = [];
    // Deduplicate by code
    if (!categoriesByGroup[group].find(c => c.code === cat.code)) {
      categoriesByGroup[group].push({
        code: cat.code,
        name: cat.name,
        section: cat.section,
        accountantLine: cat.accountantLine,
      });
    }
  }

  const allResults = [...similarityMatched];
  const allUncertain = [];
  let aiMatchedCount = 0;

  // Step 3: AI call per group
  for (const [groupCode, groupTxns] of Object.entries(byGroup)) {
    const groupDef = engine.GROUPS[groupCode];
    if (!groupDef) {
      // Unknown group — push to uncertain
      for (const txn of groupTxns) {
        allUncertain.push({
          ...txn,
          categoryCode: null,
          categoryConfidence: 0,
          categoryReasoning: 'Unknown group code',
          convergencePass: 'pass2_uncertain',
        });
      }
      continue;
    }

    const groupCategories = categoriesByGroup[groupCode] || [];
    if (groupCategories.length === 0) {
      // No categories defined for this group — push to uncertain
      for (const txn of groupTxns) {
        allUncertain.push({
          ...txn,
          categoryCode: null,
          categoryConfidence: 0,
          categoryReasoning: `No categories defined for group ${groupCode}`,
          convergencePass: 'pass2_uncertain',
        });
      }
      continue;
    }

    // Process in batches within this group
    for (let i = 0; i < groupTxns.length; i += BATCH_SIZE) {
      const batch = groupTxns.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(groupTxns.length / BATCH_SIZE);

      console.log(`[CategoryPass] ${groupCode} batch ${batchNum}/${totalBatches}: ${batch.length} transactions, ${groupCategories.length} categories`);

      try {
        const prompt = buildCategoryPrompt(batch, groupCode, groupDef.name, groupCategories, practiceProfile, corpus, categoryMapping, correctionsBlock);
        const batchResults = await callCategoryAPI(apiKey, prompt);

        // Map results back to transactions
        for (const result of batchResults) {
          const idx = result.index - 1; // 1-based to 0-based
          if (idx < 0 || idx >= batch.length) continue;

          const txn = batch[idx];

          if (result.categoryCode === 'UNCERTAIN' || !result.categoryCode) {
            allUncertain.push({
              ...txn,
              categoryCode: null,
              categoryConfidence: 0,
              categoryReasoning: result.reasoning || 'AI could not determine category',
              convergencePass: 'pass2_ai_uncertain',
            });
          } else {
            // Validate the category code belongs to this group
            const validCat = groupCategories.find(c => c.code === result.categoryCode);
            if (!validCat) {
              // AI hallucinated a category code — try fuzzy match
              const byName = groupCategories.find(c =>
                c.name.toLowerCase().includes((result.reasoning || '').toLowerCase().split(' ')[0])
              );
              if (byName) {
                result.categoryCode = byName.code;
              } else {
                allUncertain.push({
                  ...txn,
                  categoryCode: null,
                  categoryConfidence: 0,
                  categoryReasoning: `AI returned invalid category code: ${result.categoryCode}`,
                  convergencePass: 'pass2_ai_invalid',
                });
                continue;
              }
            }

            const cat = validCat || groupCategories.find(c => c.code === result.categoryCode);
            const confidence = Math.min(result.confidence || 0, 0.98);
            const confirmed = confidence >= CATEGORY_AUTO_THRESHOLD;

            allResults.push({
              ...txn,
              categoryCode: cat.code,
              categoryName: cat.name,
              categorySection: cat.section,
              categoryCohort: confirmed ? 'auto' : 'review',
              categoryConfidence: confidence,
              categoryReasoning: result.reasoning,
              categoryMatchType: 'pass2-ai',
              convergencePass: 'pass2_ai',
            });
            aiMatchedCount++;
          }
        }

        // Check for transactions in this batch not in the response
        const respondedIndices = new Set(batchResults.map(r => r.index - 1));
        for (let j = 0; j < batch.length; j++) {
          if (!respondedIndices.has(j)) {
            allUncertain.push({
              ...batch[j],
              categoryCode: null,
              categoryConfidence: 0,
              categoryReasoning: 'Not included in AI response',
              convergencePass: 'pass2_ai_skipped',
            });
          }
        }
      } catch (error) {
        console.error(`[CategoryPass] ${groupCode} batch ${batchNum} error:`, error.message);
        for (const txn of batch) {
          allUncertain.push({
            ...txn,
            categoryCode: null,
            categoryConfidence: 0,
            categoryReasoning: `AI error: ${error.message}`,
            convergencePass: 'pass2_ai_error',
          });
        }
      }
    }
  }

  const autoConfirmed = allResults.filter(r => r.categoryCohort === 'auto').length;
  const hints = allResults.filter(r => r.categoryCohort === 'review').length;
  console.log(`[CategoryPass] Complete: ${similarityMatched.length} similarity, ${aiMatchedCount} AI (${autoConfirmed} auto, ${hints} hints), ${allUncertain.length} uncertain`);

  return {
    results: allResults,
    uncertain: allUncertain,
    similarityMatched: similarityMatched.length,
    aiMatched: aiMatchedCount,
    error: null,
  };
}

module.exports = {
  runCategoryAssignmentPass,
  runSimilarityWithinGroup,
  buildCategoryPrompt,
  CATEGORY_AUTO_THRESHOLD,
  SIMILARITY_THRESHOLD,
  BATCH_SIZE,
};
