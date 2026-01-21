/**
 * Simple Auto-Categorization for Onboarding
 *
 * Provides quick, rule-based categorization to parent categories for initial setup.
 * Uses keyword matching to assign transactions to the 7 high-level categories.
 *
 * This is Step 1 categorization - fast and simple for getting users started.
 * Users can refine to specific subcategories later during P&L preparation.
 */

import { PARENT_CATEGORIES } from './parentCategoryMapping';

/**
 * Keyword patterns for each parent category
 * These are common terms found in Irish GP practice transactions
 */
const CATEGORY_PATTERNS = {
  INCOME: {
    keywords: [
      'pcrs', 'gms', 'dsp', 'hse', 'patient', 'consultation', 'boipa',
      'private', 'medical card', 'insurance', 'vhi', 'laya', 'aviva',
      'health insurance', 'report fee', 'examination', 'clinic',
      'income', 'payment received', 'credit transfer'
      // Note: 'revenue' removed - conflicts with Revenue Commissioners (expense)
    ],
    amountType: 'credit' // Income should be credits
  },
  STAFF: {
    keywords: [
      'salary', 'wages', 'payroll', 'prsi', 'paye', 'usc',
      'pension', 'staff', 'employee', 'locum', 'gp assistant',
      'nurse', 'reception', 'doctor', 'dr ', 'medical staff',
      'revenue commi', 'revenue commissioners' // Revenue Commissioners - PRSI/PAYE payments
    ],
    amountType: 'debit' // Staff costs are debits
  },
  MEDICAL: {
    keywords: [
      'vaccine', 'drug', 'pharma', 'medical supply', 'surgical',
      'gloves', 'mask', 'ppe', 'syringe', 'bandage', 'equipment',
      'stethoscope', 'medicines', 'prescription', 'depot',
      'phoenix', 'uniphar', 'hickeys'
    ],
    amountType: 'debit'
  },
  PREMISES: {
    keywords: [
      'rent', 'lease', 'rates', 'esb', 'electricity', 'gas',
      'electric ireland', 'bord gais', 'energia', 'water',
      'irish water', 'heating', 'maintenance', 'repair',
      'cleaning', 'security', 'alarm', 'waste', 'bin',
      'insurance building', 'property'
    ],
    amountType: 'debit'
  },
  OFFICE_IT: {
    keywords: [
      'office', 'stationery', 'paper', 'printer', 'ink',
      'phone', 'mobile', 'vodafone', 'three', 'eir',
      'internet', 'broadband', 'wifi', 'software', 'microsoft',
      'adobe', 'subscription', 'computer', 'laptop', 'it support',
      'postage', 'an post', 'courier', 'dhl', 'fedex'
    ],
    amountType: 'debit'
  },
  PROFESSIONAL: {
    keywords: [
      'accountant', 'accounting', 'bookkeeper', 'solicitor',
      'legal', 'bank charge', 'bank fee', 'professional fee',
      'icgp', 'medical council', 'membership', 'subscription',
      'training', 'course', 'conference', 'cpd', 'education',
      'continuing professional'
    ],
    amountType: 'debit'
  },
  OTHER: {
    keywords: [
      'motor', 'car', 'vehicle', 'petrol', 'diesel', 'parking',
      'fuel', 'depreciation', 'capital', 'loan', 'drawing',
      'personal', 'miscellaneous', 'sundry', 'other'
    ],
    amountType: 'debit'
  }
};

/**
 * Auto-categorize a transaction to a parent category
 * @param {object} transaction - Transaction object with details, amount, etc.
 * @param {array} categoryMapping - Full category mapping (for staff matching)
 * @returns {string|null} Category code or null if no match
 */
export function autoCategorizeToParen(transaction, categoryMapping) {
  const details = (transaction.details || '').toLowerCase();
  const amount = transaction.amount || transaction.credit || transaction.debit || 0;
  const isCredit = amount > 0;

  // Check for staff name matches first (highest priority)
  const staffCategories = categoryMapping.filter(c =>
    c.personalization === 'Personalized' &&
    c.section === 'DIRECT STAFF COSTS'
  );

  for (const staffCat of staffCategories) {
    for (const identifier of staffCat.identifiers || []) {
      if (details.includes(identifier.toLowerCase())) {
        return staffCat.code; // Return specific staff category
      }
    }
  }

  // Score each parent category
  let bestMatch = null;
  let bestScore = 0;
  const minScore = 1; // Require at least 1 keyword match

  for (const [parentId, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    let score = 0;

    // Check amount type match (credit vs debit)
    const correctAmountType =
      (patterns.amountType === 'credit' && isCredit) ||
      (patterns.amountType === 'debit' && !isCredit);

    if (!correctAmountType && parentId !== 'OTHER') {
      continue; // Skip if amount type doesn't match (except OTHER)
    }

    // Count keyword matches
    for (const keyword of patterns.keywords) {
      if (details.includes(keyword)) {
        score += 1;
      }
    }

    // Bonus for amount type match
    if (correctAmountType) {
      score += 0.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = parentId;
    }
  }

  // Return default category for the best match
  if (bestMatch && bestScore >= minScore) {
    return PARENT_CATEGORIES[bestMatch].defaultCategory;
  }

  // No match - return null (will need manual categorization)
  return null;
}

/**
 * Auto-categorize multiple transactions
 * @param {array} transactions - Array of transaction objects
 * @param {array} categoryMapping - Full category mapping
 * @returns {object} Statistics about categorization
 */
export function batchAutoCategorizeTran(transactions, categoryMapping) {
  const results = {
    categorized: 0,
    uncategorized: 0,
    byParent: {}
  };

  // Initialize counters
  Object.keys(PARENT_CATEGORIES).forEach(key => {
    results.byParent[key] = 0;
  });

  transactions.forEach(transaction => {
    const categoryCode = autoCategorizeToParen(transaction, categoryMapping);

    if (categoryCode) {
      // Find which parent this belongs to
      const category = categoryMapping.find(c => c.code === categoryCode);
      if (category) {
        const parentId = Object.values(PARENT_CATEGORIES).find(
          p => p.sections.includes(category.section)
        )?.id;

        if (parentId) {
          results.byParent[parentId]++;
        }
      }
      results.categorized++;
    } else {
      results.uncategorized++;
    }
  });

  return results;
}

/**
 * Get suggestions for a transaction
 * @param {object} transaction - Transaction object
 * @param {array} categoryMapping - Full category mapping
 * @returns {array} Array of {parentId, confidence, reason} objects
 */
export function getSuggestionsForTransaction(transaction, categoryMapping) {
  const details = (transaction.details || '').toLowerCase();
  const amount = transaction.amount || transaction.credit || transaction.debit || 0;
  const isCredit = amount > 0;

  const suggestions = [];

  // Check each parent category
  for (const [parentId, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    const matches = [];
    let score = 0;

    // Check amount type
    const correctAmountType =
      (patterns.amountType === 'credit' && isCredit) ||
      (patterns.amountType === 'debit' && !isCredit);

    if (!correctAmountType && parentId !== 'OTHER') {
      continue;
    }

    // Find matching keywords
    for (const keyword of patterns.keywords) {
      if (details.includes(keyword)) {
        matches.push(keyword);
        score += 1;
      }
    }

    if (matches.length > 0) {
      suggestions.push({
        parentId,
        confidence: Math.min(score / 3, 1), // Normalize to 0-1
        matchedKeywords: matches,
        reason: `Found keywords: ${matches.slice(0, 3).join(', ')}`
      });
    }
  }

  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions.slice(0, 3); // Top 3 suggestions
}
