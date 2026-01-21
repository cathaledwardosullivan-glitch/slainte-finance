// Utility functions for category refinement detection and logic

/**
 * Check if a category code is a "partially classified" parent category (ends in .0)
 */
export function isPartiallyClassified(categoryCode) {
  return categoryCode && categoryCode.endsWith('.0');
}

/**
 * Get count of partially classified transactions
 */
export function getPartiallyClassifiedCount(transactions) {
  return transactions.filter(t =>
    t.category && isPartiallyClassified(t.category.code)
  ).length;
}

/**
 * Check if refinement should be recommended based on threshold
 * Returns true if >= 10% of transactions are partially classified
 */
export function shouldRecommendRefinement(transactions) {
  if (transactions.length === 0) return false;

  const partialCount = getPartiallyClassifiedCount(transactions);
  const percentage = (partialCount / transactions.length) * 100;

  return {
    shouldShow: percentage >= 10,
    count: partialCount,
    total: transactions.length,
    percentage: percentage.toFixed(1)
  };
}

/**
 * Check if refinement prompt was skipped this session
 */
export function wasRefinementSkipped() {
  return sessionStorage.getItem('refinement_skipped') === 'true';
}

/**
 * Mark refinement as skipped for this session
 */
export function markRefinementSkipped() {
  sessionStorage.setItem('refinement_skipped', 'true');
}

/**
 * Clear refinement skip flag
 */
export function clearRefinementSkip() {
  sessionStorage.removeItem('refinement_skipped');
}

/**
 * Get partially classified transactions grouped by parent category
 */
export function getPartiallyClassifiedByCategory(transactions) {
  const partial = transactions.filter(t =>
    t.category && isPartiallyClassified(t.category.code)
  );

  const grouped = {};
  partial.forEach(transaction => {
    const code = transaction.category.code;
    if (!grouped[code]) {
      grouped[code] = {
        parentCode: code,
        parentName: transaction.category.name,
        transactions: []
      };
    }
    grouped[code].transactions.push(transaction);
  });

  return grouped;
}

/**
 * Get essential vs optional category counts
 */
export function getRefinementCategoryCounts(transactions) {
  const essentialCodes = ['20.0', '40.0', '50.0'];
  const optionalCodes = ['10.0', '30.0', '80.0'];

  const partial = transactions.filter(t =>
    t.category && isPartiallyClassified(t.category.code)
  );

  const essential = partial.filter(t => essentialCodes.includes(t.category.code)).length;
  const optional = partial.filter(t => optionalCodes.includes(t.category.code)).length;

  return {
    essential,
    optional,
    total: essential + optional
  };
}
