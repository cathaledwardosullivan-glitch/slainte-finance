/**
 * Convergence Loop — Shared Module
 *
 * Deterministic multi-pass categorization engine used by both the
 * background processor (production) and test harness (development).
 *
 * Passes:
 *   A — Identifier matching (exact/prefix match against category identifiers)
 *   B — Known fee amount matching (consultation fee from practice profile)
 *   C — Similarity matching (Levenshtein against corpus, scored by consensus)
 *   D — Group confidence propagation (cluster-based confidence elevation)
 *
 * The loop iterates until no new categorizations are produced or MAX_ITERATIONS is hit.
 * Each pass can only categorize, never un-categorize. Corpus grows monotonically.
 */

const engine = require('./categorizationBundle.cjs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULTS = {
  autoThreshold: 0.90,
  maxIterations: 10,
  similarityMinThreshold: 0.70,
  feeMatchConfidence: 0.92,
};

// ============================================================================
// CONVERGENCE LOOP
// ============================================================================

/**
 * Run the deterministic convergence loop.
 *
 * @param {Array} incomingTransactions - Transactions to categorize (category fields absent or stripped)
 * @param {Array} categoryMapping - Full category mapping with identifiers
 * @param {Array} existingCorpus - Pre-existing categorized transactions (warm) or [] (cold)
 * @param {Object} practiceProfile - Practice profile (for fee matching)
 * @param {Object} [options] - Override defaults
 * @param {number} [options.autoThreshold=0.90]
 * @param {number} [options.maxIterations=10]
 * @returns {{ categorized: Array, uncategorized: Array, iterations: number, passBreakdown: Array }}
 */
function runConvergenceLoop(incomingTransactions, categoryMapping, existingCorpus, practiceProfile, options = {}) {
  const config = { ...DEFAULTS, ...options };

  let uncategorized = [...incomingTransactions];
  let categorized = [];
  // Corpus starts with existing transactions, grows as we categorize
  const corpus = existingCorpus.map(t => ({
    ...t,
    category: t.category || categoryMapping.find(c => c.code === t.categoryCode),
    unifiedConfidence: t.unifiedConfidence || 0.95,
  }));
  const passBreakdown = [];
  let iteration = 0;

  // Build identifier index once
  const identifierIndex = engine.buildIdentifierIndex(categoryMapping);

  while (iteration < config.maxIterations) {
    iteration++;
    const iterationStart = uncategorized.length;
    const iterDetail = { iteration, passA: 0, passB: 0, passC: 0, passD: 0 };

    // --- Pass A: Identifier matching ---
    const afterA = [];
    for (const txn of uncategorized) {
      const match = engine.findIdentifierMatch(txn.details, identifierIndex);
      if (match) {
        const confidence = engine.getIdentifierMatchConfidence(match);
        const catCode = match.categories[0]?.categoryCode;
        const cat = categoryMapping.find(c => c.code === catCode);
        const enriched = _enrichTransaction(txn, catCode, cat, confidence, 'identifier', iteration);
        categorized.push(enriched);
        corpus.push(enriched);
        iterDetail.passA++;
      } else {
        afterA.push(txn);
      }
    }
    uncategorized = afterA;

    // --- Pass B: Known fee amount matching ---
    const consultationFee = practiceProfile?.privatePatients?.averageConsultationFee;
    const afterB = [];
    if (consultationFee) {
      for (const txn of uncategorized) {
        const credit = parseFloat(txn.credit) || 0;
        if (credit > 0 && Math.abs(credit - consultationFee) < 0.01) {
          const consultCat = categoryMapping.find(c =>
            c.name && c.name.toLowerCase().includes('consultation')
            && c.section === 'INCOME'
          );
          if (consultCat) {
            const enriched = _enrichTransaction(txn, consultCat.code, consultCat, config.feeMatchConfidence, 'fee_match', iteration);
            categorized.push(enriched);
            corpus.push(enriched);
            iterDetail.passB++;
            continue;
          }
        }
        afterB.push(txn);
      }
    } else {
      afterB.push(...uncategorized);
    }
    uncategorized = afterB;

    // --- Pass C: Similarity matching against corpus ---
    const afterC = [];
    const categorizedCorpus = corpus.filter(c => c.categoryCode);
    for (const txn of uncategorized) {
      const similar = engine.findSimilarCategorizedTransactions(
        txn,
        categorizedCorpus,
        config.similarityMinThreshold
      );
      if (similar && similar.length > 0) {
        const bestCode = similar[0].categoryCode || similar[0].category?.code;
        const agreeing = similar.filter(s => (s.categoryCode || s.category?.code) === bestCode).length;
        const consensus = agreeing / similar.length;
        const confidence = similar[0].similarity * consensus;

        if (confidence >= config.autoThreshold) {
          const cat = categoryMapping.find(c => c.code === bestCode);
          const enriched = _enrichTransaction(txn, bestCode, cat, confidence, 'similarity', iteration);
          categorized.push(enriched);
          corpus.push(enriched);
          iterDetail.passC++;
          continue;
        }
      }
      afterC.push(txn);
    }
    uncategorized = afterC;

    // --- Pass D: Group confidence propagation ---
    // Cluster uncategorized transactions with relevant categorized neighbors
    // (from both the current batch and the existing corpus) to propagate confidence.
    if (uncategorized.length > 0) {
      // Gather categorized transactions that could cluster with uncategorized ones.
      // Instead of clustering ALL categorized (expensive), find corpus entries that
      // are similar to at least one uncategorized transaction (targeted).
      const relevantCorpusEntries = _findRelevantCorpusEntries(
        uncategorized, corpus, categorized, 0.80
      );

      const allForClustering = [...uncategorized, ...relevantCorpusEntries];

      if (allForClustering.length >= 2 && relevantCorpusEntries.length > 0) {
        const clusters = engine.clusterSimilarTransactions(allForClustering);

        // Build lookup: transaction id → cluster
        const txnClusterMap = new Map();
        for (const cluster of clusters) {
          for (const member of cluster.transactions) {
            txnClusterMap.set(member.id, cluster);
          }
        }

        // Build a fast lookup for categorized entries by ID
        const categorizedById = new Map();
        for (const c of [...categorized, ...corpus]) {
          if (c.categoryCode) categorizedById.set(c.id, c);
        }

        const afterD = [];
        for (const txn of uncategorized) {
          const cluster = txnClusterMap.get(txn.id);
          if (cluster && cluster.size > 1) {
            // Find best categorized member in this cluster
            let bestMember = null;
            let bestConfidence = 0;

            for (const member of cluster.transactions) {
              if (member.id === txn.id) continue;
              const catEntry = categorizedById.get(member.id);
              if (catEntry && (catEntry.unifiedConfidence || 0.95) > bestConfidence) {
                bestMember = catEntry;
                bestConfidence = catEntry.unifiedConfidence || 0.95;
              }
            }

            if (bestMember && bestMember.categoryCode) {
              const intraSimilarity = engine.levenshteinSimilarity(txn.details, bestMember.details);
              const groupConfidence = Math.max(0, bestConfidence * intraSimilarity);

              if (groupConfidence >= config.autoThreshold) {
                const cat = categoryMapping.find(c => c.code === bestMember.categoryCode);
                const enriched = _enrichTransaction(txn, bestMember.categoryCode, cat, groupConfidence, 'group_confidence', iteration);
                enriched.clusterId = `cluster-${cluster.representative?.id || 'unknown'}`;
                categorized.push(enriched);
                corpus.push(enriched);
                iterDetail.passD++;
                continue;
              }
            }
          }
          afterD.push(txn);
        }
        uncategorized = afterD;
      }
    }

    const newCategorizations = iterationStart - uncategorized.length;
    iterDetail.total = newCategorizations;
    passBreakdown.push(iterDetail);

    if (newCategorizations === 0) break;
  }

  return { categorized, uncategorized, iterations: iteration, passBreakdown };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Find corpus entries that are similar enough to uncategorized transactions
 * to be worth including in clustering. This avoids clustering the entire
 * corpus (expensive) while ensuring Pass D can find propagation targets.
 *
 * Uses prefix-based pre-filtering for performance: only compare transactions
 * that share an 8-char prefix (same approach as clusterSimilarTransactions).
 */
function _findRelevantCorpusEntries(uncategorized, corpus, categorized, minSimilarity) {
  const categorizedCorpus = corpus.filter(c => c.categoryCode);
  if (categorizedCorpus.length === 0 && categorized.length === 0) return [];

  // Build prefix index of categorized entries for fast lookup
  const prefixLen = 8;
  const prefixIndex = new Map();
  const allCategorized = [...categorized, ...categorizedCorpus];

  for (const entry of allCategorized) {
    const cleaned = (entry.details || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const prefix = cleaned.substring(0, prefixLen);
    if (!prefix) continue;
    if (!prefixIndex.has(prefix)) prefixIndex.set(prefix, []);
    prefixIndex.get(prefix).push(entry);
  }

  // For each uncategorized transaction, find categorized entries with matching prefix
  const relevant = new Map(); // id → entry (deduped)
  for (const txn of uncategorized) {
    const cleaned = (txn.details || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const prefix = cleaned.substring(0, prefixLen);
    const candidates = prefixIndex.get(prefix);
    if (!candidates) continue;

    for (const candidate of candidates) {
      if (relevant.has(candidate.id)) continue;
      const sim = engine.levenshteinSimilarity(txn.details, candidate.details);
      if (sim >= minSimilarity) {
        relevant.set(candidate.id, candidate);
      }
    }
  }

  return Array.from(relevant.values());
}

/**
 * Create an enriched transaction with categorization metadata.
 * Both consumers (test harness + background processor) layer their own
 * fields on top of this base enrichment.
 */
function _enrichTransaction(txn, categoryCode, categoryObj, confidence, pass, iteration) {
  return {
    ...txn,
    categoryCode,
    categoryName: categoryObj?.name,
    category: categoryObj,
    unifiedConfidence: confidence,
    convergencePass: pass,
    convergenceIteration: iteration,
  };
}

// ============================================================================
// ANOMALY DETECTION (Post-convergence quality check)
// ============================================================================

/**
 * Run anomaly detection on categorized transactions.
 * Demotes outliers from auto to review and returns warnings.
 *
 * @param {Array} categorized - Transactions with categoryCode and unifiedConfidence
 * @param {Array} categoryMapping - Full category mapping
 * @param {Object} practiceProfile - Practice profile for sanity checks
 * @param {Object} [options]
 * @param {number} [options.autoThreshold=0.90]
 * @returns {{ demoted: Array, warnings: Array<string> }}
 */
function runAnomalyDetection(categorized, categoryMapping, practiceProfile, options = {}) {
  const config = { autoThreshold: DEFAULTS.autoThreshold, ...options };
  const demoted = [];
  const warnings = [];

  // --- Check 1: Amount outliers within categories ---
  // Only flag extreme order-of-magnitude mismatches (e.g., €15 in a €3,000 category).
  // GP practice expenses have naturally high variance within categories, so statistical
  // outlier detection (MAD-based) produces too many false alarms.
  const byCategory = new Map();
  for (const txn of categorized) {
    if (txn.unifiedConfidence < config.autoThreshold) continue;
    const code = txn.categoryCode;
    if (!code) continue;
    if (!byCategory.has(code)) byCategory.set(code, []);
    byCategory.get(code).push(txn);
  }

  for (const [code, txns] of byCategory) {
    if (txns.length < 8) continue; // Need a solid sample

    const amounts = txns.map(t => Math.abs(t.amount || t.debit || t.credit || 0)).filter(a => a > 0);
    if (amounts.length < 8) continue;

    amounts.sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    if (median === 0) continue;

    // Flag if amount is < 10% or > 10× the median — true order-of-magnitude mismatch
    // These are flagged (not demoted) — Finn mentions them during review
    for (const txn of txns) {
      const amount = Math.abs(txn.amount || txn.debit || txn.credit || 0);
      if (amount === 0) continue;
      const ratio = amount / median;
      if (ratio < 0.10 || ratio > 10) {
        txn.anomalyFlag = `amount_outlier: €${amount.toFixed(2)} vs median €${median.toFixed(2)} (ratio: ${ratio.toFixed(2)})`;
        demoted.push(txn); // "demoted" is a misnomer now — these are flagged, not confidence-reduced
      }
    }
  }

  // --- Check 2: Missing expected categories ---
  // Every GP practice should have some of these
  const expectedCategories = [
    { section: 'INCOME', keywords: ['income', 'revenue', 'gms', 'patient'], label: 'Income' },
    { section: 'OVERHEADS', keywords: ['utility', 'utilities', 'electricity', 'gas'], label: 'Utilities' },
    { section: 'STAFF', keywords: ['staff', 'salary', 'wages', 'locum'], label: 'Staff costs' },
  ];

  const categorizedCodes = new Set(categorized.filter(t => t.categoryCode).map(t => t.categoryCode));

  for (const expected of expectedCategories) {
    const matchingCategories = categoryMapping.filter(c =>
      c.section === expected.section &&
      expected.keywords.some(kw => (c.name || '').toLowerCase().includes(kw))
    );
    const hasAny = matchingCategories.some(c => categorizedCodes.has(c.code));
    if (!hasAny && categorized.length > 50) {
      // Only warn for substantial datasets — a small statement may genuinely lack some categories
      warnings.push(`No transactions categorized as ${expected.label} — this is unusual for a GP practice statement`);
    }
  }

  // --- Check 3: Proportion sanity (staff costs vs staff count) ---
  const staffCount = practiceProfile?.staff?.totalStaff ||
    (Array.isArray(practiceProfile?.staff?.staffDetails) ? practiceProfile.staff.staffDetails.length : 0);

  if (staffCount > 0) {
    const staffCategories = categoryMapping
      .filter(c => c.section === 'STAFF' || (c.name && c.name.toLowerCase().includes('salary')))
      .map(c => c.code);

    const staffTxns = categorized.filter(t => staffCategories.includes(t.categoryCode));
    const totalStaffSpend = staffTxns.reduce((sum, t) => sum + Math.abs(t.debit || 0), 0);

    // Very rough sanity: if stated staff > 3 but total staff spend < €5000, something's off
    if (staffCount > 3 && totalStaffSpend < 5000 && categorized.length > 100) {
      warnings.push(`${staffCount} staff members but only €${totalStaffSpend.toFixed(0)} in staff costs detected — some salary payments may be miscategorized`);
    }
  }

  return { demoted, warnings };
}

module.exports = { runConvergenceLoop, runAnomalyDetection, DEFAULTS };
