// Entry point for esbuild bundling into electron/utils/categorizationBundle.cjs
// Do NOT import this file from React components — use the source files directly.

// Core engine
export {
  categorizeTransactionBatch,
  categorizeTransaction,
  CONFIDENCE_THRESHOLDS,
  GROUPS,
  SECTION_TO_GROUP,
  buildIdentifierIndex,
  buildGroupIdentifierIndex,
  findIdentifierMatch,
  getIdentifierMatchConfidence,
  findSimilarCategorizedTransactions,
  getSuggestionFromSimilarTransactions,
  detectType,
  calculateUnmatchedProbability,
  matchGroup,
  matchCategory,
} from './categorizationEngine';

// String utilities & scoring
export {
  levenshteinSimilarity,
  levenshteinDistance,
  differenceRatio,
  calculateUnifiedConfidence,
  getAdaptiveWeights,
  clusterSimilarTransactions,
  cleanForSimilarity,
  cleanForClustering,
  identifierMatchScore,
} from './stringUtils';

// Transaction processing
export {
  processTransactionsWithEngine,
  processTransactionData,
  getTransactionKey,
} from './transactionProcessor';

// Bank statement parsing (pure functions — no PDF.js dependency)
export {
  detectBank,
  getSupportedBanks,
  parseBankStatement,
  parseBOIStatement,
  parseBOIStatementWithPositions,
  parseAIBStatementWithPositions,
  inferIsIncome,
  parseDate as parseBankDate,
  parseAmount,
  getDateRange,
  mergeAmountFragments,
} from './bankStatementParsers';
