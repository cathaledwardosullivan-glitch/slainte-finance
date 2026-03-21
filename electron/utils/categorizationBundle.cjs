var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/engineExports.js
var engineExports_exports = {};
__export(engineExports_exports, {
  CONFIDENCE_THRESHOLDS: () => CONFIDENCE_THRESHOLDS,
  GROUPS: () => GROUPS,
  SECTION_TO_GROUP: () => SECTION_TO_GROUP,
  buildGroupIdentifierIndex: () => buildGroupIdentifierIndex,
  buildIdentifierIndex: () => buildIdentifierIndex,
  calculateUnifiedConfidence: () => calculateUnifiedConfidence,
  calculateUnmatchedProbability: () => calculateUnmatchedProbability,
  categorizeTransaction: () => categorizeTransaction,
  categorizeTransactionBatch: () => categorizeTransactionBatch,
  cleanForClustering: () => cleanForClustering,
  cleanForSimilarity: () => cleanForSimilarity,
  clusterSimilarTransactions: () => clusterSimilarTransactions,
  detectBank: () => detectBank,
  detectType: () => detectType,
  differenceRatio: () => differenceRatio,
  findIdentifierMatch: () => findIdentifierMatch,
  findSimilarCategorizedTransactions: () => findSimilarCategorizedTransactions,
  getAdaptiveWeights: () => getAdaptiveWeights,
  getDateRange: () => getDateRange,
  getIdentifierMatchConfidence: () => getIdentifierMatchConfidence,
  getSuggestionFromSimilarTransactions: () => getSuggestionFromSimilarTransactions,
  getSupportedBanks: () => getSupportedBanks,
  getTransactionKey: () => getTransactionKey,
  identifierMatchScore: () => identifierMatchScore,
  inferIsIncome: () => inferIsIncome,
  levenshteinDistance: () => levenshteinDistance,
  levenshteinSimilarity: () => levenshteinSimilarity,
  matchCategory: () => matchCategory,
  matchGroup: () => matchGroup,
  mergeAmountFragments: () => mergeAmountFragments,
  parseAIBStatementWithPositions: () => parseAIBStatementWithPositions,
  parseAmount: () => parseAmount,
  parseBOIStatement: () => parseBOIStatement,
  parseBOIStatementWithPositions: () => parseBOIStatementWithPositions,
  parseBankDate: () => parseDate,
  parseBankStatement: () => parseBankStatement,
  processTransactionData: () => processTransactionData,
  processTransactionsWithEngine: () => processTransactionsWithEngine
});
module.exports = __toCommonJS(engineExports_exports);

// src/utils/stringUtils.js
function levenshteinDistance(str1, str2) {
  const s1 = str1.toUpperCase();
  const s2 = str2.toUpperCase();
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) {
    d[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        // Deletion
        d[i][j - 1] + 1,
        // Insertion
        d[i - 1][j - 1] + cost
        // Substitution
      );
    }
  }
  return d[m][n];
}
function levenshteinSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}
function differenceRatio(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 0;
  const distance = levenshteinDistance(str1, str2);
  return distance / maxLen;
}
function identifierMatchScore(transaction, identifier) {
  const txUpper = transaction.toUpperCase();
  const idUpper = identifier.toUpperCase();
  if (txUpper.includes(idUpper)) {
    return {
      matchedChars: idUpper.length,
      totalChars: idUpper.length,
      ratio: 1,
      matchType: "exact"
    };
  }
  const idLen = idUpper.length;
  if (idLen < 5) {
    return {
      matchedChars: 0,
      totalChars: idLen,
      ratio: 0,
      matchType: "none"
    };
  }
  const maxAllowedDistance = idLen <= 15 ? 2 : Math.ceil(idLen * 0.15);
  let bestDistance = Infinity;
  let bestWindow = "";
  const windowSizes = [idLen - 2, idLen - 1, idLen, idLen + 1, idLen + 2].filter((s) => s > 0);
  for (const windowSize of windowSizes) {
    for (let i = 0; i <= txUpper.length - windowSize; i++) {
      const window = txUpper.substring(i, i + windowSize);
      if (window.includes(" ")) {
        continue;
      }
      if (Math.abs(window.charCodeAt(0) - idUpper.charCodeAt(0)) > 1) {
        continue;
      }
      const distance = levenshteinDistance(window, idUpper);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestWindow = window;
        if (distance <= 1) break;
      }
    }
    if (bestDistance <= 1) break;
  }
  if (bestDistance <= maxAllowedDistance) {
    const ratio = 1 - bestDistance / idLen;
    return {
      matchedChars: idLen - bestDistance,
      totalChars: idLen,
      ratio: Math.max(ratio, 0.85),
      // Minimum 85% for typo matches
      matchType: "typo",
      typoDetails: {
        bestWindow,
        editDistance: bestDistance,
        maxAllowed: maxAllowedDistance
      }
    };
  }
  return {
    matchedChars: 0,
    totalChars: idLen,
    ratio: 0,
    matchType: "none"
  };
}
var ADAPTIVE_THRESHOLDS = {
  PHASE_1: 0,
  // Wave 1 bootstrap: 10:90 similar:identifier (rely on identifiers)
  PHASE_2: 50,
  // Mid-wave 1: start trusting similar matches
  PHASE_3: 100
  // Wave 2+: standard mode 90:10 (trust similar matches heavily)
};
function getAdaptiveWeights(existingCount = 0) {
  if (existingCount < ADAPTIVE_THRESHOLDS.PHASE_2) {
    return { similar: 0.1, identifier: 0.9 };
  } else if (existingCount < ADAPTIVE_THRESHOLDS.PHASE_3) {
    const progress = (existingCount - 50) / 50;
    return {
      similar: 0.1 + progress * 0.8,
      // 10% → 90%
      identifier: 0.9 - progress * 0.8
      // 90% → 10%
    };
  } else {
    return { similar: 0.9, identifier: 0.1 };
  }
}
function calculateUnifiedConfidence(transactionDetails, similarTransactions = [], identifiers = [], options = {}) {
  const txUpper = transactionDetails.toUpperCase();
  const txCleaned = cleanForSimilarity(transactionDetails);
  let similarScore = 0;
  let similarCalc = {
    matches: [],
    avgDiffRatio: 0,
    count: 0,
    formula: "",
    score: 0
  };
  if (similarTransactions.length > 0) {
    const diffRatios = similarTransactions.map((sim) => {
      const simCleaned = cleanForSimilarity(sim.details || "");
      const diffRatio = differenceRatio(txCleaned, simCleaned);
      return {
        details: sim.details,
        group: sim.group,
        category: sim.categoryCode || sim.category?.code,
        diffRatio,
        similarity: 1 - diffRatio
      };
    });
    diffRatios.sort((a, b) => a.diffRatio - b.diffRatio);
    const bestMatch = diffRatios[0];
    const secondBestMatch = diffRatios.length > 1 ? diffRatios[1] : null;
    const absoluteDiff = secondBestMatch ? bestMatch.similarity - secondBestMatch.similarity : 0;
    const relativeDiff = secondBestMatch && secondBestMatch.similarity > 0 ? (bestMatch.similarity - secondBestMatch.similarity) / secondBestMatch.similarity : 0;
    const qualityGap = bestMatch.similarity >= 0.6 && secondBestMatch && secondBestMatch.similarity < 0.55;
    const useBestOnly = !secondBestMatch || absoluteDiff > 0.1 || relativeDiff > 0.25 || qualityGap;
    let effectiveSimilarity;
    let effectiveCount;
    let formula;
    if (useBestOnly || diffRatios.length === 1) {
      effectiveSimilarity = bestMatch.similarity;
      effectiveCount = 1;
      const reason = !secondBestMatch ? "single match" : absoluteDiff > 0.1 ? `${(absoluteDiff * 100).toFixed(0)}% better` : relativeDiff > 0.25 ? `${(relativeDiff * 100).toFixed(0)}% relatively better` : "quality gap";
      formula = `${(effectiveSimilarity * 100).toFixed(1)}% (best match only - ${reason})`;
    } else {
      const goodMatches = diffRatios.filter(
        (d) => d.diffRatio <= bestMatch.diffRatio + 0.15 || d.similarity >= 0.65
      );
      effectiveSimilarity = goodMatches.reduce((sum, d) => sum + d.similarity, 0) / goodMatches.length;
      effectiveCount = goodMatches.length;
      const countMultiplier = 1 + Math.min(0.15 * Math.log2(Math.max(effectiveCount, 1)), 0.3);
      effectiveSimilarity = Math.min(effectiveSimilarity * countMultiplier, 1);
      formula = `${(goodMatches.reduce((sum, d) => sum + d.similarity, 0) / goodMatches.length * 100).toFixed(1)}% avg \xD7 ${countMultiplier.toFixed(2)} (n=${effectiveCount})`;
    }
    similarScore = effectiveSimilarity;
    similarCalc = {
      matches: diffRatios.slice(0, 5),
      // Top 5 for debug output (sorted by similarity)
      avgDiffRatio: 1 - effectiveSimilarity,
      count: effectiveCount,
      totalFound: diffRatios.length,
      usedBestOnly: useBestOnly || diffRatios.length === 1,
      formula,
      score: similarScore
    };
  }
  let identifierScore = 0;
  let identifierCalc = {
    bestMatch: null,
    matchedChars: 0,
    totalChars: 0,
    score: 0
  };
  if (identifiers.length > 0) {
    for (const identifier of identifiers) {
      const matchResult = identifierMatchScore(txUpper, identifier);
      if (matchResult.ratio > identifierScore) {
        identifierScore = matchResult.ratio;
        identifierCalc = {
          bestMatch: identifier,
          matchedChars: matchResult.matchedChars,
          totalChars: matchResult.totalChars,
          matchType: matchResult.matchType,
          score: matchResult.ratio
        };
      }
    }
  }
  const existingCount = options.existingTransactionsCount || 0;
  const weights = getAdaptiveWeights(existingCount);
  let finalConfidence;
  let combinedFormula;
  if (similarTransactions.length > 0 && similarScore > 0) {
    finalConfidence = similarScore * weights.similar + identifierScore * weights.identifier;
    combinedFormula = `(${similarScore.toFixed(4)} \xD7 ${weights.similar.toFixed(2)}) + (${identifierScore.toFixed(4)} \xD7 ${weights.identifier.toFixed(2)})`;
    if (identifierScore >= 0.85) {
      const isWave1 = existingCount < 100;
      const identifierFloor = isWave1 ? 0.9 : 0.8;
      if (finalConfidence < identifierFloor) {
        combinedFormula += ` \u2192 floored from ${(finalConfidence * 100).toFixed(1)}% to ${(identifierFloor * 100).toFixed(1)}% (strong identifier)`;
        finalConfidence = identifierFloor;
      }
    }
  } else if (identifierScore > 0) {
    const isWave1 = existingCount < 100;
    const cap = isWave1 ? 0.95 : 0.85;
    finalConfidence = Math.min(identifierScore, cap);
    combinedFormula = `min(${identifierScore.toFixed(4)}, ${cap}) [identifier-only, wave=${isWave1 ? "1" : "2+"}]`;
  } else {
    finalConfidence = 0;
    combinedFormula = "No evidence found";
  }
  let cohort;
  const EPSILON = 1e-4;
  if (finalConfidence >= 0.9 - EPSILON) {
    cohort = "auto";
  } else if (finalConfidence >= 0.5 - EPSILON) {
    cohort = "ai_assist";
  } else {
    cohort = "review";
  }
  return {
    confidence: finalConfidence,
    cohort,
    calculation: {
      similar: similarCalc,
      identifier: identifierCalc,
      weights,
      existingCount,
      isAdaptive: existingCount < 500,
      formula: combinedFormula,
      final: finalConfidence
    }
  };
}
var CLUSTER_STRIP_PATTERNS = [
  /^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi,
  /^\d{1,2}\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi,
  /^(SEPA\s*DD|SEPA\s*CT|DD\s*|SO\s*|TRF\s*|FPI\s*|BGC\s*CHQ\s*)/gi,
  /^(THE|A|AN)\s+/gi,
  /\s*REF\s*[\dA-Z]+$/gi,
  /\s+\d{6,}$/g
  // Reference numbers at end
];
var SIMILARITY_STRIP_PATTERNS = [
  // Payment method terms — at START or END of string
  /\bSEPA\s*DD\b/gi,
  /\bSEPA\s*CT\b/gi,
  /\bSEPA\s*CREDIT\s*TRANSFER\b/gi,
  /\bDIRECT\s*DEBIT\b/gi,
  /\bSTANDING\s*ORDER\b/gi,
  // Common prefix-only patterns
  /^(DD|SO|TRF|FPI|BGC|CHQ)\s+/gi,
  /^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi,
  /^\d{1,2}\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi,
  // Reference numbers and trailing noise
  /\s*REF\s*[\dA-Z]+$/gi,
  /\s+\d{6,}$/g
];
function cleanForSimilarity(details) {
  if (!details) return "";
  let cleaned = details.toUpperCase().trim();
  for (const pattern of SIMILARITY_STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
}
function cleanForClustering(details) {
  if (!details) return "";
  let cleaned = details.toUpperCase().trim();
  for (const pattern of CLUSTER_STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim();
}
function quickSimilarity(str1, str2) {
  const lenRatio = Math.min(str1.length, str2.length) / Math.max(str1.length, str2.length);
  if (lenRatio < 0.6) return 0;
  const prefixLen = Math.min(5, str1.length, str2.length);
  const prefix1 = str1.substring(0, prefixLen);
  const prefix2 = str2.substring(0, prefixLen);
  if (prefix1 !== prefix2) {
    let diffs = 0;
    for (let i = 0; i < prefixLen; i++) {
      if (prefix1[i] !== prefix2[i]) diffs++;
    }
    if (diffs > 1) return 0;
  }
  return levenshteinSimilarity(str1, str2);
}
function clusterSimilarTransactions(transactions, similarityThreshold = 0.85) {
  if (!transactions || transactions.length === 0) return [];
  if (transactions.length === 1) {
    return [{
      representative: transactions[0],
      transactions,
      cleanedDetails: cleanForClustering(transactions[0].details),
      size: 1
    }];
  }
  console.log(`[Clustering] Clustering ${transactions.length} transactions with threshold ${similarityThreshold}`);
  const cleanedDetails = transactions.map((t) => cleanForClustering(t.details || ""));
  const parent = transactions.map((_, i) => i);
  const rank = transactions.map(() => 0);
  const find = (i) => {
    if (parent[i] !== i) {
      parent[i] = find(parent[i]);
    }
    return parent[i];
  };
  const union = (i, j) => {
    const pi = find(i);
    const pj = find(j);
    if (pi === pj) return;
    if (rank[pi] < rank[pj]) {
      parent[pi] = pj;
    } else if (rank[pi] > rank[pj]) {
      parent[pj] = pi;
    } else {
      parent[pj] = pi;
      rank[pi]++;
    }
  };
  const prefixGroups = /* @__PURE__ */ new Map();
  const prefixLen = 8;
  for (let i = 0; i < transactions.length; i++) {
    const prefix = cleanedDetails[i].substring(0, prefixLen);
    if (!prefixGroups.has(prefix)) {
      prefixGroups.set(prefix, []);
    }
    prefixGroups.get(prefix).push(i);
  }
  for (const [prefix, indices] of prefixGroups) {
    if (indices.length === 1) continue;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const idx1 = indices[i];
        const idx2 = indices[j];
        const similarity = quickSimilarity(cleanedDetails[idx1], cleanedDetails[idx2]);
        if (similarity >= similarityThreshold) {
          union(idx1, idx2);
        }
      }
    }
  }
  const prefixList = Array.from(prefixGroups.keys());
  for (let i = 0; i < prefixList.length; i++) {
    for (let j = i + 1; j < prefixList.length; j++) {
      const p1 = prefixList[i];
      const p2 = prefixList[j];
      if (levenshteinSimilarity(p1, p2) >= 0.75) {
        const rep1 = prefixGroups.get(p1)[0];
        const rep2 = prefixGroups.get(p2)[0];
        if (quickSimilarity(cleanedDetails[rep1], cleanedDetails[rep2]) >= similarityThreshold) {
          for (const idx1 of prefixGroups.get(p1)) {
            for (const idx2 of prefixGroups.get(p2)) {
              if (quickSimilarity(cleanedDetails[idx1], cleanedDetails[idx2]) >= similarityThreshold) {
                union(idx1, idx2);
              }
            }
          }
        }
      }
    }
  }
  const clusterMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < transactions.length; i++) {
    const root = find(i);
    if (!clusterMap.has(root)) {
      clusterMap.set(root, []);
    }
    clusterMap.get(root).push({
      transaction: transactions[i],
      cleanedDetails: cleanedDetails[i],
      index: i
    });
  }
  const clusters = [];
  for (const [root, members] of clusterMap) {
    members.sort((a, b) => b.cleanedDetails.length - a.cleanedDetails.length);
    const representative = members[0].transaction;
    const clusterTransactions = members.map((m) => m.transaction);
    clusters.push({
      representative,
      transactions: clusterTransactions,
      cleanedDetails: members[0].cleanedDetails,
      size: clusterTransactions.length
    });
  }
  clusters.sort((a, b) => b.size - a.size);
  const multiMemberClusters = clusters.filter((c) => c.size > 1);
  if (multiMemberClusters.length > 0) {
    console.log(`[Clustering] Created ${clusters.length} clusters:`);
    console.log(`  - ${multiMemberClusters.length} clusters with 2+ transactions`);
    console.log(`  - Largest cluster: ${clusters[0].size} transactions`);
    console.log(`  - Total batched: ${multiMemberClusters.reduce((sum, c) => sum + c.size, 0)} of ${transactions.length}`);
    multiMemberClusters.slice(0, 3).forEach((c, i) => {
      console.log(`  [Cluster ${i + 1}] "${c.cleanedDetails.substring(0, 40)}..." (${c.size} transactions)`);
    });
  } else {
    console.log(`[Clustering] No similar transactions found - ${clusters.length} unique transactions`);
  }
  return clusters;
}

// src/utils/categorizationEngine.js
var GROUPS = {
  INCOME: { code: "INCOME", name: "Income", type: "income", displayOrder: 1 },
  STAFF: { code: "STAFF", name: "Staff Costs", type: "expense", displayOrder: 2 },
  PREMISES: { code: "PREMISES", name: "Premises Costs", type: "expense", displayOrder: 3 },
  MEDICAL: { code: "MEDICAL", name: "Medical Supplies", type: "expense", displayOrder: 4 },
  OFFICE: { code: "OFFICE", name: "Office & IT", type: "expense", displayOrder: 5 },
  PROFESSIONAL: { code: "PROFESSIONAL", name: "Professional Fees", type: "expense", displayOrder: 6 },
  MOTOR: { code: "MOTOR", name: "Motor Expenses", type: "expense", displayOrder: 7 },
  OTHER: { code: "OTHER", name: "Petty Cash / Other", type: "expense", displayOrder: 8 },
  UNKNOWN: { code: "UNKNOWN", name: "Unknown", type: "expense", displayOrder: 9 },
  // No matches found - needs AI/user input
  NON_BUSINESS: { code: "NON_BUSINESS", name: "Non-Business", type: "non-business", displayOrder: 10 }
};
var SECTION_TO_GROUP = {
  // Income
  "INCOME": "INCOME",
  // Staff costs - various section names used
  "STAFF COSTS": "STAFF",
  "DIRECT STAFF COSTS": "STAFF",
  // Premises
  "PREMISES COSTS": "PREMISES",
  // Medical
  "MEDICAL SUPPLIES": "MEDICAL",
  "MEDICAL SUPPLIES & SERVICES": "MEDICAL",
  // Office & IT
  "OFFICE & IT": "OFFICE",
  "OFFICE & ADMIN": "OFFICE",
  // Legacy fallback
  // Professional fees - ICGP fix: "PROFESSIONAL DEV" was missing
  "PROFESSIONAL FEES": "PROFESSIONAL",
  "PROFESSIONAL DEV": "PROFESSIONAL",
  "PROFESSIONAL FEES & DEVELOPMENT": "PROFESSIONAL",
  // Motor
  "MOTOR EXPENSES": "MOTOR",
  "MOTOR & TRANSPORT": "MOTOR",
  // Other
  "OTHER COSTS": "OTHER",
  "PETTY CASH / OTHER EXPENSES": "OTHER",
  "OTHER EXPENSES": "OTHER",
  // Legacy fallback
  "CAPITAL & DEPRECIATION": "OTHER",
  // Non-business
  "NON-BUSINESS": "NON_BUSINESS",
  "NON-BUSINESS EXPENDITURE": "NON_BUSINESS"
};
var GENERIC_WORDS = /* @__PURE__ */ new Set([
  "PAYMENT",
  "FEE",
  "CHARGE",
  "TRANSFER",
  "POS",
  "ATM",
  "DEBIT",
  "CREDIT",
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
  "LTD",
  "LIMITED",
  "THE",
  "AND",
  "FOR",
  "FROM",
  "TO",
  "OF",
  "INC",
  "CORP",
  "IRELAND",
  "DUBLIN",
  "CORK",
  "GALWAY",
  "LIMERICK",
  "WATERFORD",
  "BANK",
  "DIRECT",
  "DEBIT",
  "STANDING",
  "ORDER",
  "TRANSACTION"
]);
var CONFIDENCE_THRESHOLDS = {
  AUTO_ACCEPT: 0.9,
  // ≥90% - auto-accept without review
  AI_ASSIST: 0.5,
  // 50-90% - AI assists, flag for optional review
  USER_REVIEW: 0,
  // <50% - requires user review
  EPSILON: 1e-4
  // Tolerance for floating-point comparisons
};
function detectType(transaction) {
  const { debit, credit } = transaction;
  const hasDebit = debit && debit > 0;
  const hasCredit = credit && credit > 0;
  if (hasCredit && !hasDebit) {
    return { type: "income", confidence: 1, isAnomaly: false };
  }
  if (hasDebit && !hasCredit) {
    return { type: "expense", confidence: 1, isAnomaly: false };
  }
  if (hasDebit && hasCredit) {
    return {
      type: debit > credit ? "expense" : "income",
      confidence: 0.5,
      isAnomaly: true
    };
  }
  const amount = transaction.amount || 0;
  if (amount !== 0) {
    return { type: "expense", confidence: 0.7, isAnomaly: true };
  }
  return { type: "expense", confidence: 0.5, isAnomaly: true };
}
function buildIdentifierIndex(categoryMapping) {
  const index = /* @__PURE__ */ new Map();
  categoryMapping.forEach((category) => {
    const groupCode = SECTION_TO_GROUP[category.section] || "OTHER";
    (category.identifiers || []).forEach((identifier) => {
      const lowerIdentifier = identifier.toLowerCase();
      if (!index.has(lowerIdentifier)) {
        index.set(lowerIdentifier, []);
      }
      index.get(lowerIdentifier).push({
        categoryCode: category.code,
        categoryName: category.name,
        groupCode,
        original: identifier,
        section: category.section
      });
    });
  });
  return index;
}
function buildGroupIdentifierIndex(categoryMapping) {
  const groupIndex = /* @__PURE__ */ new Map();
  Object.keys(GROUPS).forEach((groupCode) => {
    groupIndex.set(groupCode, /* @__PURE__ */ new Set());
  });
  categoryMapping.forEach((category) => {
    const groupCode = SECTION_TO_GROUP[category.section] || "OTHER";
    const groupIdentifiers = groupIndex.get(groupCode);
    (category.identifiers || []).forEach((identifier) => {
      groupIdentifiers.add(identifier.toLowerCase());
    });
  });
  return groupIndex;
}
function findIdentifierMatch(details, identifierIndex) {
  const detailsLower = details.toLowerCase();
  const detailsWords = detailsLower.split(/\s+/).filter((w) => w.length >= 4);
  let bestMatch = null;
  let bestLength = 0;
  let bestIsPrefix = false;
  identifierIndex.forEach((categories, identifier) => {
    if (detailsLower.includes(identifier) && identifier.length > bestLength) {
      bestMatch = {
        identifier,
        original: categories[0].original,
        categories,
        isConflict: categories.length > 1 && new Set(categories.map((c) => c.categoryCode)).size > 1
      };
      bestLength = identifier.length;
      bestIsPrefix = false;
    }
    if (!identifier.includes(" ") && identifier.length >= 5) {
      for (const word of detailsWords) {
        if (identifier.startsWith(word) && word.length >= identifier.length * 0.6) {
          const matchScore = word.length;
          if (matchScore > bestLength || matchScore === bestLength && bestIsPrefix) {
            if (bestIsPrefix || !bestMatch) {
              bestMatch = {
                identifier,
                original: categories[0].original,
                categories,
                isConflict: categories.length > 1 && new Set(categories.map((c) => c.categoryCode)).size > 1
              };
              bestLength = matchScore;
              bestIsPrefix = true;
            }
          }
        }
      }
    }
  });
  return bestMatch;
}
function getIdentifierMatchConfidence(match) {
  if (!match) return 0;
  let confidence = 0.95;
  if (match.isConflict) {
    const uniqueCategories = new Set(match.categories.map((c) => c.categoryCode)).size;
    confidence = 0.85 - (uniqueCategories - 2) * 0.05;
    confidence = Math.max(confidence, 0.7);
  }
  const lengthBonus = Math.min(match.identifier.length / 50, 0.03);
  confidence = Math.min(confidence + lengthBonus, 0.98);
  return confidence;
}
function calculateUnmatchedProbability(details, groupCode, groupIdentifierIndex) {
  const detailsLower = details.toLowerCase();
  const detailsWords = new Set(
    detailsLower.split(/\s+/).filter(
      (w) => w.length >= 3 && !GENERIC_WORDS.has(w.toUpperCase())
    )
  );
  const groupIdentifiers = groupIdentifierIndex.get(groupCode);
  if (!groupIdentifiers || groupIdentifiers.size === 0) {
    return { probability: 0, reason: "No identifiers in group", partialMatches: [] };
  }
  let bestPartialScore = 0;
  const partialMatches = [];
  groupIdentifiers.forEach((identifier) => {
    const identifierWords = new Set(
      identifier.split(/\s+/).filter(
        (w) => w.length >= 3 && !GENERIC_WORDS.has(w.toUpperCase())
      )
    );
    const commonWords = [...detailsWords].filter((w) => identifierWords.has(w));
    if (commonWords.length > 0) {
      const overlapScore = commonWords.length / Math.max(identifierWords.size, 1);
      partialMatches.push({
        identifier,
        commonWords,
        score: overlapScore
      });
      if (overlapScore > bestPartialScore) {
        bestPartialScore = overlapScore;
      }
    }
    const partialIdentifier = identifier.substring(0, Math.floor(identifier.length * 0.7));
    if (partialIdentifier.length >= 3 && detailsLower.includes(partialIdentifier)) {
      const substringScore = 0.6;
      if (substringScore > bestPartialScore) {
        bestPartialScore = substringScore;
        partialMatches.push({
          identifier,
          commonWords: [partialIdentifier],
          // Show what actually matched
          score: substringScore
        });
      }
    }
  });
  partialMatches.sort((a, b) => b.score - a.score);
  const probability = Math.min(bestPartialScore * 0.8, 0.7);
  return {
    probability,
    reason: partialMatches.length > 0 ? `Partial match: ${partialMatches[0].commonWords.join(", ")}` : "No partial matches found",
    partialMatches: partialMatches.slice(0, 3)
    // Top 3
  };
}
function cleanDetailsForSimilarity(details) {
  if (!details) return "";
  let cleaned = details.toUpperCase();
  cleaned = cleaned.replace(/^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi, "");
  cleaned = cleaned.replace(/^\d{1,2}\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/gi, "");
  cleaned = cleaned.replace(/^(SEPA\s*DD|SEPA\s*CT|DD\s*|SO\s*|TRF\s*|FPI\s*|BGC\s*|CHQ\s*)/gi, "");
  cleaned = cleaned.replace(/^(THE|A|AN)\s+/gi, "");
  cleaned = cleaned.replace(/\s*REF\s*[\dA-Z]+$/gi, "");
  return cleaned.trim();
}
function calculateCharacterSimilarity(str1, str2) {
  if (!str1 || !str2) {
    return { similarity: 0, diffRatio: 1, commonWords: [], cleanedStr1: "", cleanedStr2: "" };
  }
  const cleanedStr1 = cleanDetailsForSimilarity(str1);
  const cleanedStr2 = cleanDetailsForSimilarity(str2);
  if (cleanedStr1.length < 4 || cleanedStr2.length < 4) {
    return { similarity: 0, diffRatio: 1, commonWords: [], cleanedStr1, cleanedStr2 };
  }
  const similarity = levenshteinSimilarity(cleanedStr1, cleanedStr2);
  const diffRatio = differenceRatio(cleanedStr1, cleanedStr2);
  const words1 = new Set(cleanedStr1.split(/\s+/).filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w)));
  const words2 = new Set(cleanedStr2.split(/\s+/).filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w)));
  const commonWords = [...words1].filter((w) => words2.has(w));
  return { similarity, diffRatio, commonWords, cleanedStr1, cleanedStr2 };
}
function findSimilarCategorizedTransactions(newTransaction, existingTransactions, minSimilarity = 0.5, verbose = false) {
  const newDetails = newTransaction.details || "";
  if (!newDetails || newDetails.trim().length === 0) {
    if (verbose) console.log(`[Similar Match Debug] No details to match: "${newDetails}"`);
    return [];
  }
  if (verbose) {
    console.log(`[Similar Match Debug] Transaction: "${newDetails.substring(0, 50)}"`);
  }
  const similarities = [];
  let checkedCount = 0;
  let matchCount = 0;
  for (const existing of existingTransactions) {
    const hasGroup = existing.group || existing.groupCode;
    const hasCategory = existing.category || existing.categoryCode;
    if (!hasGroup && !hasCategory) continue;
    const existingDetails = existing.details || "";
    if (!existingDetails || existingDetails.trim().length === 0) continue;
    checkedCount++;
    const { similarity, diffRatio, commonWords } = calculateCharacterSimilarity(newDetails, existingDetails);
    if (similarity >= minSimilarity) {
      matchCount++;
      similarities.push({
        transaction: existing,
        details: existingDetails,
        // Include for debug display
        similarity,
        diffRatio,
        // Key for exponential formula: 1 - (avgDiffRatio)^n
        commonWords,
        category: existing.category,
        categoryCode: existing.categoryCode || existing.category?.code,
        group: existing.group
      });
      if (verbose && matchCount <= 3) {
        console.log(`[Similar Match Debug] Match #${matchCount}: "${existingDetails.substring(0, 40)}..."`);
        console.log(`  Levenshtein similarity: ${Math.round(similarity * 100)}%`);
        console.log(`  Diff ratio: ${diffRatio.toFixed(4)} (${Math.round(diffRatio * existingDetails.length)} chars different)`);
        console.log(`  Group: ${existing.group}, Category: ${existing.categoryCode || existing.category?.code}`);
      }
    }
  }
  if (verbose) {
    console.log(`[Similar Match Debug] Checked ${checkedCount} existing transactions, found ${matchCount} matches`);
  }
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, 10);
}
function getSuggestionFromSimilarTransactions(similarTransactions) {
  if (!similarTransactions || similarTransactions.length === 0) {
    return {
      suggestedCategory: null,
      suggestedGroup: null,
      probability: 0,
      evidence: [],
      alternatives: [],
      calculation: null
    };
  }
  const categoryVotes = /* @__PURE__ */ new Map();
  const groupVotes = /* @__PURE__ */ new Map();
  for (const sim of similarTransactions) {
    const catCode = sim.categoryCode;
    const groupCode = sim.group;
    if (catCode) {
      if (!categoryVotes.has(catCode)) {
        categoryVotes.set(catCode, {
          categoryCode: catCode,
          category: sim.category,
          group: groupCode,
          matches: [],
          // Store all matches for unified calculation
          count: 0
        });
      }
      const entry = categoryVotes.get(catCode);
      entry.matches.push({
        details: sim.details || sim.transaction?.details,
        similarity: sim.similarity,
        diffRatio: sim.diffRatio
      });
      entry.count++;
    }
    if (groupCode) {
      if (!groupVotes.has(groupCode)) {
        groupVotes.set(groupCode, {
          groupCode,
          matches: [],
          count: 0
        });
      }
      const entry = groupVotes.get(groupCode);
      entry.matches.push({
        details: sim.details || sim.transaction?.details,
        similarity: sim.similarity,
        diffRatio: sim.diffRatio
      });
      entry.count++;
    }
  }
  const calculateExponentialConfidence = (matches) => {
    if (matches.length === 0) return { confidence: 0, avgDiffRatio: 1, formula: "No matches" };
    const avgDiffRatio = matches.reduce((sum, m) => sum + (m.diffRatio || 0), 0) / matches.length;
    const n = matches.length;
    const confidence = 1 - Math.pow(avgDiffRatio, n);
    return {
      confidence,
      avgDiffRatio,
      count: n,
      formula: `1 - (${avgDiffRatio.toFixed(4)})^${n} = ${confidence.toFixed(4)}`
    };
  };
  const scoredCategories = Array.from(categoryVotes.values()).map((entry) => {
    const calc = calculateExponentialConfidence(entry.matches);
    return {
      ...entry,
      confidence: calc.confidence,
      calculation: calc,
      evidence: entry.matches.slice(0, 3).map((m) => ({
        details: m.details,
        similarity: Math.round(m.similarity * 100),
        diffRatio: m.diffRatio
      }))
    };
  });
  scoredCategories.sort((a, b) => b.confidence - a.confidence);
  const scoredGroups = Array.from(groupVotes.values()).map((entry) => {
    const calc = calculateExponentialConfidence(entry.matches);
    return { ...entry, confidence: calc.confidence, calculation: calc };
  });
  scoredGroups.sort((a, b) => b.confidence - a.confidence);
  if (scoredCategories.length === 0) {
    const bestGroup = scoredGroups[0];
    return {
      suggestedCategory: null,
      suggestedGroup: bestGroup?.groupCode || null,
      probability: bestGroup?.confidence || 0,
      evidence: [],
      alternatives: [],
      calculation: bestGroup?.calculation || null
    };
  }
  const best = scoredCategories[0];
  return {
    suggestedCategory: best.category,
    suggestedCategoryCode: best.categoryCode,
    suggestedGroup: best.group || scoredGroups[0]?.groupCode || null,
    probability: best.confidence,
    // NO CAP - let evidence speak for itself
    evidence: best.evidence,
    alternatives: scoredCategories.slice(1, 4).map((c) => ({
      categoryCode: c.categoryCode,
      category: c.category,
      probability: c.confidence
    })),
    calculation: best.calculation
    // Include for debug panel
  };
}
function matchGroup(details, groupIdentifierIndex, identifierIndex) {
  const detailsLower = details.toLowerCase();
  const identifierMatch = findIdentifierMatch(details, identifierIndex);
  if (identifierMatch) {
    const groupCodes = new Set(identifierMatch.categories.map((c) => c.groupCode));
    if (groupCodes.size === 1) {
      const groupCode = [...groupCodes][0];
      return {
        groupCode,
        confidence: getIdentifierMatchConfidence(identifierMatch),
        matchedIdentifier: identifierMatch.original,
        matchType: "identifier",
        conflicts: [],
        allMatches: [{
          groupCode,
          confidence: getIdentifierMatchConfidence(identifierMatch),
          matchedIdentifier: identifierMatch.original
        }]
      };
    }
    const groupMatches = [...groupCodes].map((gc) => ({
      groupCode: gc,
      confidence: 0.85,
      // Lower due to conflict
      matchedIdentifier: identifierMatch.original
    }));
    return {
      groupCode: groupMatches[0].groupCode,
      // Take first, but flag conflict
      confidence: 0.85,
      matchedIdentifier: identifierMatch.original,
      matchType: "identifier_conflict",
      conflicts: groupMatches,
      allMatches: groupMatches
    };
  }
  const probabilityResults = [];
  groupIdentifierIndex.forEach((identifiers, groupCode) => {
    if (groupCode === "INCOME") return;
    const result = calculateUnmatchedProbability(details, groupCode, groupIdentifierIndex);
    if (result.probability > 0) {
      probabilityResults.push({
        groupCode,
        confidence: result.probability,
        matchedIdentifier: null,
        matchType: "probability",
        reason: result.reason,
        partialMatches: result.partialMatches
      });
    }
  });
  probabilityResults.sort((a, b) => b.confidence - a.confidence);
  if (probabilityResults.length === 0) {
    return {
      groupCode: null,
      confidence: 0,
      matchedIdentifier: null,
      matchType: "none",
      conflicts: [],
      allMatches: []
    };
  }
  return {
    groupCode: probabilityResults[0].groupCode,
    confidence: probabilityResults[0].confidence,
    matchedIdentifier: null,
    matchType: "probability",
    reason: probabilityResults[0].reason,
    conflicts: [],
    allMatches: probabilityResults
  };
}
function matchCategory(details, groupCode, categoryMapping, identifierIndex) {
  const detailsLower = details.toLowerCase();
  const groupCategories = categoryMapping.filter((cat) => {
    const catGroup = SECTION_TO_GROUP[cat.section] || "OTHER";
    return catGroup === groupCode;
  });
  const identifierMatches = [];
  groupCategories.forEach((category) => {
    let bestMatch = null;
    let bestLength = 0;
    (category.identifiers || []).forEach((identifier) => {
      const identifierLower = identifier.toLowerCase();
      if (detailsLower.includes(identifierLower) && identifier.length > bestLength) {
        bestMatch = {
          identifier: identifierLower,
          original: identifier,
          categoryCode: category.code,
          categoryName: category.name
        };
        bestLength = identifier.length;
      }
    });
    if (bestMatch) {
      identifierMatches.push(bestMatch);
    }
  });
  if (identifierMatches.length > 0) {
    identifierMatches.sort((a, b) => b.identifier.length - a.identifier.length);
    const bestMatch = identifierMatches[0];
    const uniqueCategories = new Set(identifierMatches.map((m) => m.categoryCode));
    const hasConflict = uniqueCategories.size > 1;
    let confidence = 0.95;
    confidence += Math.min(bestMatch.identifier.length / 100, 0.03);
    if (hasConflict) {
      confidence = 0.85;
    }
    return {
      categoryCode: bestMatch.categoryCode,
      categoryName: bestMatch.categoryName,
      confidence: Math.min(confidence, 0.98),
      matchedIdentifier: bestMatch.original,
      matchType: hasConflict ? "identifier_conflict" : "identifier",
      conflicts: hasConflict ? identifierMatches.map((m) => ({
        categoryCode: m.categoryCode,
        categoryName: m.categoryName,
        matchedIdentifier: m.original
      })) : [],
      allMatches: identifierMatches.map((m) => ({
        categoryCode: m.categoryCode,
        categoryName: m.categoryName,
        confidence: 0.95,
        matchedIdentifier: m.original
      }))
    };
  }
  const probabilityResults = [];
  groupCategories.forEach((category) => {
    const categoryIdentifiers = /* @__PURE__ */ new Map();
    (category.identifiers || []).forEach((id) => {
      categoryIdentifiers.set(id.toLowerCase(), id);
    });
    const miniGroupIndex = /* @__PURE__ */ new Map();
    miniGroupIndex.set(category.code, new Set(Array.from(categoryIdentifiers.keys())));
    let probability = 0;
    let reason = "";
    const partialMatches = [];
    categoryIdentifiers.forEach((original, identifierLower) => {
      const identifierWords = new Set(
        identifierLower.split(/\s+/).filter(
          (w) => w.length >= 3 && !GENERIC_WORDS.has(w.toUpperCase())
        )
      );
      const detailsWords = new Set(
        detailsLower.split(/\s+/).filter(
          (w) => w.length >= 3 && !GENERIC_WORDS.has(w.toUpperCase())
        )
      );
      const commonWords = [...detailsWords].filter((w) => identifierWords.has(w));
      if (commonWords.length > 0) {
        const overlap = commonWords.length / Math.max(identifierWords.size, 1);
        if (overlap > probability) {
          probability = overlap * 0.6;
          reason = `Partial match: ${commonWords.join(", ")}`;
          partialMatches.push({ identifier: original, commonWords });
        }
      }
    });
    if (probability > 0) {
      probabilityResults.push({
        categoryCode: category.code,
        categoryName: category.name,
        confidence: Math.min(probability, 0.6),
        // Cap at 60% for partial matches
        matchedIdentifier: null,
        matchType: "probability",
        reason,
        partialMatches
      });
    }
  });
  probabilityResults.sort((a, b) => b.confidence - a.confidence);
  if (probabilityResults.length === 0) {
    const parentCategory = groupCategories.find((c) => c.code.endsWith(".0"));
    return {
      categoryCode: parentCategory?.code || null,
      categoryName: parentCategory?.name || null,
      confidence: 0,
      matchedIdentifier: null,
      matchType: "none",
      conflicts: [],
      allMatches: []
    };
  }
  return {
    categoryCode: probabilityResults[0].categoryCode,
    categoryName: probabilityResults[0].categoryName,
    confidence: probabilityResults[0].confidence,
    matchedIdentifier: null,
    matchType: "probability",
    reason: probabilityResults[0].reason,
    conflicts: [],
    allMatches: probabilityResults
  };
}
function categorizeTransaction(transaction, categoryMapping, indexes = null) {
  const identifierIndex = indexes?.identifierIndex || buildIdentifierIndex(categoryMapping);
  const groupIdentifierIndex = indexes?.groupIdentifierIndex || buildGroupIdentifierIndex(categoryMapping);
  const details = transaction.details || "";
  const typeResult = detectType(transaction);
  let groupResult;
  if (typeResult.type === "income") {
    groupResult = {
      groupCode: "INCOME",
      confidence: 0.98,
      // Very high confidence - credit = income
      matchedIdentifier: null,
      matchType: "type_derived",
      // Special: derived from type, not identifier
      conflicts: [],
      allMatches: []
    };
  } else {
    groupResult = matchGroup(details, groupIdentifierIndex, identifierIndex);
    if (!groupResult.groupCode) {
      groupResult = {
        groupCode: "UNKNOWN",
        confidence: 0,
        // Zero confidence - needs AI/user input
        matchedIdentifier: null,
        matchType: "none",
        conflicts: [],
        allMatches: []
      };
    }
  }
  let categoryResult;
  if (groupResult.groupCode) {
    categoryResult = matchCategory(details, groupResult.groupCode, categoryMapping, identifierIndex);
  } else {
    categoryResult = {
      categoryCode: null,
      categoryName: null,
      confidence: 0,
      matchedIdentifier: null,
      matchType: "none",
      conflicts: [],
      allMatches: []
    };
  }
  let groupCohort, categoryCohort;
  if (groupResult.matchType === "identifier_conflict" || groupResult.conflicts?.length > 0) {
    groupCohort = "conflict";
  } else if (groupResult.matchType === "identifier" || groupResult.matchType === "type_derived") {
    groupCohort = "auto";
  } else if (groupResult.matchType === "probability" && groupResult.confidence >= 0.4) {
    groupCohort = "ai_assist";
  } else {
    groupCohort = "review";
  }
  if (categoryResult.matchType === "identifier_conflict" || categoryResult.conflicts?.length > 0) {
    categoryCohort = "conflict";
  } else if (categoryResult.matchType === "identifier") {
    categoryCohort = "auto";
  } else if (categoryResult.matchType === "probability" && categoryResult.confidence >= 0.35) {
    categoryCohort = "ai_assist";
  } else {
    categoryCohort = "review";
  }
  return {
    // Layer 1
    type: typeResult.type,
    typeConfidence: typeResult.confidence,
    typeAnomaly: typeResult.isAnomaly,
    // Layer 2
    group: groupResult.groupCode,
    groupConfidence: groupResult.confidence,
    groupMatchedIdentifier: groupResult.matchedIdentifier,
    groupMatchType: groupResult.matchType,
    groupReason: groupResult.reason || null,
    groupConflicts: groupResult.conflicts,
    groupCohort,
    // Layer 3
    categoryCode: categoryResult.categoryCode,
    categoryName: categoryResult.categoryName,
    categoryConfidence: categoryResult.confidence,
    categoryMatchedIdentifier: categoryResult.matchedIdentifier,
    categoryMatchType: categoryResult.matchType,
    categoryReason: categoryResult.reason || null,
    categoryConflicts: categoryResult.conflicts,
    categoryCohort,
    // For compatibility with existing system
    category: categoryResult.categoryCode ? categoryMapping.find((c) => c.code === categoryResult.categoryCode) : null
  };
}
function categorizeTransactionBatch(transactions, categoryMapping, existingTransactions = [], options = {}) {
  const identifierIndex = buildIdentifierIndex(categoryMapping);
  const groupIdentifierIndex = buildGroupIdentifierIndex(categoryMapping);
  const indexes = { identifierIndex, groupIdentifierIndex };
  console.log(`[Categorization] Built identifier index with ${identifierIndex.size} unique identifiers`);
  const staffIdentifiers = Array.from(identifierIndex.entries()).filter(([id, cats]) => cats.some((c) => ["3", "4", "5", "6", "7", "90"].includes(c.categoryCode?.split(".")[0])));
  if (staffIdentifiers.length > 0) {
    const byCategory = {};
    staffIdentifiers.forEach(([id, cats]) => {
      const catCode = cats[0]?.categoryCode;
      if (!byCategory[catCode]) byCategory[catCode] = [];
      byCategory[catCode].push(id);
    });
    console.log(
      `[Categorization] Staff/Partner identifiers (${staffIdentifiers.length} total):`,
      Object.entries(byCategory).map(([code, ids]) => ({
        category: code,
        identifiers: ids
      }))
    );
  } else {
    console.warn("[Categorization] WARNING: No staff/partner identifiers found in index!");
  }
  let results = transactions.map((transaction) => ({
    ...transaction,
    ...categorizeTransaction(transaction, categoryMapping, indexes)
  }));
  if (existingTransactions && existingTransactions.length > 0) {
    console.log(`[Categorization] Applying unified confidence scoring against ${existingTransactions.length} existing transactions`);
    let verboseLogCount = 0;
    results = results.map((result) => {
      const enableVerbose = verboseLogCount < 3;
      let updatedResult = { ...result };
      const hasIdentifierMatch = result.groupMatchType === "identifier" || result.categoryMatchType === "identifier";
      if (hasIdentifierMatch) {
        const identifierConfidence = result.groupConfidence || result.categoryConfidence || 0.95;
        const matchedIdentifier = result.groupMatchedIdentifier || result.categoryMatchedIdentifier || "";
        updatedResult = {
          ...updatedResult,
          unifiedConfidence: identifierConfidence,
          unifiedCohort: identifierConfidence >= CONFIDENCE_THRESHOLDS.AUTO_ACCEPT - CONFIDENCE_THRESHOLDS.EPSILON ? "auto" : "ai_assist",
          calculationDetails: {
            similar: {
              matches: [],
              avgDiffRatio: 0,
              count: 0,
              formula: "Skipped - identifier match found",
              score: 0
            },
            identifier: {
              bestMatch: matchedIdentifier,
              matchedChars: matchedIdentifier.length,
              totalChars: matchedIdentifier.length,
              matchType: "exact",
              score: 1
              // 100% for exact identifier match
            },
            weights: { similar: 0, identifier: 1 },
            // Identifier-only
            formula: `Identifier match: "${matchedIdentifier}"`,
            final: identifierConfidence
          }
        };
        if (enableVerbose) {
          verboseLogCount++;
          console.log(`[Identifier Match] "${result.details?.substring(0, 40)}..." \u2192 ${matchedIdentifier} (${Math.round(identifierConfidence * 100)}%)`);
        }
        return updatedResult;
      }
      const similarTransactions = findSimilarCategorizedTransactions(
        result,
        existingTransactions,
        0.5,
        enableVerbose
      );
      const suggestion = getSuggestionFromSimilarTransactions(similarTransactions);
      const hasSimilarMatches = similarTransactions.length > 0;
      const targetGroup = suggestion.suggestedGroup || result.group;
      const groupIdentifiers = targetGroup ? Array.from(groupIdentifierIndex.get(targetGroup) || []) : [];
      const existingCount = options.existingTransactionsCount ?? existingTransactions.length;
      const unifiedResult = calculateUnifiedConfidence(
        result.details || "",
        similarTransactions.map((s) => ({
          details: s.details || s.transaction?.details,
          group: s.group,
          categoryCode: s.categoryCode
        })),
        groupIdentifiers,
        { existingTransactionsCount: existingCount }
      );
      if (enableVerbose && (hasSimilarMatches || unifiedResult.confidence > 0)) {
        verboseLogCount++;
        console.log(`[Unified Confidence] "${result.details?.substring(0, 40)}...":`);
        console.log(`  Similar transactions: ${similarTransactions.length}`);
        console.log(`  Similar score: ${(unifiedResult.calculation.similar.score * 100).toFixed(1)}% (${unifiedResult.calculation.similar.formula || "N/A"})`);
        console.log(`  Identifier score: ${(unifiedResult.calculation.identifier.score * 100).toFixed(1)}%`);
        console.log(`  Combined: ${(unifiedResult.confidence * 100).toFixed(1)}% \u2192 ${unifiedResult.cohort.toUpperCase()}`);
      }
      if (hasSimilarMatches && suggestion.probability > 0) {
        const combinedConfidence = unifiedResult.confidence;
        const cohort = combinedConfidence >= CONFIDENCE_THRESHOLDS.AUTO_ACCEPT - CONFIDENCE_THRESHOLDS.EPSILON ? "auto" : combinedConfidence >= CONFIDENCE_THRESHOLDS.AI_ASSIST - CONFIDENCE_THRESHOLDS.EPSILON ? "ai_assist" : "review";
        if (suggestion.suggestedGroup && (!result.group || result.groupCohort === "review")) {
          updatedResult = {
            ...updatedResult,
            group: suggestion.suggestedGroup,
            groupConfidence: combinedConfidence,
            groupMatchType: "unified_confidence",
            groupReason: `Similar: ${(unifiedResult.calculation.similar.score * 100).toFixed(0)}%`,
            groupCohort: cohort
          };
        }
        if (suggestion.suggestedCategoryCode && (!result.categoryCode || result.categoryCohort === "review")) {
          const category = categoryMapping.find((c) => c.code === suggestion.suggestedCategoryCode);
          updatedResult = {
            ...updatedResult,
            categoryCode: suggestion.suggestedCategoryCode,
            categoryName: category?.name || null,
            categoryConfidence: combinedConfidence,
            categoryMatchType: "unified_confidence",
            categoryReason: `Similar: ${(unifiedResult.calculation.similar.score * 100).toFixed(0)}%`,
            categoryCohort: cohort,
            category: category || null
          };
        }
        updatedResult.unifiedConfidence = combinedConfidence;
        updatedResult.unifiedCohort = unifiedResult.cohort;
        updatedResult.calculationDetails = unifiedResult.calculation;
        updatedResult.similarTransactionMatch = {
          group: suggestion.suggestedGroup,
          category: suggestion.suggestedCategoryCode,
          confidence: combinedConfidence,
          evidence: suggestion.evidence,
          alternatives: suggestion.alternatives?.map((a) => a.categoryCode)
        };
        if (enableVerbose) {
          console.log(`[Similar Match] "${result.details?.substring(0, 30)}..." \u2192 ${suggestion.suggestedGroup}/${suggestion.suggestedCategoryCode} (${Math.round(combinedConfidence * 100)}% \u2192 ${cohort.toUpperCase()})`);
        }
      } else {
        updatedResult.unifiedConfidence = 0;
        updatedResult.unifiedCohort = "review";
        updatedResult.calculationDetails = unifiedResult.calculation;
      }
      return updatedResult;
    });
  }
  results = results.map((result) => {
    if (result.unifiedConfidence !== void 0 && result.unifiedConfidence > 0) {
      return result;
    }
    const hasIdentifierMatch = result.groupMatchType === "identifier" || result.categoryMatchType === "identifier";
    if (hasIdentifierMatch) {
      const identifierOnlyConfidence = result.groupConfidence || result.categoryConfidence || 0.95;
      const matchedIdentifier = result.groupMatchedIdentifier || result.categoryMatchedIdentifier || "";
      return {
        ...result,
        unifiedConfidence: identifierOnlyConfidence,
        unifiedCohort: identifierOnlyConfidence >= CONFIDENCE_THRESHOLDS.AUTO_ACCEPT - CONFIDENCE_THRESHOLDS.EPSILON ? "auto" : "ai_assist",
        calculationDetails: {
          similar: {
            matches: [],
            avgDiffRatio: 0,
            count: 0,
            formula: "No similar transactions to compare",
            score: 0
          },
          identifier: {
            bestMatch: matchedIdentifier,
            matchedChars: matchedIdentifier.length,
            totalChars: matchedIdentifier.length,
            matchType: "exact",
            score: 1
            // 100% for exact identifier match
          },
          weights: { similar: 0.9, identifier: 0.1 },
          formula: `Identifier match: "${matchedIdentifier}" \u2192 ${(identifierOnlyConfidence * 100).toFixed(0)}%`,
          final: identifierOnlyConfidence
        }
      };
    }
    if (!result.unifiedConfidence) {
      return {
        ...result,
        unifiedConfidence: 0,
        unifiedCohort: "review",
        calculationDetails: {
          similar: { matches: [], avgDiffRatio: 0, count: 0, formula: "No matches", score: 0 },
          identifier: { bestMatch: null, matchedChars: 0, totalChars: 0, matchType: "none", score: 0 },
          weights: { similar: 0.9, identifier: 0.1 },
          formula: "No identifier or similar transaction matches found",
          final: 0
        }
      };
    }
    return result;
  });
  const stats = {
    total: results.length,
    // Type stats
    income: results.filter((r) => r.type === "income").length,
    expense: results.filter((r) => r.type === "expense").length,
    typeAnomalies: results.filter((r) => r.typeAnomaly).length,
    // Group stats by cohort
    groupAuto: results.filter((r) => r.groupCohort === "auto").length,
    groupAiAssist: results.filter((r) => r.groupCohort === "ai_assist").length,
    groupReview: results.filter((r) => r.groupCohort === "review").length,
    groupConflicts: results.filter((r) => r.groupCohort === "conflict").length,
    // Category stats by cohort
    categoryAuto: results.filter((r) => r.categoryCohort === "auto").length,
    categoryAiAssist: results.filter((r) => r.categoryCohort === "ai_assist").length,
    categoryReview: results.filter((r) => r.categoryCohort === "review").length,
    categoryConflicts: results.filter((r) => r.categoryCohort === "conflict").length,
    // Unified confidence matching stats
    unifiedConfidenceMatches: results.filter((r) => r.groupMatchType === "unified_confidence" || r.categoryMatchType === "unified_confidence").length,
    identifierMatches: results.filter((r) => r.groupMatchType === "identifier" || r.categoryMatchType === "identifier").length,
    // Confidence distribution
    highConfidence: results.filter((r) => (r.unifiedConfidence || 0) >= 0.9).length,
    mediumConfidence: results.filter((r) => (r.unifiedConfidence || 0) >= 0.5 && (r.unifiedConfidence || 0) < 0.9).length,
    lowConfidence: results.filter((r) => (r.unifiedConfidence || 0) < 0.5).length
  };
  console.log(`[Categorization] Results: ${stats.identifierMatches} identifier matches, ${stats.unifiedConfidenceMatches} unified confidence matches`);
  console.log(`[Categorization] Confidence distribution: ${stats.highConfidence} high (\u226590%), ${stats.mediumConfidence} medium (50-89%), ${stats.lowConfidence} low (<50%)`);
  console.log(`[Categorization] Cohorts: AUTO=${stats.groupAuto}, AI_ASSIST=${stats.groupAiAssist}, REVIEW=${stats.groupReview}, CONFLICT=${stats.groupConflicts}`);
  return { results, stats };
}

// src/utils/colors.js
var COLORS = {
  // ──────────────────────────────────────────────
  // PRIMARY BRAND
  // ──────────────────────────────────────────────
  slainteBlue: "#4A90E2",
  // Primary brand — logo, nav, primary buttons
  slainteBlueDark: "#3D7BC7",
  // Hover/active state for primary
  slainteBlueLight: "#EFF6FF",
  // Light tint for info backgrounds
  // ──────────────────────────────────────────────
  // FINANCIAL DATA (income vs expense only)
  // ──────────────────────────────────────────────
  incomeColor: "#4ECDC4",
  // Turquoise — income, positive financial indicators
  incomeColorDark: "#3AB5AD",
  // Hover/active state for income elements
  incomeColorLight: "#E6FAF8",
  // Light tint for income backgrounds
  expenseColor: "#FF6B6B",
  // Coral — expenses, negative financial indicators
  expenseColorDark: "#E55A5A",
  // Hover/active state for expense elements
  expenseColorLight: "#FFE5E5",
  // Light tint for expense backgrounds
  // ──────────────────────────────────────────────
  // SEMANTIC STATUS (success / error / warning / info)
  // ──────────────────────────────────────────────
  success: "#10B981",
  // Green — completed, positive feedback, confirmations
  successDark: "#059669",
  // Hover/active, strong emphasis
  successLight: "#ECFDF5",
  // Background tint for success alerts/badges
  successLighter: "#D1FAE5",
  // Lighter green for borders, badges, soft fills
  successText: "#065F46",
  // Dark green text on success backgrounds
  error: "#DC2626",
  // Red — errors, destructive actions, critical alerts
  errorDark: "#B91C1C",
  // Hover/active for error buttons
  errorLight: "#FEE2E2",
  // Background tint for error alerts/badges
  errorLighter: "#FEF2F2",
  // Very light red background
  errorText: "#991B1B",
  // Dark red text on error backgrounds
  warning: "#F9A826",
  // Marigold — warnings, in-progress, attention needed
  warningDark: "#D97706",
  // Hover/active for warning elements
  warningLight: "#FEF3C7",
  // Background tint for warning alerts/badges
  warningLighter: "#FFFBEB",
  // Very light warm warning background
  warningText: "#92400E",
  // Dark amber text on warning backgrounds
  info: "#4A90E2",
  // Same as primary — informational states
  infoDark: "#3D7BC7",
  // Alias for primary dark
  infoLight: "#EFF6FF",
  // Alias for primary light tint
  infoLighter: "#DBEAFE",
  // Lighter blue for borders, badges
  infoText: "#1E40AF",
  // Dark blue text on info backgrounds
  // ──────────────────────────────────────────────
  // ACCENT COLORS
  // ──────────────────────────────────────────────
  highlightYellow: "#FFD23C",
  // Badges, highlights, important callouts
  highlightYellowLight: "#FFF9E6",
  // Background tint for highlighted sections
  accentPurple: "#7C6EBF",
  // Growth/strategy, Dara agent, premium features
  accentPurpleDark: "#6358A4",
  // Hover/active state
  accentPurpleLight: "#F0EDFA",
  // Background tint for purple elements
  // ──────────────────────────────────────────────
  // DARA AGENT BRAND
  // ──────────────────────────────────────────────
  daraViolet: "#7C3AED",
  // Dara agent primary purple
  daraVioletDark: "#6D28D9",
  // Hover/active state
  daraVioletLight: "rgba(124, 58, 237, 0.08)",
  // Subtle background tint
  daraVioletMedium: "rgba(124, 58, 237, 0.15)",
  // Medium emphasis background
  daraVioletBorder: "rgba(124, 58, 237, 0.19)",
  // Border color
  // ──────────────────────────────────────────────
  // EXTENDED CHART SERIES
  // ──────────────────────────────────────────────
  chartViolet: "#8B5CF6",
  // Extended series color
  chartPink: "#EC4899",
  // Extended series color
  // ──────────────────────────────────────────────
  // NEUTRALS
  // ──────────────────────────────────────────────
  textPrimary: "#1F2937",
  // Main text, headings
  textMuted: "#6B7280",
  // Body text, paragraphs (between primary and secondary)
  textSecondary: "#9CA3AF",
  // Secondary text, placeholders, icons
  textTertiary: "#D1D5DB",
  // Disabled text, subtle labels
  borderLight: "#E5E7EB",
  // Dividers, card borders, input borders
  borderDark: "#D1D5DB",
  // Stronger borders, focused input borders
  bgPage: "#F8FAFC",
  // Page background
  bgCard: "#FFFFFF",
  // Cards, containers, modals
  bgHover: "#F3F4F6",
  // Row/item hover states
  white: "#FFFFFF",
  // Explicit white
  // ──────────────────────────────────────────────
  // OVERLAYS & SHADOWS
  // ──────────────────────────────────────────────
  overlayLight: "rgba(0, 0, 0, 0.25)",
  // Light modal backdrop
  overlayMedium: "rgba(0, 0, 0, 0.40)",
  // Standard modal backdrop
  overlayDark: "rgba(0, 0, 0, 0.50)"
  // Heavy modal backdrop
};
var STATUS_COLORS = {
  success: {
    text: COLORS.success,
    textOn: COLORS.successText,
    // Text on successLight background
    bg: COLORS.successLight,
    bgSubtle: COLORS.successLighter,
    border: COLORS.success,
    dark: COLORS.successDark
  },
  completed: {
    // alias
    text: COLORS.success,
    textOn: COLORS.successText,
    bg: COLORS.successLight,
    bgSubtle: COLORS.successLighter,
    border: COLORS.success,
    dark: COLORS.successDark
  },
  error: {
    text: COLORS.error,
    textOn: COLORS.errorText,
    bg: COLORS.errorLight,
    bgSubtle: COLORS.errorLighter,
    border: COLORS.error,
    dark: COLORS.errorDark
  },
  critical: {
    // alias
    text: COLORS.error,
    textOn: COLORS.errorText,
    bg: COLORS.errorLight,
    bgSubtle: COLORS.errorLighter,
    border: COLORS.error,
    dark: COLORS.errorDark
  },
  warning: {
    text: COLORS.warningDark,
    textOn: COLORS.warningText,
    bg: COLORS.warningLight,
    bgSubtle: COLORS.warningLighter,
    border: COLORS.warning,
    dark: COLORS.warningDark
  },
  in_progress: {
    // alias
    text: COLORS.warningDark,
    textOn: COLORS.warningText,
    bg: COLORS.warningLight,
    bgSubtle: COLORS.warningLighter,
    border: COLORS.warning,
    dark: COLORS.warningDark
  },
  info: {
    text: COLORS.info,
    textOn: COLORS.infoText,
    bg: COLORS.infoLight,
    bgSubtle: COLORS.infoLighter,
    border: COLORS.info,
    dark: COLORS.infoDark
  },
  pending: {
    text: COLORS.textSecondary,
    textOn: COLORS.textMuted,
    bg: COLORS.bgHover,
    bgSubtle: COLORS.bgPage,
    border: COLORS.borderLight,
    dark: COLORS.textPrimary
  }
};
var CHART_COLORS = {
  income: COLORS.incomeColor,
  expense: COLORS.expenseColor,
  netProfit: COLORS.slainteBlue,
  highlight: COLORS.highlightYellow,
  series: [
    COLORS.slainteBlue,
    COLORS.incomeColor,
    COLORS.expenseColor,
    COLORS.accentPurple,
    COLORS.warning,
    COLORS.highlightYellow,
    COLORS.chartViolet,
    COLORS.chartPink
  ]
};
var colors_default = COLORS;

// src/utils/parentCategoryMapping.js
var PARENT_CATEGORIES = {
  INCOME: {
    id: "INCOME",
    name: "Income",
    icon: "\u{1F4B0}",
    color: colors_default.success,
    sections: ["INCOME"],
    defaultCategory: "1.0",
    // Income Unclassified
    description: "All revenue and income sources"
  },
  STAFF: {
    id: "STAFF",
    name: "Staff Costs",
    icon: "\u{1F465}",
    color: colors_default.warning,
    sections: ["DIRECT STAFF COSTS"],
    defaultCategory: "2.0",
    // Staff Costs Unclassified
    description: "Salaries and staff-related payments",
    alwaysUseSpecific: true
    // Staff costs should always use individual staff categories
  },
  MEDICAL: {
    id: "MEDICAL",
    name: "Medical Supplies",
    icon: "\u{1F489}",
    color: colors_default.chartViolet,
    sections: ["MEDICAL SUPPLIES"],
    defaultCategory: "10.0",
    // Medical Supplies Unclassified
    description: "Vaccines, drugs, medical equipment, staff uniforms, workwear, PPE, scrubs"
  },
  PREMISES: {
    id: "PREMISES",
    name: "Premises",
    icon: "\u{1F3E2}",
    color: colors_default.slainteBlue,
    sections: ["PREMISES COSTS"],
    defaultCategory: "20.0",
    // Premises Unclassified
    description: "Rent, utilities, maintenance, cleaning"
  },
  OFFICE_IT: {
    id: "OFFICE_IT",
    name: "Office & IT",
    icon: "\u{1F4BB}",
    color: colors_default.slainteBlue,
    sections: ["OFFICE & IT"],
    defaultCategory: "30.0",
    // Office & Admin Unclassified
    description: "Stationery, software, phones, internet"
  },
  PROFESSIONAL: {
    id: "PROFESSIONAL",
    name: "Professional",
    icon: "\u{1F4DA}",
    color: colors_default.chartPink,
    sections: ["PROFESSIONAL FEES", "PROFESSIONAL DEV"],
    defaultCategory: "40.0",
    // Professional Fees Unclassified
    description: "Accountants, subscriptions, training, conferences"
  },
  OTHER: {
    id: "OTHER",
    name: "Petty Cash / Other",
    icon: "\u{1F4CA}",
    color: colors_default.textMuted,
    sections: ["MOTOR & TRANSPORT", "CAPITAL & DEPRECIATION", "PETTY CASH / OTHER EXPENSES"],
    defaultCategory: "80.0",
    // Petty Cash / Other Unclassified
    description: "Motor costs, equipment purchases, miscellaneous"
  },
  NON_BUSINESS: {
    id: "NON_BUSINESS",
    name: "Non-Business / Drawings",
    icon: "\u{1F3E6}",
    color: colors_default.textSecondary,
    sections: ["NON-BUSINESS"],
    defaultCategory: "90.0",
    // Partner Drawings
    description: "Partner drawings, personal expenses, non-deductible items"
  }
};

// src/utils/transactionProcessor.js
var processTransactionData = (results, selectedFile, categorizeTransaction2) => {
  if (!results.data || results.data.length === 0) {
    throw new Error("No data found in the file.");
  }
  const processedTransactions = results.data.filter((row, index) => {
    const hasData = row && Object.keys(row).length > 0 && (row.Details || row.details);
    return hasData;
  }).map((row, index) => {
    const details = row.Details || row.details || row.Description || row.description || row.Particulars || row.particulars || row.Transaction || row.transaction || row.Narrative || row.narrative || row.Reference || row.reference || "";
    const debitValue = row.Debit || row.debit || row["Debit Amount"] || row["Debit_Amount"] || row.DR || row.dr || row.Out || row.out || row.Withdrawal || row.withdrawal || 0;
    const creditValue = row.Credit || row.credit || row["Credit Amount"] || row["Credit_Amount"] || row.CR || row.cr || row.In || row.in || row.Deposit || row.deposit || 0;
    const amountValue = row.Amount || row.amount || row.Value || row.value || 0;
    const debit = debitValue !== void 0 && debitValue !== null ? parseFloat(debitValue) || 0 : 0;
    const credit = creditValue !== void 0 && creditValue !== null ? parseFloat(creditValue) || 0 : 0;
    const amount = amountValue !== void 0 && amountValue !== null ? parseFloat(amountValue) || 0 : 0;
    let parsedDate = null;
    let monthYear = null;
    const dateValue = row.Date || row.date || row["Transaction Date"] || row["Value Date"] || row["Date"] || row.TransactionDate || row["Processing Date"] || "";
    if (dateValue) {
      try {
        let date;
        if (typeof dateValue === "number") {
          date = new Date((dateValue - 25569) * 86400 * 1e3);
        } else if (typeof dateValue === "string") {
          const dateStr = dateValue.toString().trim();
          if (dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
            const parts = dateStr.split(/[\/\-]/);
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
              date = new Date(year, month - 1, day);
            }
          } else if (dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2}$/)) {
            const parts = dateStr.split(/[\/\-]/);
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);
            year = year > 50 ? 1900 + year : 2e3 + year;
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
              date = new Date(year, month - 1, day);
            }
          } else {
            date = new Date(dateStr);
          }
        } else {
          date = new Date(dateValue);
        }
        if (date && !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
          parsedDate = date;
          monthYear = date.toISOString().substring(0, 7);
        } else {
          console.warn("Invalid or out-of-range date:", dateValue, "parsed as:", date);
        }
      } catch (e) {
        console.warn("Date parsing error for:", dateValue, "Error:", e.message);
      }
    }
    const transactionObj = {
      id: `${selectedFile?.name || "manual"}-${index}`,
      date: parsedDate,
      details,
      debit,
      credit,
      amount: Math.max(Math.abs(debit), Math.abs(credit), Math.abs(amount)),
      balance: parseFloat(row.Balance || row.balance || row["Running Balance"] || row["Closing Balance"] || 0) || 0,
      monthYear,
      fileName: selectedFile?.name || "manual",
      rawRow: row
    };
    let category = categorizeTransaction2(transactionObj);
    const isIncomeTransaction = credit > 0 || amount > 0 && debit === 0;
    if (!category && isIncomeTransaction) {
      category = "__AUTO_INCOME__";
    }
    return {
      ...transactionObj,
      category,
      isIncome: category ? category === "__AUTO_INCOME__" || category.type === "income" : isIncomeTransaction
    };
  });
  const categorized = processedTransactions.filter((t) => t.category && t.category !== "__AUTO_INCOME__");
  const unidentified = processedTransactions.filter((t) => !t.category);
  const autoIncome = processedTransactions.filter((t) => t.category === "__AUTO_INCOME__");
  return { categorized, unidentified, autoIncome };
};
var processTransactionsWithEngine = (rawTransactions, categoryMapping, existingTransactions = []) => {
  if (!rawTransactions || rawTransactions.length === 0) {
    return { transactions: [], stats: {} };
  }
  const { results, stats } = categorizeTransactionBatch(rawTransactions, categoryMapping, existingTransactions);
  const enrichedTransactions = results.map((result) => {
    const fullCategory = result.categoryCode ? categoryMapping.find((c) => c.code === result.categoryCode) : null;
    return {
      // Original transaction fields
      id: result.id,
      date: result.date,
      details: result.details,
      debit: result.debit,
      credit: result.credit,
      amount: result.amount,
      balance: result.balance,
      monthYear: result.monthYear,
      fileName: result.fileName,
      // Layer 1: Type
      type: result.type,
      typeConfidence: result.typeConfidence,
      typeAnomaly: result.typeAnomaly,
      typeReviewed: false,
      // Layer 2: Group
      group: result.group,
      groupConfidence: result.groupConfidence,
      groupMatchedIdentifier: result.groupMatchedIdentifier,
      groupMatchType: result.groupMatchType,
      // 'identifier', 'probability', 'none', 'type_derived'
      groupReason: result.groupReason,
      // Explanation for probability matches
      groupCohort: result.groupCohort,
      groupConflicts: result.groupConflicts || [],
      // Array of conflicting group options
      groupReviewed: false,
      groupAISuggested: false,
      // Layer 3: Category
      categoryCode: result.categoryCode,
      categoryName: result.categoryName,
      categoryConfidence: result.categoryConfidence,
      categoryMatchedIdentifier: result.categoryMatchedIdentifier,
      categoryMatchType: result.categoryMatchType,
      // 'identifier', 'probability', 'none'
      categoryReason: result.categoryReason,
      // Explanation for probability matches
      categoryCohort: result.categoryCohort,
      categoryConflicts: result.categoryConflicts || [],
      // Array of conflicting category options
      categoryReviewed: false,
      categoryAISuggested: false,
      // AI assistance metadata (populated later if AI is called)
      aiGroupSuggestion: null,
      // NEW: { group, confidence, reasoning, alternatives }
      aiCategorySuggestion: null,
      // NEW: { categoryCode, confidence, reasoning, alternatives }
      // Unified confidence scoring (Levenshtein-based)
      unifiedConfidence: result.unifiedConfidence,
      unifiedCohort: result.unifiedCohort,
      calculationDetails: result.calculationDetails,
      similarTransactionMatch: result.similarTransactionMatch,
      // Backward compatibility - full category object
      category: fullCategory,
      // Layer 5: User annotations
      comment: result.comment || "",
      // Legacy flag
      isIncome: result.type === "income"
    };
  });
  return {
    transactions: enrichedTransactions,
    stats
  };
};
var getTransactionKey = (transaction) => {
  const dateStr = transaction.date instanceof Date ? transaction.date.toISOString().split("T")[0] : String(transaction.date || "");
  const amount = Math.max(
    Math.abs(transaction.debit || 0),
    Math.abs(transaction.credit || 0),
    Math.abs(transaction.amount || 0)
  );
  const details = (transaction.details || "").toLowerCase().trim();
  return `${dateStr}|${amount}|${details}`;
};

// src/utils/bankStatementParsers.js
function detectBank(text) {
  const textLower = text.toLowerCase();
  if (textLower.includes("allied irish bank") || textLower.includes("alliedirish") || textLower.includes("aib.ie") || textLower.includes("aibkie2d") || /ie\d{2}\s*aibk/i.test(text)) {
    return "aib";
  }
  if (textLower.includes("bank of ireland") || textLower.includes("bofiie2d") || textLower.includes("90-00-17")) {
    return "boi";
  }
  if (textLower.includes("permanent tsb") || textLower.includes("ptsb.ie")) {
    return "ptsb";
  }
  return null;
}
function getSupportedBanks() {
  return [
    { id: "boi", name: "Bank of Ireland", supported: true },
    { id: "aib", name: "AIB", supported: true },
    { id: "ptsb", name: "Permanent TSB", supported: false },
    { id: "ulster", name: "Ulster Bank", supported: false }
  ];
}
function detectBOIColumnPositions(lines) {
  const amountPattern = /^[\d,]+\.\d{2}$/;
  for (const line of lines) {
    const lineText = line.items.map((i) => i.text).join(" ").toLowerCase();
    if (lineText.includes("out") && lineText.includes("in")) {
      const outItem = line.items.find((i) => i.text.toLowerCase() === "out");
      const inItem = line.items.find((i) => i.text.toLowerCase() === "in");
      const balanceItem = line.items.find((i) => i.text.toLowerCase().includes("balance"));
      if (outItem && inItem) {
        const columns = {
          paymentsOut: outItem.x,
          paymentsIn: inItem.x,
          balance: balanceItem?.x || inItem.x + 80,
          usePatternFallback: false
        };
        return validateColumnSpacing(columns);
      }
    }
  }
  const amountPositions = [];
  for (const line of lines) {
    const amountItems = line.items.filter((i) => amountPattern.test(i.text));
    for (const item of amountItems) {
      amountPositions.push(item.x);
    }
  }
  if (amountPositions.length >= 10) {
    const clusters = {};
    amountPositions.forEach((x) => {
      const bucket = Math.round(x / 20) * 20;
      clusters[bucket] = (clusters[bucket] || 0) + 1;
    });
    const sortedBuckets = Object.entries(clusters).map(([bucket, count]) => ({ x: parseInt(bucket), count })).sort((a, b) => a.x - b.x);
    const minCount = Math.max(3, Math.floor(amountPositions.length * 0.05));
    const significantClusters = sortedBuckets.filter((c) => c.count >= minCount);
    if (significantClusters.length >= 3) {
      const rightClusters = significantClusters.slice(-3);
      const columns = {
        paymentsOut: rightClusters[0].x,
        paymentsIn: rightClusters[1].x,
        balance: rightClusters[2].x,
        usePatternFallback: false
      };
      return validateColumnSpacing(columns);
    } else if (significantClusters.length === 2) {
      return {
        paymentsOut: significantClusters[0].x,
        paymentsIn: significantClusters[0].x + 60,
        balance: significantClusters[1].x,
        usePatternFallback: true
      };
    }
  }
  return {
    paymentsOut: 380,
    paymentsIn: 460,
    balance: 540,
    usePatternFallback: true
  };
}
function validateColumnSpacing(columns) {
  const MIN_COLUMN_SPACING = 50;
  const outToIn = Math.abs(columns.paymentsIn - columns.paymentsOut);
  const inToBalance = Math.abs(columns.balance - columns.paymentsIn);
  if (outToIn < MIN_COLUMN_SPACING || inToBalance < MIN_COLUMN_SPACING) {
    return { ...columns, usePatternFallback: true };
  }
  return columns;
}
function classifyAmountColumn(x, columns) {
  const tolerance = 40;
  if (Math.abs(x - columns.balance) < tolerance) return "balance";
  if (Math.abs(x - columns.paymentsIn) < tolerance) return "credit";
  if (Math.abs(x - columns.paymentsOut) < tolerance) return "debit";
  const distToOut = Math.abs(x - columns.paymentsOut);
  const distToIn = Math.abs(x - columns.paymentsIn);
  const distToBalance = Math.abs(x - columns.balance);
  const minDist = Math.min(distToOut, distToIn, distToBalance);
  if (minDist === distToBalance) return "balance";
  if (minDist === distToIn) return "credit";
  return "debit";
}
function detectAIBColumnPositions(lines) {
  const amountPattern = /^[\d,]+\.\d{2}$/;
  for (const line of lines) {
    const lineText = line.items.map((i) => i.text).join(" ").toLowerCase();
    if (lineText.includes("debit") && lineText.includes("credit") && lineText.includes("balance")) {
      const debitItem = line.items.find((i) => /debit/i.test(i.text));
      const creditItem = line.items.find((i) => /credit/i.test(i.text));
      const balanceItem = line.items.find((i) => /balance/i.test(i.text));
      if (debitItem && creditItem && balanceItem) {
        const columns = {
          paymentsOut: debitItem.x,
          paymentsIn: creditItem.x,
          balance: balanceItem.x,
          usePatternFallback: false
        };
        return validateColumnSpacing(columns);
      }
    }
  }
  const amountPositions = [];
  for (const line of lines) {
    const normalizedItems = mergeAmountFragments(line.items);
    const amountItems = normalizedItems.filter((i) => amountPattern.test(i.text));
    for (const item of amountItems) {
      amountPositions.push(item.x);
    }
  }
  if (amountPositions.length >= 10) {
    const clusters = {};
    amountPositions.forEach((x) => {
      const bucket = Math.round(x / 20) * 20;
      clusters[bucket] = (clusters[bucket] || 0) + 1;
    });
    const sortedBuckets = Object.entries(clusters).map(([bucket, count]) => ({ x: parseInt(bucket), count })).sort((a, b) => a.x - b.x);
    const minCount = Math.max(3, Math.floor(amountPositions.length * 0.05));
    const significantClusters = sortedBuckets.filter((c) => c.count >= minCount);
    if (significantClusters.length >= 3) {
      const rightClusters = significantClusters.slice(-3);
      const columns = {
        paymentsOut: rightClusters[0].x,
        paymentsIn: rightClusters[1].x,
        balance: rightClusters[2].x,
        usePatternFallback: false
      };
      return validateColumnSpacing(columns);
    } else if (significantClusters.length === 2) {
      return {
        paymentsOut: significantClusters[0].x,
        paymentsIn: significantClusters[0].x + 60,
        balance: significantClusters[1].x,
        usePatternFallback: true
      };
    }
  }
  return {
    paymentsOut: 350,
    paymentsIn: 430,
    balance: 510,
    usePatternFallback: true
  };
}
function mergeAmountFragments(items) {
  const amountPattern = /^[\d,]+\.\d{2}$/;
  const result = [];
  let i = 0;
  while (i < items.length) {
    const noSpace = items[i].text.replace(/\s/g, "");
    if (noSpace !== items[i].text && amountPattern.test(noSpace)) {
      result.push({ ...items[i], text: noSpace });
      i++;
      continue;
    }
    if (i + 1 < items.length) {
      const xGap = items[i + 1].x - (items[i].x + items[i].text.length * 5);
      const merged2 = items[i].text.replace(/\s/g, "") + items[i + 1].text.replace(/\s/g, "");
      if (xGap < 30 && amountPattern.test(merged2)) {
        result.push({ text: merged2, x: items[i].x, y: items[i].y });
        i += 2;
        continue;
      }
      if (i + 2 < items.length) {
        const merged3 = items[i].text.replace(/\s/g, "") + items[i + 1].text.replace(/\s/g, "") + items[i + 2].text.replace(/\s/g, "");
        if (amountPattern.test(merged3)) {
          result.push({ text: merged3, x: items[i].x, y: items[i].y });
          i += 3;
          continue;
        }
      }
    }
    result.push(items[i]);
    i++;
  }
  return result;
}
function inferIsIncome(description) {
  const descUpper = description.toUpperCase();
  const incomePatterns = [
    /\sSP$/,
    /\bSP\b/,
    /^BOIPA/,
    /^BILLINK/,
    /\bCREDIT\b/,
    /\bTFR FROM\b/,
    /\bFROM\s+\d/,
    /\bSALARY\b/,
    /\bWAGES?\b/,
    /\bGMS\b/,
    /\bPCRS\b/,
    /\bHSE\b/,
    /\bVHI\b/,
    /\bREFUND\b/,
    /\bREIMBURSE/,
    /\bINT\s*PD\b/,
    /CR$/,
    /^V\d{10,}P\d/,
    /^XFR:/
  ];
  const expensePatterns = [
    /\bSEPA DD\b/,
    /\bDD\s+\d/,
    /\bPOS\b/,
    /\bTO\s+\d/,
    /\bTFR TO\b/,
    /\bDEBIT\b/,
    /\bCHQ\b/,
    /\bCHEQUE\b/,
    /\bATM\b/,
    /\bW\/D\b/,
    /\bFEE\b/,
    /\bCHARGE\b/,
    /\bBILL\b/,
    /\bPAYMENT\b/,
    /\bD\/D\b/,
    /\bS\/O\b/
  ];
  for (const pattern of incomePatterns) {
    if (pattern.test(descUpper)) return true;
  }
  for (const pattern of expensePatterns) {
    if (pattern.test(descUpper)) return false;
  }
  return false;
}
function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  let match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }
  match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }
  match = str.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (match) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    return new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
  }
  return null;
}
function parseAmount(amountStr) {
  if (!amountStr) return null;
  const cleaned = amountStr.toString().replace(/[€£$,\s]/g, "").trim();
  if (!cleaned || cleaned === "") return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
function getDateRange(transactions) {
  if (!transactions || transactions.length === 0) return null;
  const dates = transactions.filter((t) => t.date).map((t) => new Date(t.date).getTime());
  if (dates.length === 0) return null;
  return {
    from: new Date(Math.min(...dates)).toISOString().split("T")[0],
    to: new Date(Math.max(...dates)).toISOString().split("T")[0]
  };
}
function parseTransactionLine(line, date, previousBalance) {
  if (/BALANCE FORWARD/i.test(line)) {
    const amounts2 = line.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/g);
    if (amounts2 && amounts2.length > 0) {
      return {
        isBalanceForward: true,
        balance: parseAmount(amounts2[amounts2.length - 1])
      };
    }
    return null;
  }
  const amountMatches = line.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/g);
  if (!amountMatches || amountMatches.length === 0) {
    return null;
  }
  let description = line;
  for (const amt of amountMatches) {
    description = description.replace(amt, " ");
  }
  description = description.replace(/\s+/g, " ").trim();
  if (description.length < 2) {
    return null;
  }
  const amounts = amountMatches.map((a) => parseAmount(a));
  let debit = null;
  let credit = null;
  let balance = null;
  if (amounts.length === 1) {
    const txAmount = amounts[0];
    const isIncome = inferIsIncome(description);
    if (isIncome) {
      credit = txAmount;
    } else {
      debit = txAmount;
    }
  } else if (amounts.length === 2) {
    const txAmount = amounts[0];
    balance = amounts[1];
    if (previousBalance !== null) {
      const diff = balance - previousBalance;
      if (Math.abs(diff - txAmount) < 0.02) {
        credit = txAmount;
      } else if (Math.abs(diff + txAmount) < 0.02) {
        debit = txAmount;
      } else {
        const isIncome = inferIsIncome(description);
        if (isIncome) {
          credit = txAmount;
        } else {
          debit = txAmount;
        }
      }
    } else {
      const isIncome = inferIsIncome(description);
      if (isIncome) {
        credit = txAmount;
      } else {
        debit = txAmount;
      }
    }
  } else if (amounts.length >= 3) {
    debit = amounts[0];
    credit = amounts.length > 2 ? amounts[1] : null;
    balance = amounts[amounts.length - 1];
  }
  return {
    date,
    details: description,
    debit,
    credit,
    balance,
    amount: debit || credit || 0,
    isIncome: credit !== null && credit > 0
  };
}
var BANK_PARSERS = {
  boi: parseBOIStatement
};
function parseBOIStatement(pdfText) {
  const transactions = [];
  const lines = pdfText.split("\n").map((line) => line.trim()).filter((line) => line);
  const datePattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i;
  const skipPatterns = [
    /^Bank of Ireland/i,
    /^Registered Information/i,
    /^Tel \(/i,
    /^Fax \(/i,
    /^Branch code/i,
    /^Bank Identifier/i,
    /^Your account name/i,
    /^Account number/i,
    /^IBAN/i,
    /^Statement date/i,
    /^Your Current Account/i,
    /^Page \d+ of \d+/i,
    /^DateTransaction details/i,
    /^SUBTOTAL:/i,
    /^All Business Borrowers/i,
    /^to include a review/i,
    /^alternative arrangements/i,
    /^0818 200 372/i,
    /^IE\d{2}\s+BOFI/i,
    /^Current lending rate/i,
    /BALANCE FORWARD/i
  ];
  let currentDate = null;
  let previousBalance = null;
  let statementDate = null;
  let accountNumber = null;
  for (const line of lines) {
    const stmtDateMatch = line.match(/Statement date\s*(\d{1,2}\s+\w+\s+\d{4})/i);
    if (stmtDateMatch) statementDate = stmtDateMatch[1];
    const acctMatch = line.match(/Account number\s*(\d+)/i);
    if (acctMatch) accountNumber = acctMatch[1];
  }
  for (const line of lines) {
    if (skipPatterns.some((pattern) => pattern.test(line))) continue;
    if (line.length < 5) continue;
    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
      const remainder = line.replace(dateMatch[0], "").trim();
      if (remainder.length > 0) {
        const tx = parseTransactionLine(remainder, currentDate, previousBalance);
        if (tx && !tx.isBalanceForward) {
          transactions.push(tx);
          if (tx.balance !== null) previousBalance = tx.balance;
        } else if (tx && tx.isBalanceForward) {
          previousBalance = tx.balance;
        }
      }
    } else if (currentDate) {
      const tx = parseTransactionLine(line, currentDate, previousBalance);
      if (tx && !tx.isBalanceForward) {
        transactions.push(tx);
        if (tx.balance !== null) previousBalance = tx.balance;
      }
    }
  }
  return {
    transactions,
    metadata: {
      statementDate,
      accountNumber,
      bank: "Bank of Ireland"
    }
  };
}
function parseBOIStatementWithPositions(linesWithPositions, fullText) {
  const transactions = [];
  const columns = detectBOIColumnPositions(linesWithPositions);
  const datePattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i;
  const amountPattern = /^[\d,]+\.\d{2}$/;
  const skipPatterns = [
    /^Bank of Ireland/i,
    /^Registered Information/i,
    /^Tel \(/i,
    /^Branch code/i,
    /^Your account name/i,
    /^Account number/i,
    /^IBAN/i,
    /^Statement date/i,
    /^Your Current Account/i,
    /^Page \d+ of \d+/i,
    /^DateTransaction/i,
    /^Date\s*Transaction/i,
    /^SUBTOTAL:/i,
    /^All Business Borrowers/i,
    /^0818 200 372/i,
    /^IE\d{2}\s+BOFI/i,
    /BALANCE FORWARD/i,
    /^Payments\s*-?\s*out/i,
    /^Payments\s*-?\s*in/i,
    /^Balance$/i
  ];
  let currentDate = null;
  let statementDate = null;
  let accountNumber = null;
  const stmtDateMatch = fullText.match(/Statement date\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (stmtDateMatch) statementDate = stmtDateMatch[1];
  const acctMatch = fullText.match(/Account number\s*(\d+)/i);
  if (acctMatch) accountNumber = acctMatch[1];
  for (const line of linesWithPositions) {
    const lineText = line.items.map((i) => i.text).join(" ").trim();
    if (skipPatterns.some((pattern) => pattern.test(lineText))) continue;
    if (lineText.length < 5) continue;
    const dateMatch = lineText.match(datePattern);
    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
    }
    if (!currentDate) continue;
    const amountItems = line.items.filter((item) => amountPattern.test(item.text));
    if (amountItems.length === 0) continue;
    const descItems = line.items.filter(
      (item) => !amountPattern.test(item.text) && !datePattern.test(item.text)
    );
    const description = descItems.map((i) => i.text).join(" ").trim();
    if (description.length < 2) continue;
    if (/BALANCE FORWARD/i.test(description)) continue;
    let debit = null;
    let credit = null;
    let balance = null;
    for (const amountItem of amountItems) {
      const amount = parseAmount(amountItem.text);
      const column = classifyAmountColumn(amountItem.x, columns);
      switch (column) {
        case "debit":
          debit = amount;
          break;
        case "credit":
          credit = amount;
          break;
        case "balance":
          balance = amount;
          break;
      }
    }
    if (columns.usePatternFallback && amountItems.length === 1 && debit !== null && credit === null) {
      const patternSaysIncome = inferIsIncome(description);
      if (patternSaysIncome) {
        credit = debit;
        debit = null;
      }
    }
    if (debit !== null || credit !== null) {
      transactions.push({
        date: currentDate,
        details: description,
        debit,
        credit,
        balance,
        amount: debit || credit || 0,
        isIncome: credit !== null && credit > 0
      });
    }
  }
  return {
    transactions,
    metadata: {
      statementDate,
      accountNumber,
      bank: "Bank of Ireland"
    }
  };
}
function parseAIBStatementWithPositions(linesWithPositions, fullText) {
  const transactions = [];
  const columns = detectAIBColumnPositions(linesWithPositions);
  const datePattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i;
  const amountPattern = /^[\d,]+\.\d{2}$/;
  const skipPatterns = [
    /^Allied Irish Banks/i,
    /^Statement of Account/i,
    /^Personal Bank Account/i,
    /^Branch$/i,
    /^National Sort Code/i,
    /^Telephone$/i,
    /^Page Number$/i,
    /^Account Name$/i,
    /^Account Number$/i,
    /^Date of Statement/i,
    /^IBAN:/i,
    /^Authorised Limit/i,
    /^Forward$/i,
    /^DateDetails/i,
    /^Date\s*Details/i,
    /Debit\s*€.*Credit\s*€.*Balance\s*€/i,
    /^Thisisaneligibledeposit/i,
    /^DepositGuaranteeScheme/i,
    /^'DepositGuaranteeScheme/i,
    /^ourwebsite/i,
    /^ForImportantInformation/i,
    /^www\.aib\.ie/i,
    /^Thank you for banking/i,
    /^Overdrawn balances/i,
    /^AlliedIrishBanks/i,
    /^YourAuthorisedLimit/i,
    /^\d{2}-\d{2}-\d{2}$/,
    /^\d{3,4}$/,
    /^Claremorris/i,
    /^Co\.?\s+\w+\.?$/i,
    /BALANCE FORWARD/i,
    /^Interest Rate$/i,
    /^Lending @ /i,
    /^\d+\.\d+ (?:USD|GBP|EUR)@$/i,
    /^\d+\.\d{4,}$/,
    /^INCL FX FEE/i,
    /^\d{2}\w{3}\d{2}\s+\d{2}:\d{2}$/i,
    /^TxnDate:/i,
    /^DUBLIN$/i
  ];
  let currentDate = null;
  let statementDate = null;
  let accountNumber = null;
  let sortCode = null;
  const stmtDateMatch = fullText.match(/Date of Statement\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (stmtDateMatch) statementDate = stmtDateMatch[1];
  const acctMatch = fullText.match(/Account Number\s*([\d-]+)/i);
  if (acctMatch) accountNumber = acctMatch[1];
  const sortCodeMatch = fullText.match(/National Sort Code\s*([\d-]+)/i);
  if (sortCodeMatch) sortCode = sortCodeMatch[1];
  for (const line of linesWithPositions) {
    const normalizedItems = mergeAmountFragments(line.items);
    const lineText = normalizedItems.map((i) => i.text).join(" ").trim();
    if (skipPatterns.some((pattern) => pattern.test(lineText))) continue;
    if (lineText.length < 3) continue;
    if (/^\d+\s+\w+$/i.test(lineText) && !datePattern.test(lineText) && !amountPattern.test(lineText)) {
      const hasAmount = normalizedItems.some((i) => amountPattern.test(i.text));
      if (!hasAmount) continue;
    }
    const dateMatch = lineText.match(datePattern);
    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
    }
    if (!currentDate) continue;
    const amountItems = normalizedItems.filter((item) => amountPattern.test(item.text));
    if (amountItems.length === 0) continue;
    const descItems = normalizedItems.filter((item) => {
      if (amountPattern.test(item.text)) return false;
      if (dateMatch) {
        const dateParts = dateMatch[1].split(/\s+/);
        if (dateParts.includes(item.text)) return false;
      }
      return true;
    });
    const description = descItems.map((i) => i.text).join(" ").trim();
    if (description.length < 2) continue;
    if (/^BALANCE FORWARD/i.test(description)) continue;
    if (/^Interest Rate$/i.test(description)) continue;
    if (/^Lending @/i.test(description)) continue;
    if (/^\d+\.\d+ (?:USD|GBP|EUR)@/i.test(description)) continue;
    if (/^INCL FX FEE/i.test(description)) continue;
    if (/^\d+\.\d{4,}$/.test(description)) continue;
    let debit = null;
    let credit = null;
    let balance = null;
    const sortedAmounts = [...amountItems].sort((a, b) => a.x - b.x);
    if (sortedAmounts.length === 1) {
      const amount = parseAmount(sortedAmounts[0].text);
      const x = sortedAmounts[0].x;
      const distToBalance = Math.abs(x - columns.balance);
      const distToDebit = Math.abs(x - columns.paymentsOut);
      if (distToBalance < distToDebit) {
        balance = amount;
      } else {
        if (inferIsIncome(description)) {
          credit = amount;
        } else {
          debit = amount;
        }
      }
    } else if (sortedAmounts.length === 2) {
      const leftAmount = parseAmount(sortedAmounts[0].text);
      const rightAmount = parseAmount(sortedAmounts[1].text);
      balance = rightAmount;
      if (inferIsIncome(description)) {
        credit = leftAmount;
      } else {
        debit = leftAmount;
      }
    } else if (sortedAmounts.length >= 3) {
      debit = parseAmount(sortedAmounts[0].text);
      credit = parseAmount(sortedAmounts[1].text);
      balance = parseAmount(sortedAmounts[sortedAmounts.length - 1].text);
    }
    if (debit !== null || credit !== null) {
      transactions.push({
        date: currentDate,
        details: description,
        debit,
        credit,
        balance,
        amount: debit || credit || 0,
        isIncome: credit !== null && credit > 0
      });
    }
  }
  return {
    transactions,
    metadata: {
      statementDate,
      accountNumber,
      sortCode,
      bank: "AIB"
    }
  };
}
function parseBankStatement(bank, fullText, linesWithPositions) {
  if (bank === "boi") {
    return parseBOIStatementWithPositions(linesWithPositions, fullText);
  } else if (bank === "aib") {
    return parseAIBStatementWithPositions(linesWithPositions, fullText);
  } else {
    const parser = BANK_PARSERS[bank];
    if (!parser) {
      throw new Error(`No parser available for ${bank}. Currently supported: Bank of Ireland, AIB`);
    }
    return parser(fullText);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONFIDENCE_THRESHOLDS,
  GROUPS,
  SECTION_TO_GROUP,
  buildGroupIdentifierIndex,
  buildIdentifierIndex,
  calculateUnifiedConfidence,
  calculateUnmatchedProbability,
  categorizeTransaction,
  categorizeTransactionBatch,
  cleanForClustering,
  cleanForSimilarity,
  clusterSimilarTransactions,
  detectBank,
  detectType,
  differenceRatio,
  findIdentifierMatch,
  findSimilarCategorizedTransactions,
  getAdaptiveWeights,
  getDateRange,
  getIdentifierMatchConfidence,
  getSuggestionFromSimilarTransactions,
  getSupportedBanks,
  getTransactionKey,
  identifierMatchScore,
  inferIsIncome,
  levenshteinDistance,
  levenshteinSimilarity,
  matchCategory,
  matchGroup,
  mergeAmountFragments,
  parseAIBStatementWithPositions,
  parseAmount,
  parseBOIStatement,
  parseBOIStatementWithPositions,
  parseBankDate,
  parseBankStatement,
  processTransactionData,
  processTransactionsWithEngine
});
