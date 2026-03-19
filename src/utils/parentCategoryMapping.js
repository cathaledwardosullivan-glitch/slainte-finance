/**
 * Parent Category Mapping for 2-Step Categorization
 *
 * Step 1 (Onboarding): Users categorize to 7 high-level parent categories
 * Step 2 (P&L Refinement): Users can drill down to specific subcategories
 *
 * This maintains backward compatibility with the full category system while
 * simplifying initial data entry for new users.
 */
import COLORS from '../utils/colors';

export const PARENT_CATEGORIES = {
  INCOME: {
    id: 'INCOME',
    name: 'Income',
    icon: '💰',
    color: COLORS.success,
    sections: ['INCOME'],
    defaultCategory: '1.0', // Income Unclassified
    description: 'All revenue and income sources'
  },
  STAFF: {
    id: 'STAFF',
    name: 'Staff Costs',
    icon: '👥',
    color: COLORS.warning,
    sections: ['DIRECT STAFF COSTS'],
    defaultCategory: '2.0', // Staff Costs Unclassified
    description: 'Salaries and staff-related payments',
    alwaysUseSpecific: true // Staff costs should always use individual staff categories
  },
  MEDICAL: {
    id: 'MEDICAL',
    name: 'Medical Supplies',
    icon: '💉',
    color: COLORS.chartViolet,
    sections: ['MEDICAL SUPPLIES'],
    defaultCategory: '10.0', // Medical Supplies Unclassified
    description: 'Vaccines, drugs, medical equipment, staff uniforms, workwear, PPE, scrubs'
  },
  PREMISES: {
    id: 'PREMISES',
    name: 'Premises',
    icon: '🏢',
    color: COLORS.slainteBlue,
    sections: ['PREMISES COSTS'],
    defaultCategory: '20.0', // Premises Unclassified
    description: 'Rent, utilities, maintenance, cleaning'
  },
  OFFICE_IT: {
    id: 'OFFICE_IT',
    name: 'Office & IT',
    icon: '💻',
    color: COLORS.slainteBlue,
    sections: ['OFFICE & IT'],
    defaultCategory: '30.0', // Office & Admin Unclassified
    description: 'Stationery, software, phones, internet'
  },
  PROFESSIONAL: {
    id: 'PROFESSIONAL',
    name: 'Professional',
    icon: '📚',
    color: COLORS.chartPink,
    sections: ['PROFESSIONAL FEES', 'PROFESSIONAL DEV'],
    defaultCategory: '40.0', // Professional Fees Unclassified
    description: 'Accountants, subscriptions, training, conferences'
  },
  OTHER: {
    id: 'OTHER',
    name: 'Petty Cash / Other',
    icon: '📊',
    color: COLORS.textMuted,
    sections: ['MOTOR & TRANSPORT', 'CAPITAL & DEPRECIATION', 'PETTY CASH / OTHER EXPENSES'],
    defaultCategory: '80.0', // Petty Cash / Other Unclassified
    description: 'Motor costs, equipment purchases, miscellaneous'
  },
  NON_BUSINESS: {
    id: 'NON_BUSINESS',
    name: 'Non-Business / Drawings',
    icon: '🏦',
    color: COLORS.textSecondary,
    sections: ['NON-BUSINESS'],
    defaultCategory: '90.0', // Partner Drawings
    description: 'Partner drawings, personal expenses, non-deductible items'
  }
};

/**
 * Get parent category for a given section
 * @param {string} section - The section name (e.g., "PREMISES COSTS")
 * @returns {object|null} Parent category object or null
 */
export function getParentCategoryForSection(section) {
  return Object.values(PARENT_CATEGORIES).find(
    parent => parent.sections.includes(section)
  ) || null;
}

/**
 * Get parent category for a given category code
 * @param {string} categoryCode - Category code (e.g., "31.2")
 * @param {array} categoryMapping - Full category mapping array
 * @returns {object|null} Parent category object or null
 */
export function getParentCategoryForCode(categoryCode, categoryMapping) {
  const category = categoryMapping.find(c => c.code === categoryCode);
  if (!category) return null;

  return getParentCategoryForSection(category.section);
}

/**
 * Get all subcategories for a parent category
 * @param {string} parentId - Parent category ID (e.g., "PREMISES")
 * @param {array} categoryMapping - Full category mapping array
 * @returns {array} Array of category objects
 */
export function getSubcategoriesForParent(parentId, categoryMapping) {
  const parent = PARENT_CATEGORIES[parentId];
  if (!parent) return [];

  return categoryMapping.filter(c =>
    parent.sections.includes(c.section)
  );
}

/**
 * Get default category code for a parent category
 * @param {string} parentId - Parent category ID
 * @returns {string} Default category code
 */
export function getDefaultCategoryForParent(parentId) {
  const parent = PARENT_CATEGORIES[parentId];
  return parent ? parent.defaultCategory : '100.0'; // Fallback to "Other"
}

/**
 * Group transactions by parent category
 * @param {array} transactions - Array of transaction objects
 * @param {array} categoryMapping - Full category mapping array
 * @returns {object} Transactions grouped by parent category ID
 */
export function groupTransactionsByParent(transactions, categoryMapping) {
  const grouped = {};

  // Initialize groups
  Object.keys(PARENT_CATEGORIES).forEach(key => {
    grouped[key] = [];
  });

  // Group transactions
  transactions.forEach(transaction => {
    if (transaction.category) {
      const parent = getParentCategoryForCode(transaction.category, categoryMapping);
      if (parent) {
        grouped[parent.id].push(transaction);
      } else {
        // Fallback to OTHER if no parent found
        grouped.OTHER.push(transaction);
      }
    }
  });

  return grouped;
}

/**
 * Get summary statistics by parent category
 * @param {array} transactions - Array of transaction objects
 * @param {array} categoryMapping - Full category mapping array
 * @returns {object} Summary stats by parent category
 */
export function getParentCategorySummary(transactions, categoryMapping) {
  const grouped = groupTransactionsByParent(transactions, categoryMapping);
  const summary = {};

  Object.entries(PARENT_CATEGORIES).forEach(([key, parent]) => {
    const categoryTransactions = grouped[key] || [];
    const total = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    summary[key] = {
      name: parent.name,
      icon: parent.icon,
      color: parent.color,
      count: categoryTransactions.length,
      total: total,
      transactions: categoryTransactions
    };
  });

  return summary;
}

/**
 * Check if a category code is an "unclassified" placeholder
 * @param {string} categoryCode - Category code
 * @returns {boolean} True if unclassified
 */
export function isUnclassifiedCategory(categoryCode) {
  const unclassifiedCodes = Object.values(PARENT_CATEGORIES).map(p => p.defaultCategory);
  return unclassifiedCodes.includes(categoryCode);
}

/**
 * Get all unclassified transactions
 * @param {array} transactions - Array of transaction objects
 * @returns {array} Transactions with unclassified categories
 */
export function getUnclassifiedTransactions(transactions) {
  return transactions.filter(t =>
    t.category && isUnclassifiedCategory(t.category)
  );
}

/**
 * Check if refinement is recommended (many unclassified transactions)
 * @param {array} transactions - Array of transaction objects
 * @returns {object} Recommendation with count and percentage
 */
export function shouldRecommendRefinement(transactions) {
  const unclassified = getUnclassifiedTransactions(transactions);
  const percentage = transactions.length > 0
    ? (unclassified.length / transactions.length) * 100
    : 0;

  return {
    recommend: unclassified.length > 10 && percentage > 20,
    count: unclassified.length,
    total: transactions.length,
    percentage: percentage.toFixed(1)
  };
}
