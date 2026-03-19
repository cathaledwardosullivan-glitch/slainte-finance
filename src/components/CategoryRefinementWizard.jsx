import React, { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';

// Define which categories are essential vs optional for P&L accuracy
const CATEGORY_REFINEMENT_CONFIG = {
  income: {
    label: 'Income Categories',
    description: 'Refine income sources for better reporting and analysis',
    categories: [
      {
        parentCode: '1.0',
        parentName: 'Income Unclassified',
        icon: '💰',
        color: COLORS.incomeColor,
        reason: 'Distinguish between GMS, private consultations, insurance reports, and other income sources',
        categoryType: 'income'
      }
    ]
  },
  essential: {
    label: 'Essential for Accurate P&L',
    description: 'These categories contain subcategories that map to different P&L lines',
    categories: [
      {
        parentCode: '2.0',
        parentName: 'Staff Costs',
        icon: '👥',
        color: COLORS.successDark,
        reason: 'Different staff types (nurses, receptionists, locums, etc.) require separate P&L lines',
        categoryType: 'expense'
      },
      {
        parentCode: '20.0',
        parentName: 'Premises Costs',
        icon: '🏢',
        color: COLORS.expenseColor,
        reason: 'Rent, rates, utilities, and cleaning must be on separate P&L lines',
        categoryType: 'expense'
      },
      {
        // Combined Professional category - includes both 40.0 and 50.0 transactions
        parentCode: 'professional', // Special code to identify this combined category
        parentCodes: ['40.0', '50.0'], // Both parent codes this category handles
        parentName: 'Professional (Fees & Development)',
        icon: '📚',
        color: COLORS.chartViolet,
        reason: 'Accountancy, legal, bank charges, indemnity, subscriptions, and CPD require separate P&L lines',
        categoryType: 'expense',
        subcategoryRange: [40, 60] // Include all 40.x and 50.x subcategories
      }
    ]
  },
  optional: {
    label: 'Optional (Improves Detail)',
    description: 'These categories share P&L lines, so grouping is acceptable',
    categories: [
      {
        parentCode: '10.0',
        parentName: 'Medical Supplies',
        icon: '💉',
        color: COLORS.success,
        reason: 'All medical supplies appear on the same P&L line',
        categoryType: 'expense'
      },
      {
        parentCode: '30.0',
        parentName: 'Office & IT',
        icon: '💻',
        color: COLORS.slainteBlue,
        reason: 'Most office costs appear on sundry or similar lines',
        categoryType: 'expense'
      },
      {
        parentCode: '80.0',
        parentName: 'Petty Cash / Other',
        icon: '📊',
        color: COLORS.textSecondary,
        reason: 'Sundry and miscellaneous expenses share P&L lines',
        categoryType: 'expense'
      }
    ]
  }
};

export default function CategoryRefinementWizard({ isOpen, onClose }) {
  const { transactions, categoryMapping, setCategoryMapping, recategorizeTransaction } = useAppContext();
  const [currentStep, setCurrentStep] = useState('overview'); // 'overview', 'refining', 'complete'
  const [refinementMode, setRefinementMode] = useState('essential'); // 'income', 'essential', 'all', 'none'
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [refinedCount, setRefinedCount] = useState(0);
  const [learnedIdentifiers, setLearnedIdentifiers] = useState([]); // Track identifiers learned this session

  // Function to add an identifier to a category's identifiers list
  const addIdentifierToCategory = (identifier, categoryCode) => {
    if (!identifier || !categoryCode) return;

    const category = categoryMapping.find(c => c.code === categoryCode);
    if (!category) return;

    // Check if identifier already exists (case-insensitive)
    const identifierUpper = identifier.toUpperCase();
    const alreadyExists = category.identifiers?.some(
      id => id.toUpperCase() === identifierUpper
    );

    if (!alreadyExists) {
      setCategoryMapping(prev => prev.map(cat => {
        if (cat.code === categoryCode) {
          return {
            ...cat,
            identifiers: [...(cat.identifiers || []), identifier]
          };
        }
        return cat;
      }));

      // Track what we learned this session for display
      setLearnedIdentifiers(prev => [...prev, { identifier, categoryCode, categoryName: category.name }]);
      console.log(`✓ Learned identifier "${identifier}" for category ${category.name} (${categoryCode})`);
    }
  };

  // Reset wizard state when opened
  React.useEffect(() => {
    if (isOpen) {
      setCurrentStep('overview');
      setRefinementMode('essential');
      setCurrentCategoryIndex(0);
      setRefinedCount(0);
      setLearnedIdentifiers([]);
    }
  }, [isOpen]);

  // Get partially classified transactions (those with .0 codes)
  const partiallyClassified = useMemo(() => {
    const partial = transactions.filter(t =>
      t.category && t.category.code && t.category.code.endsWith('.0')
    );

    // Group by parent category
    const grouped = {};
    partial.forEach(transaction => {
      const code = transaction.category.code;
      if (!grouped[code]) {
        grouped[code] = {
          parentCode: code,
          parentCategory: transaction.category,
          transactions: []
        };
      }
      grouped[code].transactions.push(transaction);
    });

    return grouped;
  }, [transactions]);

  // Build a list of all known identifiers from the category mapping
  // EXCLUDING identifiers from .0 (unclassified) categories
  const knownIdentifiers = useMemo(() => {
    const identifierMap = new Map(); // identifier -> category info

    categoryMapping.forEach(category => {
      // Skip .0 categories (unclassified parent categories)
      if (category.code.endsWith('.0')) return;

      if (category.identifiers && category.identifiers.length > 0) {
        category.identifiers.forEach(identifier => {
          const upperIdentifier = identifier.toUpperCase();
          // Store the identifier with its category info
          identifierMap.set(upperIdentifier, {
            identifier: identifier,
            categoryCode: category.code,
            categoryName: category.name
          });
        });
      }
    });

    return identifierMap;
  }, [categoryMapping]);

  // Helper function to find a known identifier in transaction details
  // Returns the full info including which subcategory it belongs to
  const findKnownIdentifierWithCategory = (details) => {
    if (!details) return null;
    const upperDetails = details.toUpperCase();

    // Check all known identifiers
    for (const [upperIdentifier, info] of knownIdentifiers) {
      if (upperDetails.includes(upperIdentifier)) {
        return info; // Return full info: { identifier, categoryCode, categoryName }
      }
    }
    return null;
  };

  // Simpler version that just returns the identifier string (for grouping)
  const findKnownIdentifier = (details) => {
    const info = findKnownIdentifierWithCategory(details);
    return info ? info.identifier : null;
  };

  // Helper function to extract a NEW pattern/identifier from transaction details
  // Used only for transactions that don't match known identifiers
  const extractNewPattern = (details) => {
    if (!details) return '';

    const upperDetails = details.toUpperCase();

    // Try to extract numeric/alphanumeric patterns (like "01-101020000089" -> "01-10102000")
    // This removes trailing digits that might change between transactions
    const numericPatternMatch = upperDetails.match(/[\d\-]{8,}/);
    if (numericPatternMatch) {
      const numericStr = numericPatternMatch[0];
      // Keep the prefix (at least 70% of the string) as the pattern
      const keepLength = Math.floor(numericStr.length * 0.7);
      if (keepLength >= 6) {
        return numericStr.substring(0, keepLength);
      }
    }

    // Try word-based extraction as fallback - find the most significant word
    const words = upperDetails.split(/\s+/).filter(word => {
      const cleanWord = word.replace(/[^A-Z0-9]/g, '');
      return cleanWord.length >= 4 &&
        !['THE', 'AND', 'FOR', 'WITH', 'FROM', 'LTD', 'LIMITED', 'INC', 'CORP', 'PAYMENT', 'TRANSFER', 'DEBIT', 'CREDIT'].includes(cleanWord) &&
        !cleanWord.startsWith('POS') &&
        !/^POS\d/.test(cleanWord) &&
        !/^\d{2}\/\d{2}/.test(word); // Skip date patterns
    });

    if (words.length > 0) {
      // Return the longest meaningful word as the identifier
      return words.sort((a, b) => b.length - a.length)[0].replace(/[^A-Z0-9]/g, '');
    }

    return '';
  };

  // Get categories to refine based on mode
  const categoriesToRefine = useMemo(() => {
    if (refinementMode === 'none') return [];

    let config;
    if (refinementMode === 'income') {
      config = CATEGORY_REFINEMENT_CONFIG.income.categories;
    } else if (refinementMode === 'essential') {
      config = CATEGORY_REFINEMENT_CONFIG.essential.categories;
    } else {
      // 'all' mode - include income, essential, and optional
      config = [
        ...CATEGORY_REFINEMENT_CONFIG.income.categories,
        ...CATEGORY_REFINEMENT_CONFIG.essential.categories,
        ...CATEGORY_REFINEMENT_CONFIG.optional.categories
      ];
    }

    return config
      .filter(cat => {
        // For combined categories (like Professional), check if ANY of the parentCodes have transactions
        if (cat.parentCodes) {
          return cat.parentCodes.some(code => partiallyClassified[code]);
        }
        // For single parent categories, check directly
        return partiallyClassified[cat.parentCode];
      })
      .map(cat => {
        // For combined categories, merge transactions from all parentCodes
        let categoryTransactions = [];
        if (cat.parentCodes) {
          cat.parentCodes.forEach(code => {
            if (partiallyClassified[code]) {
              categoryTransactions = categoryTransactions.concat(partiallyClassified[code].transactions);
            }
          });
        } else {
          categoryTransactions = partiallyClassified[cat.parentCode].transactions;
        }

        // Determine which subcategory codes are valid for this parent category
        const getValidSubcategoryCodes = () => {
          if (cat.subcategoryRange) {
            const [rangeStart, rangeEnd] = cat.subcategoryRange;
            return categoryMapping
              .filter(c => {
                const numCode = parseFloat(c.code);
                return numCode >= rangeStart && numCode < rangeEnd && !c.code.endsWith('.0');
              })
              .map(c => c.code);
          }
          // Standard category - subcategories are within same tens digit
          const parentNumeric = parseFloat(cat.parentCode);
          return categoryMapping
            .filter(c => {
              const numCode = parseFloat(c.code);
              return numCode >= parentNumeric && numCode < parentNumeric + 10 && !c.code.endsWith('.0');
            })
            .map(c => c.code);
        };
        const validSubcategoryCodes = getValidSubcategoryCodes();

        // PHASE 1: Match transactions against KNOWN identifiers from category mapping
        // Separate into: auto-refineable (subcategory match) vs needs manual review
        const autoRefineable = []; // Transactions that can be auto-refined
        const knownIdentifierGroups = {}; // For display/manual override
        const unmatchedTransactions = []; // Transactions that don't match any known identifier

        categoryTransactions.forEach(transaction => {
          const identifierInfo = findKnownIdentifierWithCategory(transaction.details);

          if (identifierInfo) {
            // Check if the matched identifier's category is a valid subcategory for this parent
            const isValidSubcategory = validSubcategoryCodes.includes(identifierInfo.categoryCode);

            if (isValidSubcategory) {
              // This can be auto-refined! Add to auto-refineable list
              autoRefineable.push({
                transaction,
                identifier: identifierInfo.identifier,
                suggestedCategoryCode: identifierInfo.categoryCode,
                suggestedCategoryName: identifierInfo.categoryName
              });
            }

            // Also add to known identifier groups for display
            if (!knownIdentifierGroups[identifierInfo.identifier]) {
              knownIdentifierGroups[identifierInfo.identifier] = {
                identifier: identifierInfo.identifier,
                transactions: [],
                sampleTransaction: transaction,
                isKnown: true,
                // If it's a valid subcategory, include the suggestion
                suggestedCategoryCode: isValidSubcategory ? identifierInfo.categoryCode : null,
                suggestedCategoryName: isValidSubcategory ? identifierInfo.categoryName : null
              };
            }
            knownIdentifierGroups[identifierInfo.identifier].transactions.push(transaction);
          } else {
            // No known identifier match - will process in phase 2
            unmatchedTransactions.push(transaction);
          }
        });

        // PHASE 2: For unmatched transactions, discover NEW patterns
        const newPatternCounts = new Map();
        const transactionNewPatterns = new Map();

        unmatchedTransactions.forEach(transaction => {
          const pattern = extractNewPattern(transaction.details);
          if (pattern) {
            newPatternCounts.set(pattern, (newPatternCounts.get(pattern) || 0) + 1);
            transactionNewPatterns.set(transaction.id, pattern);
          }
        });

        // Group unmatched transactions by discovered patterns (only if 2+ occurrences)
        const discoveredPatternGroups = {};
        const transactionsWithoutIdentifiers = [];

        unmatchedTransactions.forEach(transaction => {
          const pattern = transactionNewPatterns.get(transaction.id);
          const count = pattern ? newPatternCounts.get(pattern) || 0 : 0;

          if (pattern && count >= 2) {
            // Repeating pattern discovered - add to group
            if (!discoveredPatternGroups[pattern]) {
              discoveredPatternGroups[pattern] = {
                identifier: pattern,
                transactions: [],
                sampleTransaction: transaction,
                isKnown: false // Flag to indicate this is a newly discovered pattern
              };
            }
            discoveredPatternGroups[pattern].transactions.push(transaction);
          } else {
            // One-off transaction or no pattern
            transactionsWithoutIdentifiers.push(transaction);
          }
        });

        // Combine known identifiers and discovered patterns
        // Known identifiers first (they're more reliable), then discovered patterns
        const allGroups = [
          ...Object.values(knownIdentifierGroups),
          ...Object.values(discoveredPatternGroups)
        ];

        // Sort: suggested categories first, then by count
        const identifiers = allGroups
          .map(group => ({
            ...group,
            count: group.transactions.length
          }))
          .sort((a, b) => {
            // Groups with suggestions come first
            if (a.suggestedCategoryCode && !b.suggestedCategoryCode) return -1;
            if (!a.suggestedCategoryCode && b.suggestedCategoryCode) return 1;
            // Then sort by count
            return b.count - a.count;
          });

        // Count how many transactions can be auto-refined
        const autoRefineableCount = autoRefineable.length;

        return {
          ...cat,
          identifiers, // Array of identifier groups (known + discovered)
          transactionsWithoutIdentifiers, // One-off transactions
          autoRefineable, // Transactions that can be auto-refined with suggested categories
          autoRefineableCount, // Quick count of auto-refineable transactions
          totalTransactions: categoryTransactions.length,
          count: identifiers.length
        };
      });
  }, [refinementMode, partiallyClassified, knownIdentifiers, categoryMapping]);

  const currentCategory = categoriesToRefine[currentCategoryIndex];
  const totalCategories = categoriesToRefine.length;

  // Auto-skip empty categories (when all identifiers have been recategorized away)
  React.useEffect(() => {
    // Only run auto-skip logic when in refining mode
    if (currentStep !== 'refining') return;

    // Wait for categories to be calculated
    if (totalCategories === 0 || !currentCategory) return;

    // Category has content if it has identifiers OR transactions without identifiers
    const hasContent =
      (currentCategory.identifiers && currentCategory.identifiers.length > 0) ||
      (currentCategory.transactionsWithoutIdentifiers && currentCategory.transactionsWithoutIdentifiers.length > 0);

    // If current category has content, don't skip - show it
    if (hasContent) {
      return;
    }

    // Current category is empty, try to skip to next non-empty one
    let nextIndex = currentCategoryIndex + 1;
    while (nextIndex < totalCategories) {
      const nextCat = categoriesToRefine[nextIndex];
      const nextHasContent =
        (nextCat?.identifiers && nextCat.identifiers.length > 0) ||
        (nextCat?.transactionsWithoutIdentifiers && nextCat.transactionsWithoutIdentifiers.length > 0);

      if (nextHasContent) {
        // Found a non-empty category, jump to it
        setCurrentCategoryIndex(nextIndex);
        return;
      }
      nextIndex++;
    }

    // No more non-empty categories found
    // If we refined something in this session, show complete screen
    // Otherwise, there's nothing to refine (shouldn't happen if user clicked the button)
    if (refinedCount > 0) {
      setCurrentStep('complete');
    }
  }, [currentCategory, currentCategoryIndex, totalCategories, currentStep, refinedCount, categoriesToRefine]);

  // Get subcategories for current parent
  const subcategories = useMemo(() => {
    if (!currentCategory) return [];

    const parentCode = currentCategory.parentCode;

    // Income categories (1.x) have a simpler structure - just 1.1, 1.2, etc.
    if (currentCategory.categoryType === 'income' || parentCode.startsWith('1.')) {
      return categoryMapping.filter(cat => {
        // Get all 1.x categories except 1.0
        return cat.code.startsWith('1.') &&
               !cat.code.endsWith('.0') &&
               cat.code !== '1' &&
               cat.code !== parentCode &&
               cat.type === 'income';
      });
    }

    // Combined categories with subcategoryRange (e.g., Professional with 40.x and 50.x)
    if (currentCategory.subcategoryRange) {
      const [rangeStart, rangeEnd] = currentCategory.subcategoryRange;
      return categoryMapping.filter(cat => {
        const catNumeric = parseFloat(cat.code);
        // Must be within the range and not be a .0 code
        return catNumeric >= rangeStart &&
               catNumeric < rangeEnd &&
               !cat.code.endsWith('.0') &&
               cat.type === 'expense';
      });
    }

    // Standard expense categories: Get all categories that are children of this parent
    // E.g., for 20.0, get 20.1, 20.2, 21.1, 21.2, 22.1, etc.
    const parentNumeric = parseFloat(parentCode);
    return categoryMapping.filter(cat => {
      const catNumeric = parseFloat(cat.code);
      // Must be in same "family" (same tens digit) and not be a .0 code
      return catNumeric >= parentNumeric &&
             catNumeric < parentNumeric + 10 &&
             !cat.code.endsWith('.0') &&
             cat.code !== parentCode;
    });
  }, [currentCategory, categoryMapping]);

  // Handle category selection for an identifier (applies to all transactions with that identifier)
  // OR for an individual transaction ID
  const handleCategorySelect = (identifierOrTransactionId, categoryCode) => {
    if (!currentCategory) return;

    // Check if this is an identifier (string matching one of our identifiers)
    const identifierGroup = currentCategory.identifiers?.find(g => g.identifier === identifierOrTransactionId);

    if (identifierGroup) {
      // It's an identifier - apply to all transactions with this identifier
      identifierGroup.transactions.forEach(transaction => {
        recategorizeTransaction(transaction.id, categoryCode, false);
      });

      // LEARN: Save this identifier to the selected subcategory for future auto-categorization
      // Only learn if it's a meaningful identifier (not a discovered pattern that's too generic)
      if (identifierGroup.identifier && identifierGroup.identifier.length >= 3) {
        addIdentifierToCategory(identifierGroup.identifier, categoryCode);
      }

      // Increment refined count by number of transactions updated
      setRefinedCount(prev => prev + identifierGroup.transactions.length);
    } else {
      // It's a transaction ID - apply to just this one transaction
      recategorizeTransaction(identifierOrTransactionId, categoryCode, false);
      setRefinedCount(prev => prev + 1);
    }
  };

  // Handle batch assignment (all identifiers/transactions in category to one subcategory)
  const handleBatchAssign = (categoryCode) => {
    if (!currentCategory) return;

    let totalTransactionsUpdated = 0;

    // Apply to all identifiers in this category
    if (currentCategory.identifiers) {
      currentCategory.identifiers.forEach(identifierGroup => {
        identifierGroup.transactions.forEach(transaction => {
          recategorizeTransaction(transaction.id, categoryCode, false);
        });
        totalTransactionsUpdated += identifierGroup.transactions.length;

        // LEARN: Save each identifier to the selected subcategory
        if (identifierGroup.identifier && identifierGroup.identifier.length >= 3) {
          addIdentifierToCategory(identifierGroup.identifier, categoryCode);
        }
      });
    }

    // Apply to all transactions without identifiers
    if (currentCategory.transactionsWithoutIdentifiers) {
      currentCategory.transactionsWithoutIdentifiers.forEach(transaction => {
        recategorizeTransaction(transaction.id, categoryCode, false);
      });
      totalTransactionsUpdated += currentCategory.transactionsWithoutIdentifiers.length;
    }

    setRefinedCount(prev => prev + totalTransactionsUpdated);

    // Move to next category
    if (currentCategoryIndex < totalCategories - 1) {
      setCurrentCategoryIndex(prev => prev + 1);
    } else {
      setCurrentStep('complete');
    }
  };

  // Handle auto-refinement - apply all suggested categories automatically
  const handleAutoRefine = () => {
    if (!currentCategory || !currentCategory.identifiers) return;

    let totalTransactionsUpdated = 0;

    // Apply suggested categories to all identifier groups that have them
    currentCategory.identifiers.forEach(identifierGroup => {
      if (identifierGroup.suggestedCategoryCode) {
        identifierGroup.transactions.forEach(transaction => {
          recategorizeTransaction(transaction.id, identifierGroup.suggestedCategoryCode, false);
        });
        totalTransactionsUpdated += identifierGroup.transactions.length;
      }
    });

    setRefinedCount(prev => prev + totalTransactionsUpdated);
  };

  // Handle auto-refinement for a single identifier group
  const handleAutoRefineSingle = (identifier) => {
    if (!currentCategory) return;

    const identifierGroup = currentCategory.identifiers?.find(g => g.identifier === identifier);
    if (!identifierGroup || !identifierGroup.suggestedCategoryCode) return;

    identifierGroup.transactions.forEach(transaction => {
      recategorizeTransaction(transaction.id, identifierGroup.suggestedCategoryCode, false);
    });

    setRefinedCount(prev => prev + identifierGroup.transactions.length);
  };

  // Navigate to next category
  const handleNext = () => {
    if (currentCategoryIndex < totalCategories - 1) {
      setCurrentCategoryIndex(prev => prev + 1);
    } else {
      setCurrentStep('complete');
    }
  };

  // Navigate to previous category
  const handleBack = () => {
    if (currentCategoryIndex > 0) {
      setCurrentCategoryIndex(prev => prev - 1);
    } else {
      setCurrentStep('overview');
      setCurrentCategoryIndex(0);
    }
  };

  // Start refinement process
  const handleStartRefinement = (mode) => {
    setRefinementMode(mode);
    if (mode === 'none') {
      onClose();
    } else {
      // Reset refined count when starting a new refinement session
      setRefinedCount(0);
      setCurrentStep('refining');
      setCurrentCategoryIndex(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: COLORS.overlayDark,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: `1px solid ${COLORS.borderLight}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: COLORS.textPrimary, margin: 0 }}>
              Category Refinement
            </h2>
            <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, margin: '0.25rem 0 0 0' }}>
              {currentStep === 'overview' && 'Improve your P&L report accuracy'}
              {currentStep === 'refining' && `Refining ${currentCategory?.parentName} (${currentCategoryIndex + 1} of ${totalCategories})`}
              {currentStep === 'complete' && 'Refinement Complete'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: COLORS.textSecondary,
              padding: '0.5rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = COLORS.textPrimary}
            onMouseLeave={(e) => e.currentTarget.style.color = COLORS.textSecondary}
          >
            <X style={{ width: '1.5rem', height: '1.5rem' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem'
        }}>
          {currentStep === 'overview' && (
            <OverviewStep
              partiallyClassified={partiallyClassified}
              config={CATEGORY_REFINEMENT_CONFIG}
              onStartRefinement={handleStartRefinement}
            />
          )}

          {currentStep === 'refining' && currentCategory && (
            <RefinementStep
              category={currentCategory}
              subcategories={subcategories}
              onCategorySelect={handleCategorySelect}
              onBatchAssign={handleBatchAssign}
              onRecategorize={handleCategorySelect}
              onAutoRefine={handleAutoRefine}
              onAutoRefineSingle={handleAutoRefineSingle}
              progress={`${currentCategoryIndex + 1} of ${totalCategories}`}
            />
          )}

          {currentStep === 'complete' && (
            <CompleteStep
              refinedCount={refinedCount}
              learnedIdentifiers={learnedIdentifiers}
              onClose={onClose}
            />
          )}
        </div>

        {/* Footer */}
        {currentStep === 'refining' && (
          <div style={{
            padding: '1.5rem',
            borderTop: `1px solid ${COLORS.borderLight}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <button
              onClick={handleBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: `1px solid ${COLORS.borderLight}`,
                backgroundColor: COLORS.white,
                color: COLORS.textPrimary,
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.bgPage}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
            >
              <ChevronLeft style={{ width: '1rem', height: '1rem' }} />
              Back
            </button>

            <div style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
              Category {currentCategoryIndex + 1} of {totalCategories}
            </div>

            <button
              onClick={handleNext}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: COLORS.slainteBlue,
                color: COLORS.white,
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
            >
              {currentCategoryIndex < totalCategories - 1 ? 'Next Category' : 'Complete'}
              <ChevronRight style={{ width: '1rem', height: '1rem' }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to check if a category config has matching transactions
const categoryHasTransactions = (cat, partiallyClassified) => {
  if (cat.parentCodes) {
    return cat.parentCodes.some(code => partiallyClassified[code]);
  }
  return partiallyClassified[cat.parentCode];
};

// Helper function to count transactions for a category config
const getCategoryTransactionCount = (cat, partiallyClassified) => {
  if (cat.parentCodes) {
    return cat.parentCodes.reduce((sum, code) => {
      return sum + (partiallyClassified[code]?.transactions.length || 0);
    }, 0);
  }
  return partiallyClassified[cat.parentCode]?.transactions.length || 0;
};

// Overview Step Component
function OverviewStep({ partiallyClassified, config, onStartRefinement }) {
  const totalPartial = Object.values(partiallyClassified).reduce((sum, group) => sum + group.transactions.length, 0);

  const incomeCount = config.income.categories
    .filter(cat => categoryHasTransactions(cat, partiallyClassified))
    .reduce((sum, cat) => sum + getCategoryTransactionCount(cat, partiallyClassified), 0);

  const essentialCount = config.essential.categories
    .filter(cat => categoryHasTransactions(cat, partiallyClassified))
    .reduce((sum, cat) => sum + getCategoryTransactionCount(cat, partiallyClassified), 0);

  const optionalCount = config.optional.categories
    .filter(cat => categoryHasTransactions(cat, partiallyClassified))
    .reduce((sum, cat) => sum + getCategoryTransactionCount(cat, partiallyClassified), 0);

  return (
    <div>
      <div style={{
        backgroundColor: `${COLORS.slainteBlue}15`,
        padding: '1.25rem',
        borderRadius: '0.5rem',
        border: `1px solid ${COLORS.slainteBlue}`,
        marginBottom: '2rem'
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: COLORS.textPrimary, margin: '0 0 0.5rem 0' }}>
          You have {totalPartial} partially classified transactions
        </h3>
        <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, margin: 0, lineHeight: '1.6' }}>
          These transactions are currently assigned to parent categories. Refining them to specific subcategories
          improves your P&L report accuracy and provides better financial insights.
        </p>
      </div>

      {/* Income Categories */}
      {incomeCount > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: COLORS.incomeColor }} />
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: COLORS.textPrimary, margin: 0 }}>
              {config.income.label}
            </h4>
          </div>
          <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '1rem', lineHeight: '1.6' }}>
            {config.income.description}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {config.income.categories
              .filter(cat => categoryHasTransactions(cat, partiallyClassified))
              .map(cat => (
                <CategoryCard
                  key={cat.parentCode}
                  category={cat}
                  count={getCategoryTransactionCount(cat, partiallyClassified)}
                />
              ))
            }
          </div>
        </div>
      )}

      {/* Essential Categories */}
      {essentialCount > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <AlertCircle style={{ width: '1.25rem', height: '1.25rem', color: COLORS.expenseColor }} />
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: COLORS.textPrimary, margin: 0 }}>
              {config.essential.label}
            </h4>
          </div>
          <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '1rem', lineHeight: '1.6' }}>
            {config.essential.description}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {config.essential.categories
              .filter(cat => categoryHasTransactions(cat, partiallyClassified))
              .map(cat => (
                <CategoryCard
                  key={cat.parentCode}
                  category={cat}
                  count={getCategoryTransactionCount(cat, partiallyClassified)}
                />
              ))
            }
          </div>
        </div>
      )}

      {/* Optional Categories */}
      {optionalCount > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: COLORS.incomeColor }} />
            <h4 style={{ fontSize: '1rem', fontWeight: '600', color: COLORS.textPrimary, margin: 0 }}>
              {config.optional.label}
            </h4>
          </div>
          <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '1rem', lineHeight: '1.6' }}>
            {config.optional.description}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {config.optional.categories
              .filter(cat => categoryHasTransactions(cat, partiallyClassified))
              .map(cat => (
                <CategoryCard
                  key={cat.parentCode}
                  category={cat}
                  count={getCategoryTransactionCount(cat, partiallyClassified)}
                />
              ))
            }
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        marginTop: '2rem',
        paddingTop: '2rem',
        borderTop: `1px solid ${COLORS.borderLight}`
      }}>
        {/* Income Button */}
        {incomeCount > 0 && (
          <button
            onClick={() => onStartRefinement('income')}
            style={{
              flex: '1 1 calc(50% - 0.5rem)',
              minWidth: '200px',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: `2px solid ${COLORS.incomeColor}`,
              backgroundColor: COLORS.white,
              color: COLORS.incomeColor,
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${COLORS.incomeColor}15`}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
          >
            Refine Income ({incomeCount})
          </button>
        )}

        {/* Essential Button */}
        {essentialCount > 0 && (
          <button
            onClick={() => onStartRefinement('essential')}
            style={{
              flex: '1 1 calc(50% - 0.5rem)',
              minWidth: '200px',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: COLORS.slainteBlue,
              color: COLORS.white,
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
          >
            Refine Expenses ({essentialCount})
            <span style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              fontSize: '0.75rem'
            }}>
              Recommended
            </span>
          </button>
        )}

        {/* Refine All Button */}
        {(incomeCount > 0 || optionalCount > 0) && (
          <button
            onClick={() => onStartRefinement('all')}
            style={{
              flex: '1 1 calc(50% - 0.5rem)',
              minWidth: '200px',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: `2px solid ${COLORS.slainteBlue}`,
              backgroundColor: COLORS.white,
              color: COLORS.slainteBlue,
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}15`}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
          >
            Refine All ({totalPartial})
          </button>
        )}

        {/* Skip Button */}
        <button
          onClick={() => onStartRefinement('none')}
          style={{
            flex: '0 0 auto',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            border: `1px solid ${COLORS.borderLight}`,
            backgroundColor: COLORS.white,
            color: COLORS.textSecondary,
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.bgPage;
            e.currentTarget.style.color = COLORS.textPrimary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.white;
            e.currentTarget.style.color = COLORS.textSecondary;
          }}
        >
          Skip for Now
        </button>
      </div>
    </div>
  );
}

// Category Card Component
function CategoryCard({ category, count }) {
  return (
    <div style={{
      padding: '1rem',
      borderRadius: '0.5rem',
      border: `1px solid ${COLORS.borderLight}`,
      backgroundColor: COLORS.bgPage,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          fontSize: '1.5rem',
          width: '2.5rem',
          height: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '0.5rem',
          backgroundColor: COLORS.white
        }}>
          {category.icon}
        </div>
        <div>
          <div style={{ fontWeight: '600', color: COLORS.textPrimary, fontSize: '0.9375rem' }}>
            {category.parentName}
          </div>
          <div style={{ fontSize: '0.8125rem', color: COLORS.textSecondary, marginTop: '0.25rem' }}>
            {category.reason}
          </div>
        </div>
      </div>
      <div style={{
        backgroundColor: category.color,
        color: COLORS.white,
        padding: '0.375rem 0.75rem',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600'
      }}>
        {count}
      </div>
    </div>
  );
}

// Refinement Step Component
function RefinementStep({ category, subcategories, onCategorySelect, onBatchAssign, progress, onRecategorize, onAutoRefine, onAutoRefineSingle }) {
  const [selectedIdentifiers, setSelectedIdentifiers] = useState({});
  const [selectedTransactions, setSelectedTransactions] = useState({});

  // Count identifiers that have suggested categories (can be auto-refined)
  const autoRefineableIdentifiers = category.identifiers?.filter(g => g.suggestedCategoryCode) || [];
  const autoRefineableCount = autoRefineableIdentifiers.reduce((sum, g) => sum + g.transactions.length, 0);

  const handleIdentifierSelect = (identifier, categoryCode) => {
    setSelectedIdentifiers(prev => ({
      ...prev,
      [identifier]: categoryCode
    }));
    // Apply to all transactions with this identifier
    onCategorySelect(identifier, categoryCode);
  };

  const handleIdentifierRecategorize = (identifier, categoryCode) => {
    // Apply new category to all transactions with this identifier
    onRecategorize(identifier, categoryCode);

    // After recategorization, the identifier will disappear from this category
    // The useEffect in parent will auto-skip if category becomes empty
  };

  const handleTransactionSelect = (transactionId, categoryCode) => {
    setSelectedTransactions(prev => ({
      ...prev,
      [transactionId]: categoryCode
    }));
    // Apply to this individual transaction
    onCategorySelect(transactionId, categoryCode);
  };

  return (
    <div>
      {/* Category Header */}
      <div style={{
        backgroundColor: `${category.color}15`,
        padding: '1.25rem',
        borderRadius: '0.5rem',
        border: `2px solid ${category.color}`,
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '2rem' }}>{category.icon}</div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: COLORS.textPrimary, margin: 0 }}>
              {category.parentName}
            </h3>
            <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, margin: '0.25rem 0 0 0' }}>
              {category.count > 0
                ? `${category.count} identifiers (${category.totalTransactions} transactions) to refine`
                : `${category.totalTransactions} transactions to refine (no identifiers)`
              }
            </p>
          </div>
        </div>
        <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, margin: 0, lineHeight: '1.6' }}>
          {category.reason}
        </p>
      </div>

      {/* Auto-Refine Section - Shows when there are identifiers with suggested categories */}
      {autoRefineableCount > 0 && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: `${COLORS.incomeColor}15`,
          borderRadius: '0.5rem',
          border: `1px solid ${COLORS.incomeColor}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: '600', color: COLORS.textPrimary, margin: 0 }}>
                Auto-Refine Available
              </h4>
              <p style={{ fontSize: '0.8125rem', color: COLORS.textSecondary, margin: '0.25rem 0 0 0' }}>
                {autoRefineableIdentifiers.length} identifier{autoRefineableIdentifiers.length !== 1 ? 's' : ''} ({autoRefineableCount} transactions)
                can be automatically refined based on known category mappings
              </p>
            </div>
            <button
              onClick={onAutoRefine}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: COLORS.incomeColor,
                color: COLORS.white,
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Auto-Refine All
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
            Suggested refinements: {autoRefineableIdentifiers.map(g =>
              `${g.identifier} → ${g.suggestedCategoryName}`
            ).join(', ')}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: COLORS.textPrimary, marginBottom: '0.75rem' }}>
          Quick Actions - Assign all to:
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {subcategories.map(subcat => (
            <button
              key={subcat.code}
              onClick={() => onBatchAssign(subcat.code)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: `1px solid ${COLORS.borderLight}`,
                backgroundColor: COLORS.white,
                color: COLORS.textPrimary,
                fontSize: '0.8125rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = category.color;
                e.currentTarget.style.color = COLORS.white;
                e.currentTarget.style.borderColor = category.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.white;
                e.currentTarget.style.color = COLORS.textPrimary;
                e.currentTarget.style.borderColor = COLORS.borderLight;
              }}
            >
              {subcat.code} - {subcat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Identifier List */}
      {category.identifiers && category.identifiers.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: COLORS.textPrimary, marginBottom: '0.75rem' }}>
            Individual Identifiers:
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {category.identifiers.map((identifierGroup, index) => (
              <IdentifierRefinementRow
                key={`${identifierGroup.identifier}-${index}`}
                identifierGroup={identifierGroup}
                subcategories={subcategories}
                selectedCategory={selectedIdentifiers[identifierGroup.identifier]}
                onSelect={(categoryCode) => handleIdentifierSelect(identifierGroup.identifier, categoryCode)}
                onRecategorize={handleIdentifierRecategorize}
                onAutoRefineSingle={onAutoRefineSingle}
                categoryColor={category.color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Individual Transactions (when no identifiers) */}
      {category.transactionsWithoutIdentifiers && category.transactionsWithoutIdentifiers.length > 0 && (
        <div style={{ marginTop: category.identifiers.length > 0 ? '1.5rem' : '0' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: COLORS.textPrimary, marginBottom: '0.75rem' }}>
            {category.identifiers.length > 0 ? 'Transactions without identifiers:' : 'Individual Transactions:'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {category.transactionsWithoutIdentifiers.map((transaction, index) => (
              <TransactionRefinementRow
                key={`${transaction.id}-${index}`}
                transaction={transaction}
                subcategories={subcategories}
                selectedCategory={selectedTransactions[transaction.id]}
                onSelect={(categoryCode) => handleTransactionSelect(transaction.id, categoryCode)}
                onRecategorize={onRecategorize}
                categoryColor={category.color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Recategorize Panel Component - Shows all available categories
function RecategorizePanel({ identifierGroup, onRecategorize, onCancel }) {
  const { categoryMapping } = useAppContext();

  // Get all parent categories (those ending in .0)
  const parentCategories = categoryMapping.filter(cat => cat.code.endsWith('.0'));

  return (
    <div style={{
      padding: '1rem',
      paddingTop: '0'
    }}>
      <div style={{
        fontSize: '0.875rem',
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: '0.75rem'
      }}>
        Choose the correct category:
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.5rem',
        marginBottom: '0.75rem'
      }}>
        {parentCategories.map(cat => (
          <button
            key={cat.code}
            onClick={(e) => {
              e.stopPropagation();
              onRecategorize(cat.code);
            }}
            style={{
              padding: '0.75rem',
              borderRadius: '0.375rem',
              border: `1px solid ${COLORS.borderLight}`,
              backgroundColor: COLORS.white,
              color: COLORS.textPrimary,
              fontSize: '0.8125rem',
              fontWeight: '500',
              cursor: 'pointer',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.bgPage;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.white;
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              {cat.code}
            </div>
            {cat.name}
          </button>
        ))}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        style={{
          width: '100%',
          padding: '0.625rem',
          borderRadius: '0.375rem',
          border: `1px solid ${COLORS.borderLight}`,
          backgroundColor: COLORS.white,
          color: COLORS.textSecondary,
          fontSize: '0.8125rem',
          fontWeight: '500',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.bgPage}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
      >
        Cancel
      </button>
    </div>
  );
}

// Transaction Refinement Row Component (for transactions without identifiers)
function TransactionRefinementRow({ transaction, subcategories, selectedCategory, onSelect, categoryColor, onRecategorize }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRecategorize, setShowRecategorize] = useState(false);

  return (
    <div style={{
      border: `1px solid ${selectedCategory ? categoryColor : COLORS.borderLight}`,
      borderRadius: '0.5rem',
      backgroundColor: selectedCategory ? `${categoryColor}10` : COLORS.white,
      overflow: 'hidden'
    }}>
      {/* Transaction Summary */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '1rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '600', color: COLORS.textPrimary, fontSize: '0.9375rem' }}>
            {transaction.details}
          </div>
          <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.125rem' }}>
            {transaction.date ? new Date(transaction.date).toLocaleDateString() : ''} • €{transaction.amount?.toLocaleString() || '0'}
          </div>
        </div>
        {selectedCategory && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginRight: '1rem'
          }}>
            <CheckCircle style={{ width: '1rem', height: '1rem', color: categoryColor }} />
            <span style={{ fontSize: '0.8125rem', color: categoryColor, fontWeight: '600' }}>
              {subcategories.find(s => s.code === selectedCategory)?.name}
            </span>
          </div>
        )}
        <ArrowRight style={{
          width: '1.25rem',
          height: '1.25rem',
          color: COLORS.textSecondary,
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }} />
      </div>

      {/* Subcategory Options */}
      {isExpanded && !showRecategorize && (
        <div style={{
          padding: '1rem',
          paddingTop: '0'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.5rem'
          }}>
            {subcategories.map(subcat => (
              <button
                key={subcat.code}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(subcat.code);
                  setIsExpanded(false);
                }}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: `1px solid ${selectedCategory === subcat.code ? categoryColor : COLORS.borderLight}`,
                  backgroundColor: selectedCategory === subcat.code ? categoryColor : COLORS.white,
                  color: selectedCategory === subcat.code ? COLORS.white : COLORS.textPrimary,
                  fontSize: '0.8125rem',
                  fontWeight: selectedCategory === subcat.code ? '600' : '500',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== subcat.code) {
                    e.currentTarget.style.backgroundColor = COLORS.bgPage;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== subcat.code) {
                    e.currentTarget.style.backgroundColor = COLORS.white;
                  }
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                  {subcat.code}
                </div>
                {subcat.name}
              </button>
            ))}
          </div>

          {/* Option to choose a different parent category */}
          {onRecategorize && (
            <div style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: `1px solid ${COLORS.borderLight}`
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRecategorize(true);
                }}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  borderRadius: '0.375rem',
                  border: `1px solid ${COLORS.borderLight}`,
                  backgroundColor: COLORS.white,
                  color: COLORS.textSecondary,
                  fontSize: '0.8125rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.bgPage;
                  e.currentTarget.style.color = COLORS.textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.white;
                  e.currentTarget.style.color = COLORS.textSecondary;
                }}
              >
                Wrong category? Choose a different one
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recategorize to Different Parent Category */}
      {isExpanded && showRecategorize && onRecategorize && (
        <TransactionRecategorizePanel
          transaction={transaction}
          onRecategorize={(categoryCode) => {
            onRecategorize(transaction.id, categoryCode);
            setShowRecategorize(false);
            setIsExpanded(false);
          }}
          onCancel={() => setShowRecategorize(false)}
        />
      )}
    </div>
  );
}

// Transaction Recategorize Panel Component - Shows all available categories for individual transactions
function TransactionRecategorizePanel({ transaction, onRecategorize, onCancel }) {
  const { categoryMapping } = useAppContext();

  // Get all parent categories (those ending in .0)
  const parentCategories = categoryMapping.filter(cat =>
    cat.code.endsWith('.0') && cat.type === 'expense'
  );

  return (
    <div style={{
      padding: '1rem',
      paddingTop: '0',
      backgroundColor: COLORS.bgPage,
      borderTop: `1px solid ${COLORS.borderLight}`
    }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: COLORS.textPrimary, marginBottom: '0.25rem' }}>
          Choose a different category:
        </div>
        <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
          Transaction: {transaction.details}
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '0.5rem',
        marginBottom: '0.75rem'
      }}>
        {parentCategories.map(cat => (
          <button
            key={cat.code}
            onClick={(e) => {
              e.stopPropagation();
              onRecategorize(cat.code);
            }}
            style={{
              padding: '0.625rem',
              borderRadius: '0.375rem',
              border: `1px solid ${COLORS.borderLight}`,
              backgroundColor: COLORS.white,
              color: COLORS.textPrimary,
              fontSize: '0.8125rem',
              fontWeight: '500',
              cursor: 'pointer',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.bgPage;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.white;
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              {cat.code}
            </div>
            {cat.name}
          </button>
        ))}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        style={{
          width: '100%',
          padding: '0.625rem',
          borderRadius: '0.375rem',
          border: `1px solid ${COLORS.borderLight}`,
          backgroundColor: COLORS.white,
          color: COLORS.textSecondary,
          fontSize: '0.8125rem',
          fontWeight: '500',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.bgPage}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
      >
        Cancel
      </button>
    </div>
  );
}

// Identifier Refinement Row Component
function IdentifierRefinementRow({ identifierGroup, subcategories, selectedCategory, onSelect, categoryColor, onRecategorize, onAutoRefineSingle }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRecategorize, setShowRecategorize] = useState(false);
  const { identifier, count, sampleTransaction, suggestedCategoryCode, suggestedCategoryName } = identifierGroup;

  return (
    <div style={{
      border: `1px solid ${selectedCategory ? categoryColor : suggestedCategoryCode ? COLORS.incomeColor : COLORS.borderLight}`,
      borderRadius: '0.5rem',
      backgroundColor: selectedCategory ? `${categoryColor}10` : suggestedCategoryCode ? `${COLORS.incomeColor}08` : COLORS.white,
      overflow: 'hidden'
    }}>
      {/* Identifier Summary */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '1rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: '600', color: COLORS.textPrimary, fontSize: '0.9375rem' }}>
              {identifier}
            </span>
            {suggestedCategoryCode && !selectedCategory && (
              <span style={{
                fontSize: '0.6875rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '0.25rem',
                backgroundColor: COLORS.incomeColor,
                color: COLORS.white,
                fontWeight: '600'
              }}>
                Suggested: {suggestedCategoryName}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.8125rem', color: COLORS.textSecondary, marginTop: '0.25rem' }}>
            {count} transaction{count > 1 ? 's' : ''} • Sample: {sampleTransaction.details}
          </div>
          <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.125rem' }}>
            {sampleTransaction.date ? new Date(sampleTransaction.date).toLocaleDateString() : ''} • €{sampleTransaction.amount?.toLocaleString() || '0'}
          </div>
        </div>
        {/* Show Apply button for suggested categories */}
        {suggestedCategoryCode && !selectedCategory && onAutoRefineSingle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAutoRefineSingle(identifier);
            }}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.25rem',
              border: 'none',
              backgroundColor: COLORS.incomeColor,
              color: COLORS.white,
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              marginRight: '0.75rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Apply
          </button>
        )}
        {selectedCategory && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginRight: '1rem'
          }}>
            <CheckCircle style={{ width: '1rem', height: '1rem', color: categoryColor }} />
            <span style={{ fontSize: '0.8125rem', color: categoryColor, fontWeight: '600' }}>
              {subcategories.find(s => s.code === selectedCategory)?.name}
            </span>
          </div>
        )}
        <ArrowRight style={{
          width: '1.25rem',
          height: '1.25rem',
          color: COLORS.textSecondary,
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }} />
      </div>

      {/* Subcategory Options */}
      {isExpanded && !showRecategorize && (
        <div style={{
          padding: '1rem',
          paddingTop: '0'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.5rem'
          }}>
            {subcategories.map(subcat => (
              <button
                key={subcat.code}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(subcat.code);
                  setIsExpanded(false);
                }}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: `1px solid ${selectedCategory === subcat.code ? categoryColor : COLORS.borderLight}`,
                  backgroundColor: selectedCategory === subcat.code ? categoryColor : COLORS.white,
                  color: selectedCategory === subcat.code ? COLORS.white : COLORS.textPrimary,
                  fontSize: '0.8125rem',
                  fontWeight: selectedCategory === subcat.code ? '600' : '500',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== subcat.code) {
                    e.currentTarget.style.backgroundColor = COLORS.bgPage;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== subcat.code) {
                    e.currentTarget.style.backgroundColor = COLORS.white;
                  }
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                  {subcat.code}
                </div>
                {subcat.name}
              </button>
            ))}
          </div>

          {/* Option to choose a different parent category */}
          <div style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: `1px solid ${COLORS.borderLight}`
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRecategorize(true);
              }}
              style={{
                width: '100%',
                padding: '0.625rem',
                borderRadius: '0.375rem',
                border: `1px solid ${COLORS.borderLight}`,
                backgroundColor: COLORS.white,
                color: COLORS.textSecondary,
                fontSize: '0.8125rem',
                fontWeight: '500',
                cursor: 'pointer',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.bgPage;
                e.currentTarget.style.color = COLORS.textPrimary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.white;
                e.currentTarget.style.color = COLORS.textSecondary;
              }}
            >
              Wrong category? Choose a different one
            </button>
          </div>
        </div>
      )}

      {/* Recategorize to Different Parent Category */}
      {isExpanded && showRecategorize && onRecategorize && (
        <RecategorizePanel
          identifierGroup={identifierGroup}
          onRecategorize={(categoryCode) => {
            onRecategorize(identifier, categoryCode);
            setShowRecategorize(false);
            setIsExpanded(false);
          }}
          onCancel={() => setShowRecategorize(false)}
        />
      )}
    </div>
  );
}

// Complete Step Component
function CompleteStep({ refinedCount, learnedIdentifiers, onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <div style={{
        width: '4rem',
        height: '4rem',
        borderRadius: '50%',
        backgroundColor: `${COLORS.incomeColor}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.5rem'
      }}>
        <CheckCircle style={{ width: '2rem', height: '2rem', color: COLORS.incomeColor }} />
      </div>

      <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: COLORS.textPrimary, marginBottom: '0.75rem' }}>
        Refinement Complete!
      </h3>

      <p style={{ fontSize: '1rem', color: COLORS.textSecondary, marginBottom: '1.5rem', lineHeight: '1.6' }}>
        You've refined {refinedCount} transactions to specific subcategories.
        <br />
        Your P&L reports will now show more detailed and accurate breakdowns.
      </p>

      {/* Show learned identifiers */}
      {learnedIdentifiers && learnedIdentifiers.length > 0 && (
        <div style={{
          backgroundColor: `${COLORS.incomeColor}10`,
          border: `1px solid ${COLORS.incomeColor}`,
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: COLORS.textPrimary, marginBottom: '0.5rem' }}>
            Learned {learnedIdentifiers.length} new identifier{learnedIdentifiers.length !== 1 ? 's' : ''} for future uploads:
          </h4>
          <div style={{ fontSize: '0.8125rem', color: COLORS.textSecondary, maxHeight: '120px', overflowY: 'auto' }}>
            {learnedIdentifiers.map((item, index) => (
              <div key={index} style={{ marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '500', color: COLORS.textPrimary }}>{item.identifier}</span>
                {' → '}
                <span style={{ color: COLORS.incomeColor }}>{item.categoryName}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.75rem', marginBottom: 0 }}>
            Future transactions with these identifiers will be automatically categorized.
          </p>
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          padding: '1rem 2rem',
          borderRadius: '0.5rem',
          border: 'none',
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          fontSize: '1rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.slainteBlue}
      >
        Return to Dashboard
      </button>
    </div>
  );
}
