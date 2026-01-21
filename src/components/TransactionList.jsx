import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import { getVisibleCategories } from '../utils/categoryPreferences';
import CategoryPickerModal from './CategoryPickerModal';
import { callClaude } from '../utils/claudeAPI';
import { PARENT_CATEGORIES } from '../utils/parentCategoryMapping';
// ... other imports
import { Search, Filter, AlertCircle, FileText, Target, X, Save, AlertTriangle, CheckCircle, Brain, Activity, TrendingUp, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

// Validation function to check if transaction amount matches category type
const validateTransactionCategorization = (transaction) => {
    if (!transaction.category) return { isValid: true, error: null };

    const amount = transaction.credit || transaction.debit || transaction.amount || 0;
    const isCredit = transaction.credit > 0 || (transaction.amount > 0 && transaction.isIncome);
    const isDebit = transaction.debit > 0 || (transaction.amount > 0 && !transaction.isIncome);

    // Use the category type property directly
    const categoryType = transaction.category.type?.toLowerCase() || 'expense';

    // Validation rules based on category type
    if (categoryType === 'income' && !isCredit) {
        return {
            isValid: false,
            error: 'Income categories should only have credit (positive) amounts',
            severity: 'error',
            expectedType: 'credit',
            actualType: 'debit'
        };
    }

    if (categoryType === 'expense' && !isDebit) {
        return {
            isValid: false,
            error: 'Expense categories should only have debit (negative) amounts',
            severity: 'error',
            expectedType: 'debit',
            actualType: 'credit'
        };
    }

    // Non-business categories (drawings, capital, etc.) should typically be debits
    if (categoryType === 'non-business' && !isDebit) {
        return {
            isValid: false,
            error: 'Non-business withdrawals should only have debit (negative) amounts',
            severity: 'warning',
            expectedType: 'debit',
            actualType: 'credit'
        };
    }

    // Check for zero amounts
    if (amount === 0) {
        return {
            isValid: false,
            error: 'Transaction has zero amount',
            severity: 'warning'
        };
    }

    return { isValid: true, error: null };
};

// Function to get validation summary for all transactions
const getValidationSummary = (transactions) => {
    const errors = [];
    const warnings = [];

    transactions.forEach(transaction => {
        const validation = validateTransactionCategorization(transaction);
        if (!validation.isValid) {
            const issue = {
                transaction,
                error: validation.error,
                severity: validation.severity,
                expectedType: validation.expectedType,
                actualType: validation.actualType
            };

            if (validation.severity === 'error') {
                errors.push(issue);
            } else {
                warnings.push(issue);
            }
        }
    });

    return { errors, warnings, totalIssues: errors.length + warnings.length };
};

// Enhanced TransactionRow component with validation indicators
const TransactionRow = ({
    transaction,
    isUnidentified = false,
    isValidationIssue = false,
    showSensitiveData,
    categoryMapping,
    visibleCategories,
    handleCategorizeWithLearning,
    recategorizeTransaction,
    validationError,
    onOpenCategoryPicker,
    onIgnoreError
}) => {
    const isCredit = transaction.credit > 0 || (transaction.amount > 0 && transaction.isIncome);
    const amount = transaction.credit || transaction.debit || transaction.amount || 0;

    // Get validation status
    const validation = validateTransactionCategorization(transaction);
    const hasValidationIssue = !validation.isValid;

    return (
        <tr style={{
            borderBottom: `1px solid ${COLORS.lightGray}`,
            backgroundColor: isValidationIssue
                ? (validation.severity === 'error' ? '#FEF2F2' : '#FFFBEB')
                : 'transparent'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isValidationIssue
            ? (validation.severity === 'error' ? '#FEF2F2' : '#FFFBEB')
            : COLORS.backgroundGray}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isValidationIssue
            ? (validation.severity === 'error' ? '#FEF2F2' : '#FFFBEB')
            : 'transparent'}
        >
            <td style={{ padding: '0.5rem 1rem' }}>
                {transaction.date ? new Date(transaction.date).toLocaleDateString() : '-'}
            </td>
            <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', maxWidth: '300px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={transaction.details}>{transaction.details}</span>
                    {isValidationIssue && (
                        <span
                            style={{
                                padding: '0.125rem 0.25rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                flexShrink: 0,
                                backgroundColor: validation.severity === 'error' ? '#FEE2E2' : '#FEF3C7',
                                color: validation.severity === 'error' ? COLORS.expenseColor : COLORS.highlightYellow
                            }}
                            title={validationError || validation.error}
                        >
                            {validation.severity === 'error' ? '⚠️' : '⚡'}
                        </span>
                    )}
                </div>
                {isValidationIssue && (
                    <div style={{ fontSize: '0.75rem', color: COLORS.expenseColor, marginTop: '0.25rem' }}>
                        {validationError || validation.error}
                    </div>
                )}
            </td>
            <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                <span style={{ color: isCredit ? COLORS.incomeColor : COLORS.expenseColor }}>
                    {showSensitiveData
                        ? `${isCredit ? '+' : '-'}€${amount.toLocaleString()}`
                        : '€***'
                    }
                </span>
            </td>
            <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: isCredit ? '#CCFBF1' : '#FECACA',
                    color: isCredit ? COLORS.incomeColor : COLORS.expenseColor
                }}>
                    {isCredit ? 'CR' : 'DR'}
                </span>
            </td>

            {isUnidentified || isValidationIssue ? (
                <>
                    <td style={{ padding: '0.5rem 1rem' }}>
                        <button
                            onClick={() => onOpenCategoryPicker(transaction)}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: COLORS.white,
                                backgroundColor: COLORS.slainteBlue,
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                width: '100%'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
                            }}
                        >
                            {transaction.category?.code ? `${transaction.category.code} - ${transaction.category.name}` : 'Choose Category'}
                        </button>
                    </td>
                    {isValidationIssue && onIgnoreError && (
                        <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                            <button
                                onClick={() => onIgnoreError(transaction.id)}
                                style={{
                                    padding: '0.25rem 0.75rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: COLORS.mediumGray,
                                    backgroundColor: 'transparent',
                                    border: `1px solid ${COLORS.lightGray}`,
                                    borderRadius: '0.25rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = COLORS.lightGray;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="Ignore this error (it's actually correct)"
                            >
                                Ignore
                            </button>
                        </td>
                    )}
                </>
            ) : (
                <>
                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{transaction.category?.name}</span>
                        </div>
                    </td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                        <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            backgroundColor: transaction.category?.type === 'income' ? '#CCFBF1' :
                                transaction.category?.type === 'expense' ? '#FECACA' :
                                    '#DBEAFE',
                            color: transaction.category?.type === 'income' ? COLORS.incomeColor :
                                transaction.category?.type === 'expense' ? COLORS.expenseColor :
                                    COLORS.slainteBlue
                        }}>
                            {transaction.category?.type || 'unknown'}
                        </span>
                    </td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <button
                            onClick={() => onOpenCategoryPicker(transaction)}
                            style={{
                                padding: '0.25rem 0.75rem',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                color: COLORS.slainteBlue,
                                backgroundColor: 'transparent',
                                border: `1px solid ${COLORS.slainteBlue}`,
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}10`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            Change
                        </button>
                    </td>
                </>
            )}
        </tr>
    );
};

export default function TransactionList() {
    const {
        transactions,
        setTransactions,
        unidentifiedTransactions,
        setUnidentifiedTransactions,
        categoryMapping,
        setCategoryMapping,
        manualCategorize,
        showSensitiveData,
        recategorizeTransaction,
        getAICorrectionsPrompt,
        recordAICorrection
    } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterType, setFilterType] = useState('');
    const [sortBy, setSortBy] = useState('default'); // 'default', 'date-asc', 'date-desc', 'amount-asc', 'amount-desc'
    const [unidentifiedPage, setUnidentifiedPage] = useState(0);
    const [categorizedPage, setCategorizedPage] = useState(0);
    const [validationPage, setValidationPage] = useState(0);
    const [repeatingPage, setRepeatingPage] = useState(0);
    const [oneOffPage, setOneOffPage] = useState(0);
    const [showAllCategories, setShowAllCategories] = useState(false);

    // Category Picker Modal State
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // AI Learning Modal State
    const [showLearningModal, setShowLearningModal] = useState(false);
    const [learningTransaction, setLearningTransaction] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [wantToLearn, setWantToLearn] = useState(false);
    const [editedPattern, setEditedPattern] = useState('');

    // Expanded pattern groups state
    const [expandedPatterns, setExpandedPatterns] = useState(new Set());

    // AI suggestions state for inline categorization
    const [aiSuggestions, setAiSuggestions] = useState({}); // { pattern: { category, confidence } }
    const [loadingAISuggestions, setLoadingAISuggestions] = useState(false);

    // Collapsible sections state - all start collapsed for cleaner initial view
    const [criticalIssuesExpanded, setCriticalIssuesExpanded] = useState(false);
    const [repeatingExpanded, setRepeatingExpanded] = useState(false);
    const [oneOffExpanded, setOneOffExpanded] = useState(false);
    const [categorizedExpanded, setCategorizedExpanded] = useState(false);

    // Ignored errors state - store transaction IDs to ignore
    const [ignoredErrors, setIgnoredErrors] = useState(() => {
        const saved = localStorage.getItem('gp_finance_ignored_errors');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    // Save ignored errors to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('gp_finance_ignored_errors', JSON.stringify([...ignoredErrors]));
    }, [ignoredErrors]);

    // Filter categories based on user preferences
    const visibleCategories = getVisibleCategories(categoryMapping, null, showAllCategories);

    // Get validation summary - ensure we're actually getting the issues
    const validationSummary = getValidationSummary(transactions);
    // Filter out ignored errors - issue objects contain transaction as a property
    const transactionsWithIssues = [...validationSummary.errors, ...validationSummary.warnings].filter(
        t => !ignoredErrors.has(t.transaction.id)
    );

    // Functions to handle ignoring errors
    const handleIgnoreError = (transactionId) => {
        setIgnoredErrors(prev => new Set([...prev, transactionId]));
    };

    const handleIgnoreAllErrors = () => {
        const allErrorIds = [...validationSummary.errors, ...validationSummary.warnings].map(t => t.transaction.id);
        setIgnoredErrors(new Set(allErrorIds));
    };

    const handleClearIgnoredErrors = () => {
        setIgnoredErrors(new Set());
    };

    // Enhanced categorization function that includes amount-based matching
    const categorizeTransactionWithAmounts = (transaction, learnedIdentifiers, categoryMapping) => {
        if (!transaction) return null;

        const details = transaction.details?.toString() || '';
        const amount = transaction.credit || transaction.debit || transaction.amount || 0;
        const isCredit = transaction.credit > 0 || (transaction.amount > 0 && transaction.isIncome);
        const roundedAmount = Math.round(amount * 100) / 100;
        const amountType = isCredit ? 'CR' : 'DR';

        // Check learned patterns (including amount-based ones)
        for (const [pattern, categoryInfo] of learnedIdentifiers) {
            try {
                // Amount-based patterns
                if (pattern.startsWith('AMOUNT:')) {
                    const parts = pattern.split(':');
                    if (parts.length >= 3) {
                        const patternAmount = parseFloat(parts[1]);
                        const patternType = parts[2];
                        if (Math.abs(roundedAmount - patternAmount) < 0.01 && amountType === patternType) {
                            return categoryInfo;
                        }
                    }
                }

                // Amount range patterns
                if (pattern.startsWith('AMOUNT_RANGE:')) {
                    const parts = pattern.split(':');
                    if (parts.length >= 3) {
                        const range = parts[1].split('-');
                        const minAmount = parseFloat(range[0]);
                        const maxAmount = parseFloat(range[1]);
                        const patternType = parts[2];
                        if (roundedAmount >= minAmount && roundedAmount <= maxAmount && amountType === patternType) {
                            return categoryInfo;
                        }
                    }
                }

                // Combined patterns (text + amount)
                if (pattern.startsWith('COMBINED:')) {
                    const parts = pattern.split(':');
                    if (parts.length >= 4) {
                        const text = parts[1];
                        const patternAmount = parseFloat(parts[2]);
                        const patternType = parts[3];
                        if (details.toUpperCase().includes(text.toUpperCase()) &&
                            Math.abs(roundedAmount - patternAmount) < 0.01 &&
                            amountType === patternType) {
                            return categoryInfo;
                        }
                    }
                }

                // Text-based patterns (existing logic)
                if (!pattern.includes(':') && details.toUpperCase().includes(pattern.toUpperCase())) {
                    return categoryInfo;
                }
            } catch (e) {
                console.warn('Error parsing pattern:', pattern, e);
            }
        }

        // Check default category mapping (text-based only)
        for (const category of categoryMapping) {
            for (const identifier of category.identifiers) {
                if (details.toUpperCase().includes(identifier.toString().toUpperCase())) {
                    return category;
                }
            }
        }

        return null;
    };

    // Sort helper function
    const sortTransactions = (transactionList) => {
        if (sortBy === 'default' || !sortBy) return transactionList;

        return [...transactionList].sort((a, b) => {
            switch (sortBy) {
                case 'date-asc':
                    return new Date(a.date || 0) - new Date(b.date || 0);
                case 'date-desc':
                    return new Date(b.date || 0) - new Date(a.date || 0);
                case 'amount-asc':
                    return (a.amount || 0) - (b.amount || 0);
                case 'amount-desc':
                    return (b.amount || 0) - (a.amount || 0);
                default:
                    return 0;
            }
        });
    };

    // Filter transactions based on search and filter criteria
    const getFilteredTransactions = () => {
        let filtered = transactions;

        if (searchTerm) {
            filtered = filtered.filter(t =>
                t.details?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filterCategory) {
            filtered = filtered.filter(t => t.category?.name === filterCategory);
        }

        if (filterType) {
            filtered = filtered.filter(t => t.category?.type === filterType);
        }

        // Apply sorting
        filtered = sortTransactions(filtered);

        return filtered;
    };

    // Enhanced manual categorization with validation and AI learning workflow
    // transactionOrId can be either a transaction object (with refined pattern) or just an ID
    const handleCategorizeWithLearning = (transactionOrId, categoryCode) => {
        const category = categoryMapping.find(c => c.code === categoryCode);
        if (!category) return;

        // If a full transaction object was passed, use it directly (preserves refined pattern)
        // Otherwise, look up by ID from repeating transactions first, then unidentified, then issues
        const transactionId = typeof transactionOrId === 'object' ? transactionOrId.id : transactionOrId;
        const transaction = typeof transactionOrId === 'object'
            ? transactionOrId
            : (repeatingTransactions.find(t => t.id === transactionId) ||
               unidentifiedTransactions.find(t => t.id === transactionId) ||
               transactionsWithIssues.find(issue => issue.transaction.id === transactionId)?.transaction);
        if (!transaction) return;

        const updatedTransaction = { ...transaction, category };
        const validation = validateTransactionCategorization(updatedTransaction);

        if (!validation.isValid) {
            const shouldProceed = window.confirm(
                `Warning: ${validation.error}\n\nDo you want to proceed with this categorization anyway?`
            );
            if (!shouldProceed) {
                return;
            }
        }

        // Check if this transaction has a pattern (from repeating transactions)
        const hasPattern = transaction.pattern && typeof transaction.pattern === 'string' && transaction.pattern.trim().length > 0;

        console.log('Transaction pattern:', transaction.pattern, 'hasPattern:', hasPattern);

        // Set up the learning modal
        setLearningTransaction(updatedTransaction);
        setSelectedCategory(category);
        setWantToLearn(hasPattern); // Default to true if it has a pattern

        // Use the transaction's identified pattern if available, otherwise leave empty for custom input
        const defaultPattern = hasPattern ? transaction.pattern : '';
        setEditedPattern(defaultPattern);

        setShowLearningModal(true);
    };

    // Apply the learning decision
    const applyLearningDecision = () => {
        if (!learningTransaction || !selectedCategory) return;

        // Update the transaction with new category
        const updatedTransaction = { ...learningTransaction, category: selectedCategory };

        // If it was from validation issues, update the existing transaction
        const existingTransactionIndex = transactions.findIndex(t => t.id === learningTransaction.id);
        if (existingTransactionIndex !== -1) {
            setTransactions(prev =>
                prev.map(t => t.id === learningTransaction.id ? updatedTransaction : t)
            );
        } else {
            // If it was from unidentified, add to transactions
            setTransactions(prev => [...prev, updatedTransaction]);
        }

        // ALWAYS remove from unidentified (in case it exists in both lists)
        setUnidentifiedTransactions(prev => prev.filter(t => t.id !== learningTransaction.id));

        if (wantToLearn && editedPattern.trim()) {
            const pattern = editedPattern.trim();

            // Add the pattern to category identifiers (if not already present)
            if (!selectedCategory.identifiers.some(id => id.toUpperCase() === pattern.toUpperCase())) {
                setCategoryMapping(prev => prev.map(cat => {
                    if (cat.code === selectedCategory.code) {
                        return {
                            ...cat,
                            identifiers: [...cat.identifiers, pattern]
                        };
                    }
                    return cat;
                }));

                console.log(`✓ Learned pattern "${pattern}" for ${selectedCategory.name}`);
            }

            // Apply this pattern to other unidentified transactions
            const matchingTransactions = [];
            const remainingUnidentified = [];

            unidentifiedTransactions.forEach(transaction => {
                if (transaction.id === learningTransaction.id) return; // Skip the current transaction

                // Check if this transaction matches the learned pattern
                const detailsUpper = (transaction.details || '').toString().toUpperCase();
                if (detailsUpper.includes(pattern.toUpperCase())) {
                    const matchedTransaction = { ...transaction, category: selectedCategory };
                    matchingTransactions.push(matchedTransaction);
                } else {
                    remainingUnidentified.push(transaction);
                }
            });

            if (matchingTransactions.length > 0) {
                setTransactions(prev => [...prev, ...matchingTransactions]);
                setUnidentifiedTransactions(remainingUnidentified);

                alert(`Pattern learned! Categorized this transaction plus ${matchingTransactions.length} other matching transactions.`);
            } else {
                alert('Pattern learned! No other matching transactions found.');
            }
        } else if (!wantToLearn) {
            // If not learning, just show a simple confirmation
            alert('Transaction categorized successfully!');
        }

        // Close modal
        setShowLearningModal(false);
        setLearningTransaction(null);
        setSelectedCategory(null);
    };

    // Cancel learning workflow
    const cancelLearning = () => {
        setShowLearningModal(false);
        setLearningTransaction(null);
        setSelectedCategory(null);
        setEditedPattern('');
        setWantToLearn(false);
    };

    // Open category picker modal
    const handleOpenCategoryPicker = (transaction) => {
        setSelectedTransaction(transaction);
        setShowCategoryPicker(true);
    };

    // Handle category selection from simplified picker
    const handleCategorySelect = (categoryCode) => {
        if (!selectedTransaction) return;

        // Check if this is a repeating transaction with an AI suggestion
        const pattern = selectedTransaction.pattern;
        const aiSuggestion = pattern ? aiSuggestions[pattern] : null;

        // If there's an AI suggestion and user chose differently, record correction
        if (aiSuggestion && aiSuggestion.categoryCode !== categoryCode) {
            const userCategory = categoryMapping.find(c => c.code === categoryCode);
            const aiCategory = categoryMapping.find(c => c.code === aiSuggestion.categoryCode);

            const aiParentCat = Object.values(PARENT_CATEGORIES).find(p => p.defaultCategory === aiSuggestion.categoryCode);
            const userParentCat = Object.values(PARENT_CATEGORIES).find(p => p.defaultCategory === categoryCode);

            if (userCategory && aiCategory) {
                recordAICorrection(
                    'repeating_transactions',
                    pattern,
                    {
                        code: aiSuggestion.categoryCode,
                        name: aiCategory.name,
                        parentCategory: aiParentCat?.id || 'OTHER'
                    },
                    {
                        code: categoryCode,
                        name: userCategory.name,
                        parentCategory: userParentCat?.id || 'OTHER'
                    },
                    {
                        amount: Math.abs(selectedTransaction.amount || selectedTransaction.credit || selectedTransaction.debit || 0),
                        type: selectedTransaction.credit > 0 ? 'CR' : 'DR'
                    }
                );
            }
        }

        // Use the existing categorization logic
        const isUnidentified = unidentifiedTransactions.some(t => t.id === selectedTransaction.id);

        if (isUnidentified) {
            // Pass the full selectedTransaction to preserve the refined pattern from group
            handleCategorizeWithLearning(selectedTransaction, categoryCode);
        } else {
            recategorizeTransaction(selectedTransaction.id, categoryCode);
        }

        setShowCategoryPicker(false);
        setSelectedTransaction(null);
    };

    // Group unidentified transactions into repeating vs one-off
    const groupUnidentifiedTransactions = () => {
        const extractPattern = (details) => {
            if (!details) return '';

            // Try to extract numeric/alphanumeric patterns (like "01-101020000089" -> "01-10102000")
            // This removes trailing digits that might change between transactions
            const numericPatternMatch = details.match(/[\d\-]{8,}/);
            if (numericPatternMatch) {
                const numericStr = numericPatternMatch[0];
                // Keep the prefix (at least 70% of the string) as the pattern
                const keepLength = Math.floor(numericStr.length * 0.7);
                if (keepLength >= 6) {
                    return numericStr.substring(0, keepLength);
                }
            }

            // Try word-based extraction as fallback
            const words = details.split(/\s+/).filter(word => {
                const upper = word.toUpperCase();
                return word.length >= 4 &&
                    !['THE', 'AND', 'FOR', 'WITH', 'FROM', 'LTD', 'LIMITED', 'INC', 'CORP'].includes(upper) &&
                    !upper.startsWith('POS') &&
                    !/^POS\d/.test(upper);
            });
            if (words.length > 0) {
                return words.sort((a, b) => b.length - a.length)[0].toUpperCase();
            }
            return '';
        };

        const patternCounts = new Map();
        unidentifiedTransactions.forEach(t => {
            const pattern = extractPattern(t.details);
            if (pattern) {
                patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
            }
        });

        const repeating = [];
        const oneOff = [];

        unidentifiedTransactions.forEach(t => {
            const pattern = extractPattern(t.details);
            const count = patternCounts.get(pattern) || 0;
            if (count >= 2) {
                repeating.push({ ...t, pattern, patternCount: count });
            } else {
                oneOff.push(t);
            }
        });

        // Sort repeating by pattern for better grouping
        repeating.sort((a, b) => {
            // First sort by pattern name
            if (a.pattern < b.pattern) return -1;
            if (a.pattern > b.pattern) return 1;
            // Then by date if same pattern
            if (a.date && b.date) {
                return new Date(a.date) - new Date(b.date);
            }
            return 0;
        });

        // Sort one-off transactions by amount (highest value first)
        oneOff.sort((a, b) => {
            const amountA = Math.abs(a.amount || a.credit || a.debit || 0);
            const amountB = Math.abs(b.amount || b.credit || b.debit || 0);
            return amountB - amountA; // Descending order (highest first)
        });

        return { repeating, oneOff };
    };

    const { repeating: repeatingTransactions, oneOff: oneOffTransactions} = groupUnidentifiedTransactions();

    // Group repeating transactions by pattern for expandable view
    const groupRepeatingByPattern = () => {
        // Helper function to find longest common substring across all transaction details
        const findLongestCommonSubstring = (transactions) => {
            if (transactions.length === 0) return '';
            if (transactions.length === 1) return transactions[0].details?.trim() || '';

            // Get all detail strings and convert to uppercase for comparison
            const details = transactions.map(t => (t.details || '').toUpperCase().trim()).filter(d => d);
            if (details.length === 0) return '';

            // Use the LONGEST string as our search space
            const longest = details.reduce((max, str) => str.length > max.length ? str : max);

            // Generate all possible substrings from longest string, ordered by length (descending)
            const candidates = [];
            for (let length = longest.length; length >= 4; length--) {
                for (let start = 0; start <= longest.length - length; start++) {
                    const candidate = longest.substring(start, start + length).trim();
                    if (candidate.length >= 4) {
                        candidates.push(candidate);
                    }
                }
            }

            // Find the first (longest) substring that appears in ALL transaction details
            let bestMatch = '';
            for (const candidate of candidates) {
                if (details.every(detail => detail.includes(candidate))) {
                    bestMatch = candidate;
                    break;
                }
            }

            // Clean the identifier: remove date patterns from start
            const cleanIdentifier = (identifier) => {
                let cleaned = identifier.trim();

                // Remove common date patterns from the START only
                const monthPattern = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/;
                cleaned = cleaned.replace(monthPattern, '');

                // Remove day numbers at start (01-31, 1-31)
                cleaned = cleaned.replace(/^(0?[1-9]|[12][0-9]|3[01])\s*/, '');

                // Remove year patterns at start (2023, 23, etc.)
                cleaned = cleaned.replace(/^(20\d{2}|'\d{2}|\d{2})\s*/, '');

                // Remove "POS" prefix if followed by date-like patterns
                cleaned = cleaned.replace(/^POS\d{1,2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*/, '');

                return cleaned.trim();
            };

            const cleanedIdentifier = cleanIdentifier(bestMatch);

            // Return cleaned identifier if still long enough, otherwise return original
            if (cleanedIdentifier.length >= 4) {
                return cleanedIdentifier;
            }

            return bestMatch || transactions[0].details?.trim() || '';
        };

        const patternGroups = new Map();

        repeatingTransactions.forEach(transaction => {
            const pattern = transaction.pattern || '';
            if (!patternGroups.has(pattern)) {
                patternGroups.set(pattern, []);
            }
            patternGroups.get(pattern).push(transaction);
        });

        // Convert to array and sort by count (most occurrences first)
        return Array.from(patternGroups.entries())
            .map(([initialPattern, transactions]) => {
                // Find refined pattern using longest common substring
                const refinedPattern = findLongestCommonSubstring(transactions);

                return {
                    pattern: refinedPattern || initialPattern, // Use refined or fall back to initial
                    initialPattern, // Keep original for debugging
                    count: transactions.length,
                    transactions: transactions.sort((a, b) => {
                        if (a.date && b.date) {
                            return new Date(a.date) - new Date(b.date);
                        }
                        return 0;
                    }),
                    sample: transactions[0] // First transaction as sample
                };
            })
            .sort((a, b) => b.count - a.count); // Sort by count descending
    };

    const repeatingPatternGroups = groupRepeatingByPattern();

    // Toggle pattern expansion
    const togglePatternExpanded = (pattern) => {
        setExpandedPatterns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pattern)) {
                newSet.delete(pattern);
            } else {
                newSet.add(pattern);
            }
            return newSet;
        });
    };

    // Batch AI analysis for pattern groups
    const analyzePatternBatch = async (patternGroups) => {
        if (!patternGroups || patternGroups.length === 0) return;

        setLoadingAISuggestions(true);

        try {
            // Get API key - check Electron storage first, then localStorage
            let apiKey = null;
            if (window.electronAPI?.isElectron) {
                apiKey = await window.electronAPI.getLocalStorage('claude_api_key');
            }
            if (!apiKey) {
                apiKey = localStorage.getItem('anthropic_api_key');
            }

            if (!apiKey) {
                console.warn('No API key found - skipping AI analysis');
                setLoadingAISuggestions(false);
                return;
            }

            // Format patterns for AI analysis
            const patternsForAI = patternGroups.map(group => ({
                pattern: group.pattern,
                count: group.count,
                details: group.sample.details,
                amount: group.sample.amount || group.sample.credit || group.sample.debit || 0,
                // Correctly determine if transaction is credit (income) or debit (expense)
                type: (group.sample.credit > 0) ? 'CR' : 'DR'
            }));

            console.log('[TransactionList] Pattern groups for AI:', patternGroups.map(g => ({
                pattern: g.pattern,
                initialPattern: g.initialPattern
            })));

            // Build prompt for simplified parent category categorization
            const categoryList = Object.values(PARENT_CATEGORIES)
                .map(cat => `- ${cat.id}: ${cat.name}${cat.description ? ` (${cat.description})` : ''}`)
                .join('\n');

            // Get AI learning corrections to improve suggestions
            const learningPrompt = getAICorrectionsPrompt('repeating_transactions', 15);

            const prompt = `You are a UK GP practice expense categorization assistant. Categorize these recurring transaction patterns to one of these 7 PARENT categories ONLY.${learningPrompt}

${categoryList}

IMPORTANT RULES:
- Auto-detect income: NHS payments, GMS, PMS, private fees, reimbursements → INCOME
- Use STAFF for: salaries, wages, pensions, locum fees
- Use PREMISES for: rent, rates, utilities, repairs
- Use MEDICAL for: clinical supplies, equipment, drugs
- Use OFFICE for: stationery, IT, telephones
- Use PROFESSIONAL for: accountant, legal, bank charges
- Use DEVELOPMENT for: training, courses, indemnity, subscriptions
- Use OTHER for: sundry expenses that don't fit above

Patterns to categorize:
${patternsForAI.map((p, i) => `${i + 1}. Pattern: "${p.pattern}" | Details: ${p.details} | Amount: €${p.amount} | Type: ${p.type === 'CR' ? 'CREDIT' : 'DEBIT'} | Count: ${p.count}x`).join('\n')}

Respond with ONLY valid JSON array (no markdown):
[{"pattern": "exact pattern text from Pattern field", "category": "PARENT_CODE", "reasoning": "brief reason"}]

IMPORTANT: In the "pattern" field, return ONLY the exact text from the "Pattern:" field above, without any amounts or context.

- Return ALL ${patternsForAI.length} patterns
- Use "STAFF" for salary/wage patterns
- Use "INCOME" for any credits/payments received
- Be concise with reasoning`;

            // Call Claude API
            const response = await callClaude(prompt, {
                model: 'claude-haiku-4-5-20251001',
                maxTokens: 8000,
                apiKey: apiKey
            });

            // Check if API call was successful
            if (!response.success) {
                throw new Error(response.error || 'AI categorization failed');
            }

            // Parse response - extract text content
            let parsedSuggestions = [];
            try {
                const responseText = response.content || '';
                const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    parsedSuggestions = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON array found in response');
                }
            } catch (parseError) {
                console.error('Failed to parse AI response:', parseError);
                throw new Error('Invalid AI response format');
            }

            // Convert to suggestions map with parent category codes
            const suggestionsMap = {};
            console.log('[TransactionList] Parsed suggestions:', parsedSuggestions);

            parsedSuggestions.forEach(suggestion => {
                console.log('[TransactionList] Processing suggestion:', suggestion);

                // Find the parent category object by ID
                const parentCat = PARENT_CATEGORIES[suggestion.category];
                console.log('[TransactionList] Found parent category:', parentCat);

                if (parentCat) {
                    // Find the .0 code in categoryMapping (e.g., STAFF → 2.0)
                    const mappedCategory = categoryMapping.find(cat => cat.code === parentCat.defaultCategory);
                    console.log('[TransactionList] Mapped category:', mappedCategory);

                    if (mappedCategory) {
                        suggestionsMap[suggestion.pattern] = {
                            categoryCode: mappedCategory.code,
                            categoryName: mappedCategory.name,
                            confidence: 0.85, // 85% confidence for AI suggestions
                            reasoning: suggestion.reasoning
                        };
                        console.log('[TransactionList] Added suggestion for pattern:', suggestion.pattern);
                    } else {
                        console.warn('[TransactionList] No mapped category found for defaultCategory:', parentCat.defaultCategory);
                    }
                } else {
                    console.warn('[TransactionList] No parent category found for:', suggestion.category);
                }
            });

            console.log('[TransactionList] Final suggestions map:', suggestionsMap);

            setAiSuggestions(suggestionsMap);

            // Track which patterns we've analyzed
            patternGroups.forEach(group => {
                analyzedPatternsRef.current.add(group.pattern);
            });

            console.log(`✓ AI analyzed ${parsedSuggestions.length} patterns`);
        } catch (error) {
            console.error('Error analyzing patterns with AI:', error);
            // Don't show error to user - just log it and continue without suggestions
        } finally {
            setLoadingAISuggestions(false);
        }
    };

    // One-click accept AI suggestion
    const acceptAISuggestion = (pattern) => {
        const suggestion = aiSuggestions[pattern];
        if (!suggestion) return;

        const category = categoryMapping.find(c => c.code === suggestion.categoryCode);
        if (!category) return;

        // Find all transactions with this pattern
        const transactionsToUpdate = repeatingTransactions.filter(t => t.pattern === pattern);

        // Update all transactions with this pattern
        const updatedTransactions = transactionsToUpdate.map(t => ({ ...t, category }));

        // Add to categorized transactions
        setTransactions(prev => [...prev, ...updatedTransactions]);

        // Remove from unidentified
        setUnidentifiedTransactions(prev =>
            prev.filter(t => !transactionsToUpdate.some(ut => ut.id === t.id))
        );

        // Learn the pattern
        if (!category.identifiers.some(id => id.toUpperCase() === pattern.toUpperCase())) {
            setCategoryMapping(prev => prev.map(cat => {
                if (cat.code === category.code) {
                    return {
                        ...cat,
                        identifiers: [...cat.identifiers, pattern]
                    };
                }
                return cat;
            }));
        }

        console.log(`✓ Accepted AI suggestion: ${pattern} → ${category.name} (${transactionsToUpdate.length} transactions)`);
    };

    // Pagination settings
    const unidentifiedPerPage = 20;
    const categorizedPerPage = 50;
    const validationPerPage = 20;
    const repeatingPerPage = 10; // 10 pattern groups per page for AI batch analysis
    const oneOffPerPage = 20;

    // Calculate pagination
    const totalUnidentifiedPages = Math.ceil(unidentifiedTransactions.length / unidentifiedPerPage);
    const unidentifiedStartIndex = unidentifiedPage * unidentifiedPerPage;
    const unidentifiedEndIndex = unidentifiedStartIndex + unidentifiedPerPage;
    const currentUnidentifiedTransactions = unidentifiedTransactions.slice(unidentifiedStartIndex, unidentifiedEndIndex);

    const filteredTransactions = getFilteredTransactions();
    const totalCategorizedPages = Math.ceil(filteredTransactions.length / categorizedPerPage);
    const categorizedStartIndex = categorizedPage * categorizedPerPage;
    const categorizedEndIndex = categorizedStartIndex + categorizedPerPage;
    const currentCategorizedTransactions = filteredTransactions.slice(categorizedStartIndex, categorizedEndIndex);

    const totalValidationPages = Math.ceil(transactionsWithIssues.length / validationPerPage);
    const validationStartIndex = validationPage * validationPerPage;
    const validationEndIndex = validationStartIndex + validationPerPage;
    const currentValidationIssues = transactionsWithIssues.slice(validationStartIndex, validationEndIndex);

    // Pagination for pattern groups, not individual transactions
    const totalRepeatingPages = Math.ceil(repeatingPatternGroups.length / repeatingPerPage);
    const repeatingStartIndex = repeatingPage * repeatingPerPage;
    const repeatingEndIndex = repeatingStartIndex + repeatingPerPage;
    const currentRepeatingGroups = repeatingPatternGroups.slice(repeatingStartIndex, repeatingEndIndex);

    // Pagination for one-off transactions
    const totalOneOffPages = Math.ceil(oneOffTransactions.length / oneOffPerPage);
    const oneOffStartIndex = oneOffPage * oneOffPerPage;
    const oneOffEndIndex = oneOffStartIndex + oneOffPerPage;
    const currentOneOffTransactions = oneOffTransactions.slice(oneOffStartIndex, oneOffEndIndex);

    // Reset pagination when data changes
    useEffect(() => {
        if (unidentifiedPage >= totalUnidentifiedPages && totalUnidentifiedPages > 0) {
            setUnidentifiedPage(Math.max(0, totalUnidentifiedPages - 1));
        }
    }, [unidentifiedTransactions.length, unidentifiedPage, totalUnidentifiedPages]);

    useEffect(() => {
        if (categorizedPage >= totalCategorizedPages && totalCategorizedPages > 0) {
            setCategorizedPage(Math.max(0, totalCategorizedPages - 1));
        }
    }, [filteredTransactions.length, categorizedPage, totalCategorizedPages]);

    useEffect(() => {
        if (validationPage >= totalValidationPages && totalValidationPages > 0) {
            setValidationPage(Math.max(0, totalValidationPages - 1));
        }
    }, [transactionsWithIssues.length, validationPage, totalValidationPages]);

    useEffect(() => {
        if (repeatingPage >= totalRepeatingPages && totalRepeatingPages > 0) {
            setRepeatingPage(Math.max(0, totalRepeatingPages - 1));
        }
    }, [repeatingTransactions.length, repeatingPage, totalRepeatingPages]);

    useEffect(() => {
        if (oneOffPage >= totalOneOffPages && totalOneOffPages > 0) {
            setOneOffPage(Math.max(0, totalOneOffPages - 1));
        }
    }, [oneOffTransactions.length, oneOffPage, totalOneOffPages]);

    useEffect(() => {
        setCategorizedPage(0);
    }, [searchTerm, filterCategory, filterType]);

    // Track which patterns we've already analyzed to avoid re-analyzing
    const analyzedPatternsRef = useRef(new Set());

    // Clear AI suggestions only for patterns that no longer exist
    useEffect(() => {
        const currentPatterns = new Set(currentRepeatingGroups.map(g => g.pattern));

        // Remove suggestions for patterns that are no longer in the current view
        setAiSuggestions(prev => {
            const updated = { ...prev };
            let hasChanges = false;

            // Remove suggestions for patterns that don't exist anymore
            Object.keys(updated).forEach(pattern => {
                if (!currentPatterns.has(pattern)) {
                    delete updated[pattern];
                    analyzedPatternsRef.current.delete(pattern);
                    hasChanges = true;
                }
            });

            return hasChanges ? updated : prev;
        });
    }, [currentRepeatingGroups.map(g => g.pattern).join(',')]);

    // Pagination component
    const PaginationControls = ({ currentPage, setCurrentPage, totalPages }) => {
        if (totalPages <= 1) return null;

        const buttonStyle = (isDisabled) => ({
            padding: '0.25rem 0.5rem',
            fontSize: '0.875rem',
            border: `1px solid ${COLORS.lightGray}`,
            borderRadius: '0.25rem',
            opacity: isDisabled ? 0.5 : 1,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            backgroundColor: COLORS.white,
            color: COLORS.darkGray
        });

        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '1rem'
            }}>
                <span style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                    Page {currentPage + 1} of {totalPages}
                </span>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                        onClick={() => setCurrentPage(0)}
                        disabled={currentPage === 0}
                        style={buttonStyle(currentPage === 0)}
                        onMouseEnter={(e) => !e.target.disabled && (e.target.style.backgroundColor = COLORS.backgroundGray)}
                        onMouseLeave={(e) => e.target.style.backgroundColor = COLORS.white}
                    >
                        First
                    </button>
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                        disabled={currentPage === 0}
                        style={buttonStyle(currentPage === 0)}
                        onMouseEnter={(e) => !e.target.disabled && (e.target.style.backgroundColor = COLORS.backgroundGray)}
                        onMouseLeave={(e) => e.target.style.backgroundColor = COLORS.white}
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                        disabled={currentPage === totalPages - 1}
                        style={buttonStyle(currentPage === totalPages - 1)}
                        onMouseEnter={(e) => !e.target.disabled && (e.target.style.backgroundColor = COLORS.backgroundGray)}
                        onMouseLeave={(e) => e.target.style.backgroundColor = COLORS.white}
                    >
                        Next
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages - 1)}
                        disabled={currentPage === totalPages - 1}
                        style={buttonStyle(currentPage === totalPages - 1)}
                        onMouseEnter={(e) => !e.target.disabled && (e.target.style.backgroundColor = COLORS.backgroundGray)}
                        onMouseLeave={(e) => e.target.style.backgroundColor = COLORS.white}
                    >
                        Last
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Transactions Header */}
            <div style={{
                backgroundColor: COLORS.white,
                padding: '1.5rem',
                borderRadius: '0.5rem',
                border: `1px solid ${COLORS.lightGray}`
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>
                            Transactions
                        </h2>
                        <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                            Review and categorize your financial transactions
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAllCategories(!showAllCategories)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: showAllCategories ? COLORS.white : COLORS.slainteBlue,
                            backgroundColor: showAllCategories ? COLORS.slainteBlue : COLORS.white,
                            border: `1px solid ${COLORS.slainteBlue}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (!showAllCategories) {
                                e.target.style.backgroundColor = `${COLORS.slainteBlue}15`;
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!showAllCategories) {
                                e.target.style.backgroundColor = COLORS.white;
                            }
                        }}
                        title={showAllCategories ? 'Hide rarely-used categories' : 'Show all categories'}
                    >
                        {showAllCategories ? <EyeOff style={{ height: '1rem', width: '1rem' }} /> : <Eye style={{ height: '1rem', width: '1rem' }} />}
                        {showAllCategories ? `All Categories (${categoryMapping.filter(c => c.code.includes('.')).length})` : `Filtered (${visibleCategories.length})`}
                    </button>
                </div>
            </div>

            {/* DEBUG: Show validation status at top */}
            <div style={{
                backgroundColor: '#FFFBEB',
                padding: '0.75rem',
                borderRadius: '0.25rem',
                border: `1px solid ${COLORS.highlightYellow}`
            }}>
                <p style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                    <strong>Debug Info:</strong> Found {transactionsWithIssues.length} validation issues
                    ({validationSummary.errors.length} errors, {validationSummary.warnings.length} warnings)
                    from {transactions.length} categorized transactions
                </p>
            </div>

            {/* Validation Issues Section - PRIORITY #1 */}
            {transactionsWithIssues.length > 0 && (
                <div style={{
                    backgroundColor: COLORS.white,
                    padding: '1.5rem',
                    borderRadius: '0.5rem',
                    border: `2px solid ${COLORS.expenseColor}`,
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <button
                            onClick={() => setCriticalIssuesExpanded(!criticalIssuesExpanded)}
                            style={{
                                fontSize: '1.25rem',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                color: COLORS.expenseColor,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0
                            }}
                        >
                            {criticalIssuesExpanded ? <ChevronUp style={{ height: '1.5rem', width: '1.5rem', marginRight: '0.5rem' }} /> : <ChevronDown style={{ height: '1.5rem', width: '1.5rem', marginRight: '0.5rem' }} />}
                            <AlertTriangle style={{ height: '1.5rem', width: '1.5rem', marginRight: '0.75rem' }} />
                            🚨 CRITICAL: Fix These {transactionsWithIssues.length} Transaction Issues
                        </button>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{
                                backgroundColor: '#FECACA',
                                padding: '0.5rem 1rem',
                                borderRadius: '9999px'
                            }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: COLORS.expenseColor }}>
                                    {transactionsWithIssues.length} Issues
                                </span>
                            </div>
                            {ignoredErrors.size > 0 && (
                                <button
                                    onClick={handleClearIgnoredErrors}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: COLORS.lightGray,
                                        color: COLORS.darkGray,
                                        border: 'none',
                                        borderRadius: '0.25rem',
                                        fontSize: '0.875rem',
                                        cursor: 'pointer'
                                    }}
                                    title="Clear all ignored errors"
                                >
                                    Show {ignoredErrors.size} Ignored
                                </button>
                            )}
                        </div>
                    </div>

                    {criticalIssuesExpanded && (
                        <>
                            <div style={{
                                marginBottom: '1rem',
                                padding: '1rem',
                                backgroundColor: '#FEF2F2',
                                borderRadius: '0.5rem',
                                borderLeft: `4px solid ${COLORS.expenseColor}`
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                    <AlertTriangle style={{
                                        height: '1.5rem',
                                        width: '1.5rem',
                                        color: COLORS.expenseColor,
                                        flexShrink: 0,
                                        marginTop: '0.25rem'
                                    }} />
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{
                                            fontSize: '1.125rem',
                                            fontWeight: '600',
                                            color: COLORS.expenseColor,
                                            marginBottom: '0.5rem'
                                        }}>
                                            Categorization Problems Detected
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: COLORS.expenseColor }}>
                                            <p>• <strong>Common Issue:</strong> Refunds (credits) categorized as expenses, or vice versa</p>
                                            <p>• <strong>Action Options:</strong> Fix the category OR ignore if it's actually correct (like a refund)</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleIgnoreAllErrors}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            backgroundColor: COLORS.expenseColor,
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.25rem',
                                            fontSize: '0.875rem',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap'
                                        }}
                                        title="Ignore all errors (they are actually correct)"
                                    >
                                        Ignore All
                                    </button>
                                </div>
                            </div>


                            <div style={{ overflowX: 'auto' }}>
                                <table style={{
                                    minWidth: '100%',
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    border: `1px solid #FECACA`
                                }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#FECACA' }}>
                                            <th style={{
                                                padding: '0.75rem 1rem',
                                                textAlign: 'left',
                                                fontWeight: 'bold',
                                                color: COLORS.expenseColor,
                                                borderBottom: `1px solid #FCA5A5`
                                            }}>Date</th>
                                            <th style={{
                                                padding: '0.75rem 1rem',
                                                textAlign: 'left',
                                                fontWeight: 'bold',
                                                color: COLORS.expenseColor,
                                                borderBottom: `1px solid #FCA5A5`
                                            }}>Details & Error</th>
                                            <th style={{
                                                padding: '0.75rem 1rem',
                                                textAlign: 'right',
                                                fontWeight: 'bold',
                                                color: COLORS.expenseColor,
                                                borderBottom: `1px solid #FCA5A5`
                                            }}>Amount</th>
                                            <th style={{
                                                padding: '0.75rem 1rem',
                                                textAlign: 'center',
                                                fontWeight: 'bold',
                                                color: COLORS.expenseColor,
                                                borderBottom: `1px solid #FCA5A5`
                                            }}>Type</th>
                                            <th style={{
                                                padding: '0.75rem 1rem',
                                                textAlign: 'left',
                                                fontWeight: 'bold',
                                                color: COLORS.expenseColor,
                                                borderBottom: `1px solid #FCA5A5`
                                            }}>Fix Category</th>
                                            <th style={{
                                                padding: '0.75rem 1rem',
                                                textAlign: 'center',
                                                fontWeight: 'bold',
                                                color: COLORS.expenseColor,
                                                borderBottom: `1px solid #FCA5A5`
                                            }}>Ignore</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentValidationIssues.map((issue, index) => (
                                            <TransactionRow
                                                key={`${issue.transaction.id}-${index}`}
                                                transaction={issue.transaction}
                                                isValidationIssue={true}
                                                showSensitiveData={showSensitiveData}
                                                categoryMapping={categoryMapping}
                                                visibleCategories={visibleCategories}
                                                handleCategorizeWithLearning={handleCategorizeWithLearning}
                                                recategorizeTransaction={recategorizeTransaction}
                                                validationError={issue.error}
                                                onOpenCategoryPicker={handleOpenCategoryPicker}
                                                onIgnoreError={handleIgnoreError}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <PaginationControls
                                currentPage={validationPage}
                                setCurrentPage={setValidationPage}
                                totalPages={totalValidationPages}
                            />

                            {totalValidationPages > 1 && (
                                <div style={{
                                    marginTop: '1rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.875rem',
                                    color: COLORS.expenseColor,
                                    backgroundColor: '#FEF2F2',
                                    padding: '0.75rem',
                                    borderRadius: '0.25rem'
                                }}>
                                    <span style={{ fontWeight: '500' }}>
                                        Showing {validationStartIndex + 1}-{Math.min(validationEndIndex, transactionsWithIssues.length)} of {transactionsWithIssues.length} validation issues
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span>Go to page:</span>
                                        <select
                                            value={validationPage}
                                            onChange={(e) => setValidationPage(parseInt(e.target.value))}
                                            style={{
                                                border: `1px solid ${COLORS.lightGray}`,
                                                borderRadius: '0.25rem',
                                                padding: '0.25rem 0.5rem',
                                                backgroundColor: COLORS.white,
                                                color: COLORS.darkGray
                                            }}
                                        >
                                            {Array.from({ length: totalValidationPages }, (_, i) => (
                                                <option key={i} value={i}>{i + 1}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* AI Learning Modal */}
            {showLearningModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: COLORS.white,
                        borderRadius: '0.5rem',
                        maxWidth: '42rem',
                        width: '100%',
                        maxHeight: '95vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Fixed Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem',
                            borderBottom: `1px solid ${COLORS.lightGray}`,
                            flexShrink: 0
                        }}>
                            <h2 style={{
                                fontSize: '1.125rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                color: COLORS.darkGray
                            }}>
                                <Target style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem', color: COLORS.slainteBlue }} />
                                Smart AI Learning
                            </h2>
                            <button
                                onClick={cancelLearning}
                                style={{
                                    color: COLORS.mediumGray,
                                    cursor: 'pointer',
                                    border: 'none',
                                    background: 'none'
                                }}
                                onMouseEnter={(e) => e.target.style.color = COLORS.darkGray}
                                onMouseLeave={(e) => e.target.style.color = COLORS.mediumGray}
                            >
                                <X style={{ height: '1.25rem', width: '1.25rem' }} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            minHeight: 0
                        }}>
                            {/* Transaction Details */}
                            <div style={{
                                backgroundColor: COLORS.backgroundGray,
                                padding: '1rem',
                                borderRadius: '0.5rem'
                            }}>
                                <h3 style={{ fontWeight: '500', color: COLORS.darkGray, marginBottom: '0.5rem' }}>Transaction to Categorize:</h3>
                                <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray, marginBottom: '0.25rem' }}>
                                    <strong>Details:</strong> {learningTransaction?.details}
                                </p>
                                <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                                    <strong>Category:</strong> {selectedCategory?.name}
                                </p>
                            </div>

                            {/* Learning Options */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <h3 style={{ fontWeight: '500', color: COLORS.darkGray }}>Do you want the AI to learn from this categorization?</h3>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="radio"
                                            name="learning"
                                            value="false"
                                            checked={!wantToLearn}
                                            onChange={() => setWantToLearn(false)}
                                            style={{ marginRight: '0.5rem' }}
                                        />
                                        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: COLORS.darkGray }}>No - Just categorize this transaction</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="radio"
                                            name="learning"
                                            value="true"
                                            checked={wantToLearn}
                                            onChange={() => setWantToLearn(true)}
                                            style={{ marginRight: '0.5rem' }}
                                        />
                                        <span style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>Yes - Create AI pattern for future matching</span>
                                    </label>
                                </div>
                            </div>

                            {/* Pattern Selection */}
                            {wantToLearn && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem',
                                    borderTop: `1px solid ${COLORS.lightGray}`,
                                    paddingTop: '1rem'
                                }}>
                                    <h3 style={{ fontWeight: '500', color: COLORS.darkGray }}>Configure AI Pattern:</h3>

                                    {/* Identified Pattern Option */}
                                    {learningTransaction?.pattern && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <label style={{ fontSize: '0.875rem', fontWeight: '500', color: COLORS.darkGray }}>Identified Pattern:</label>
                                            <label
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '0.75rem',
                                                    padding: '0.75rem',
                                                    backgroundColor: editedPattern === learningTransaction.pattern ? '#DBEAFE' : COLORS.white,
                                                    border: `1px solid ${editedPattern === learningTransaction.pattern ? COLORS.slainteBlue : COLORS.lightGray}`,
                                                    borderRadius: '0.5rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (editedPattern !== learningTransaction.pattern) {
                                                        e.currentTarget.style.backgroundColor = '#F0F9FF';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (editedPattern !== learningTransaction.pattern) {
                                                        e.currentTarget.style.backgroundColor = COLORS.white;
                                                    }
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="pattern"
                                                    value={learningTransaction.pattern}
                                                    checked={editedPattern === learningTransaction.pattern}
                                                    onChange={() => setEditedPattern(learningTransaction.pattern)}
                                                    style={{ marginTop: '0.25rem', flexShrink: 0 }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: '600', fontSize: '0.9rem', color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                                                        "{learningTransaction.pattern}"
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
                                                        Will match all transactions containing this pattern in their details
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    )}

                                    {/* Custom Pattern Input */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem',
                                        borderTop: learningTransaction?.pattern ? `1px solid ${COLORS.lightGray}` : 'none',
                                        paddingTop: learningTransaction?.pattern ? '1rem' : 0
                                    }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: COLORS.darkGray }}>
                                            {learningTransaction?.pattern ? 'Or use a custom pattern:' : 'Enter a pattern:'}
                                        </label>
                                        <label
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '0.75rem',
                                                padding: '0.75rem',
                                                backgroundColor: editedPattern !== learningTransaction?.pattern ? '#DBEAFE' : COLORS.white,
                                                border: `1px solid ${editedPattern !== learningTransaction?.pattern ? COLORS.slainteBlue : COLORS.lightGray}`,
                                                borderRadius: '0.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (editedPattern === learningTransaction?.pattern) {
                                                    e.currentTarget.style.backgroundColor = '#F0F9FF';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (editedPattern === learningTransaction?.pattern) {
                                                    e.currentTarget.style.backgroundColor = COLORS.white;
                                                }
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="pattern"
                                                checked={editedPattern !== learningTransaction?.pattern}
                                                onChange={() => setEditedPattern('')}
                                                style={{ marginTop: '0.25rem', flexShrink: 0 }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: '500', fontSize: '0.875rem', color: COLORS.darkGray, marginBottom: '0.5rem' }}>
                                                    Custom Pattern
                                                </div>
                                                <input
                                                    type="text"
                                                    value={editedPattern === learningTransaction?.pattern ? '' : (editedPattern || '')}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        setEditedPattern(e.target.value);
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (editedPattern === learningTransaction?.pattern) {
                                                            setEditedPattern('');
                                                        }
                                                    }}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                    style={{
                                                        width: '100%',
                                                        border: `1px solid ${COLORS.lightGray}`,
                                                        borderRadius: '0.25rem',
                                                        padding: '0.5rem 0.75rem',
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.875rem',
                                                        color: COLORS.darkGray,
                                                        backgroundColor: COLORS.white
                                                    }}
                                                    onFocus={(e) => {
                                                        e.stopPropagation();
                                                        e.target.style.outline = `2px solid ${COLORS.slainteBlue}`;
                                                        e.target.style.borderColor = COLORS.slainteBlue;
                                                        if (editedPattern === learningTransaction?.pattern) {
                                                            setEditedPattern('');
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        e.target.style.outline = 'none';
                                                        e.target.style.borderColor = COLORS.lightGray;
                                                    }}
                                                    placeholder="e.g., 'AMAZON', 'ESB', 'Dr Smith'"
                                                />
                                                <div style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.5rem' }}>
                                                    Enter any text pattern to match future transactions (case-insensitive)
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Preview */}
                                    {editedPattern.trim() && (
                                        <div style={{
                                            backgroundColor: '#DBEAFE',
                                            padding: '0.75rem',
                                            borderRadius: '0.5rem',
                                            border: `1px solid ${COLORS.slainteBlue}`
                                        }}>
                                            <p style={{ fontSize: '0.875rem', color: COLORS.slainteBlue }}>
                                                <strong>Preview:</strong> This pattern will automatically categorize matching transactions as "<span style={{ fontWeight: '600' }}>{selectedCategory?.name}</span>"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Fixed Footer - Always Visible */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '0.75rem',
                            padding: '1rem',
                            borderTop: `1px solid ${COLORS.lightGray}`,
                            backgroundColor: COLORS.backgroundGray,
                            flexShrink: 0
                        }}>
                            <button
                                onClick={cancelLearning}
                                style={{
                                    padding: '0.5rem 1rem',
                                    color: COLORS.mediumGray,
                                    border: `1px solid ${COLORS.lightGray}`,
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    backgroundColor: COLORS.white
                                }}
                                onMouseEnter={(e) => e.target.style.color = COLORS.darkGray}
                                onMouseLeave={(e) => e.target.style.color = COLORS.mediumGray}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={applyLearningDecision}
                                style={{
                                    backgroundColor: COLORS.slainteBlue,
                                    color: COLORS.white,
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: '0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: (wantToLearn && !editedPattern.trim()) ? 0.5 : 1,
                                    cursor: (wantToLearn && !editedPattern.trim()) ? 'not-allowed' : 'pointer',
                                    border: 'none'
                                }}
                                onMouseEnter={(e) => !e.target.disabled && (e.target.style.backgroundColor = COLORS.slainteBlueDark)}
                                onMouseLeave={(e) => e.target.style.backgroundColor = COLORS.slainteBlue}
                                disabled={wantToLearn && !editedPattern.trim()}
                            >
                                <Save style={{ height: '1rem', width: '1rem', marginRight: '0.5rem' }} />
                                {wantToLearn ? 'Learn & Apply' : 'Just Categorize'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Repeating Transactions */}
            {repeatingTransactions.length > 0 && (
                <div style={{
                    backgroundColor: COLORS.white,
                    padding: '1.5rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${COLORS.lightGray}`
                }} data-tour-id="repeating-transactions-card">
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <button
                            onClick={() => setRepeatingExpanded(!repeatingExpanded)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                textAlign: 'left'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {repeatingExpanded ? <ChevronUp style={{ height: '1.5rem', width: '1.5rem' }} /> : <ChevronDown style={{ height: '1.5rem', width: '1.5rem' }} />}
                                <div>
                                    <h3 style={{
                                        fontSize: '1.125rem',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: COLORS.expenseColor
                                    }}>
                                        <TrendingUp style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem' }} />
                                        Repeating Transactions ({repeatingTransactions.length})
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                                        These transactions appear multiple times and can be quickly categorized with AI
                                    </p>
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={() => analyzePatternBatch(currentRepeatingGroups)}
                            disabled={loadingAISuggestions || currentRepeatingGroups.length === 0}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 1rem',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: COLORS.white,
                                backgroundColor: loadingAISuggestions ? COLORS.mediumGray : COLORS.slainteBlue,
                                border: 'none',
                                cursor: loadingAISuggestions || currentRepeatingGroups.length === 0 ? 'not-allowed' : 'pointer',
                                opacity: loadingAISuggestions || currentRepeatingGroups.length === 0 ? 0.6 : 1
                            }}
                            onMouseEnter={(e) => {
                                if (!loadingAISuggestions && currentRepeatingGroups.length > 0) {
                                    e.target.style.backgroundColor = COLORS.slainteBlueDark;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!loadingAISuggestions) {
                                    e.target.style.backgroundColor = COLORS.slainteBlue;
                                }
                            }}
                        >
                            <Brain style={{ height: '1rem', width: '1rem' }} />
                            {loadingAISuggestions ? 'Analyzing...' : 'Get AI Suggestions'}
                        </button>
                    </div>

                    {repeatingExpanded && (
                        <>
                            <div style={{ overflowX: 'auto' }}>
                        <table style={{
                            minWidth: '100%',
                            width: '100%',
                            borderCollapse: 'collapse'
                        }}>
                            <thead>
                                <tr style={{ backgroundColor: COLORS.backgroundGray }}>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: COLORS.darkGray, width: '50px' }}>  </th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: COLORS.darkGray }}>Pattern</th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: COLORS.darkGray }}>Date</th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: COLORS.darkGray }}>Details</th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'right', color: COLORS.darkGray }}>Amount</th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'center', color: COLORS.darkGray }}>Dr/Cr</th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: COLORS.darkGray }}>AI Suggestion</th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: COLORS.darkGray }}>Assign Category</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentRepeatingGroups.map((group) => {
                                    const isExpanded = expandedPatterns.has(group.pattern);
                                    const displayTransactions = isExpanded ? group.transactions : [group.sample];

                                    return (
                                        <React.Fragment key={group.pattern}>
                                            {displayTransactions.map((transaction, index) => (
                                                <tr key={`${transaction.id}-${index}`} style={{
                                                    borderBottom: `1px solid ${COLORS.lightGray}`,
                                                    backgroundColor: index === 0 ? COLORS.backgroundGray : 'transparent'
                                                }}>
                                                    {/* Expand/Collapse button - only on first row */}
                                                    <td style={{ padding: '0.5rem 1rem' }}>
                                                        {index === 0 && group.count > 1 && (
                                                            <button
                                                                onClick={() => togglePatternExpanded(group.pattern)}
                                                                style={{
                                                                    border: 'none',
                                                                    background: 'none',
                                                                    cursor: 'pointer',
                                                                    fontSize: '1rem',
                                                                    color: COLORS.slainteBlue,
                                                                    padding: '0',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                title={isExpanded ? 'Collapse' : `Expand ${group.count} transactions`}
                                                            >
                                                                {isExpanded ? '▼' : '▶'}
                                                            </button>
                                                        )}
                                                    </td>

                                                    {/* Pattern - only shown on first row */}
                                                    <td style={{ padding: '0.5rem 1rem' }}>
                                                        {index === 0 && (
                                                            <span style={{
                                                                fontSize: '0.75rem',
                                                                padding: '0.25rem 0.5rem',
                                                                borderRadius: '0.25rem',
                                                                backgroundColor: `${COLORS.expenseColor}20`,
                                                                color: COLORS.expenseColor,
                                                                fontWeight: '600'
                                                            }}>
                                                                {group.pattern} ({group.count}x)
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Transaction details */}
                                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: COLORS.darkGray }}>
                                                        {transaction.date ? new Date(transaction.date).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: COLORS.darkGray }}>
                                                        {showSensitiveData ? transaction.details : '***'}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', textAlign: 'right', color: COLORS.darkGray }}>
                                                        €{Math.abs(transaction.amount || transaction.debit || transaction.credit || 0).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '0.25rem 0.5rem',
                                                            borderRadius: '0.25rem',
                                                            fontSize: '0.75rem',
                                                            backgroundColor: (transaction.credit > 0) ? '#CCFBF1' : '#FECACA',
                                                            color: (transaction.credit > 0) ? COLORS.incomeColor : COLORS.expenseColor
                                                        }}>
                                                            {(transaction.credit > 0) ? 'CR' : 'DR'}
                                                        </span>
                                                    </td>

                                                    {/* AI Suggestion - only shown on first row */}
                                                    <td style={{ padding: '0.5rem 1rem' }}>
                                                        {index === 0 && (
                                                            loadingAISuggestions ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: COLORS.mediumGray }}>
                                                                    <div style={{
                                                                        width: '0.75rem',
                                                                        height: '0.75rem',
                                                                        border: `2px solid ${COLORS.lightGray}`,
                                                                        borderTopColor: COLORS.slainteBlue,
                                                                        borderRadius: '50%',
                                                                        animation: 'spin 1s linear infinite'
                                                                    }} />
                                                                    Analyzing...
                                                                </div>
                                                            ) : aiSuggestions[group.pattern] ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                        <span style={{
                                                                            fontSize: '0.75rem',
                                                                            padding: '0.25rem 0.5rem',
                                                                            borderRadius: '0.25rem',
                                                                            backgroundColor: '#DBEAFE',
                                                                            color: COLORS.slainteBlue,
                                                                            fontWeight: '600'
                                                                        }}>
                                                                            {aiSuggestions[group.pattern].categoryName}
                                                                        </span>
                                                                        <span style={{
                                                                            fontSize: '0.625rem',
                                                                            padding: '0.125rem 0.25rem',
                                                                            borderRadius: '0.25rem',
                                                                            backgroundColor: aiSuggestions[group.pattern].confidence >= 0.8 ? '#CCFBF1' :
                                                                                           aiSuggestions[group.pattern].confidence >= 0.6 ? '#FEF3C7' : '#FECACA',
                                                                            color: aiSuggestions[group.pattern].confidence >= 0.8 ? COLORS.incomeColor :
                                                                                   aiSuggestions[group.pattern].confidence >= 0.6 ? COLORS.highlightYellow : COLORS.expenseColor,
                                                                            fontWeight: '500'
                                                                        }}>
                                                                            {Math.round(aiSuggestions[group.pattern].confidence * 100)}%
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => acceptAISuggestion(group.pattern)}
                                                                        style={{
                                                                            padding: '0.25rem 0.75rem',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: '500',
                                                                            borderRadius: '0.25rem',
                                                                            backgroundColor: COLORS.slainteBlue,
                                                                            color: COLORS.white,
                                                                            border: 'none',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '0.25rem'
                                                                        }}
                                                                        onMouseEnter={(e) => e.target.style.backgroundColor = COLORS.slainteBlueDark}
                                                                        onMouseLeave={(e) => e.target.style.backgroundColor = COLORS.slainteBlue}
                                                                        title={aiSuggestions[group.pattern].reasoning}
                                                                    >
                                                                        <CheckCircle style={{ height: '0.75rem', width: '0.75rem' }} />
                                                                        Accept
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>-</span>
                                                            )
                                                        )}
                                                    </td>

                                                    <td style={{ padding: '0.5rem 1rem' }}>
                                                        <button
                                                            onClick={() => handleOpenCategoryPicker({ ...transaction, pattern: group.pattern })}
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                backgroundColor: COLORS.slainteBlue,
                                                                color: COLORS.white,
                                                                border: 'none',
                                                                borderRadius: '0.25rem',
                                                                fontSize: '0.875rem',
                                                                cursor: 'pointer',
                                                                width: '100%',
                                                                fontWeight: '500'
                                                            }}
                                                            onMouseEnter={(e) => e.target.style.backgroundColor = COLORS.slainteBlueDark}
                                                            onMouseLeave={(e) => e.target.style.backgroundColor = COLORS.slainteBlue}
                                                        >
                                                            Choose Category
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <PaginationControls
                        currentPage={repeatingPage}
                        setCurrentPage={setRepeatingPage}
                        totalPages={totalRepeatingPages}
                    />
                        </>
                    )}
                </div>
            )}

            {/* One-Off Transactions */}
            {oneOffTransactions.length > 0 && (
                <div style={{
                    backgroundColor: COLORS.white,
                    padding: '1.5rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${COLORS.lightGray}`,
                    marginTop: '1rem'
                }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <button
                            onClick={() => setOneOffExpanded(!oneOffExpanded)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                textAlign: 'left'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {oneOffExpanded ? <ChevronUp style={{ height: '1.5rem', width: '1.5rem' }} /> : <ChevronDown style={{ height: '1.5rem', width: '1.5rem' }} />}
                                <div>
                                    <h3 style={{
                                        fontSize: '1.125rem',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: COLORS.highlightYellow
                                    }}>
                                        <AlertCircle style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem' }} />
                                        One-Off Transactions ({oneOffTransactions.length})
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray, marginTop: '0.25rem' }}>
                                        These transactions appear only once and need manual categorization
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>

                    {oneOffExpanded && (
                        <>
                            <div style={{ overflowX: 'auto' }}>
                        <table style={{
                            minWidth: '100%',
                            width: '100%',
                            borderCollapse: 'collapse'
                        }}>
                            <thead>
                                <tr style={{ backgroundColor: COLORS.backgroundGray }}>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: COLORS.darkGray }}>Date</th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: COLORS.darkGray }}>Details</th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'right', color: COLORS.darkGray }}>Amount</th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'center', color: COLORS.darkGray }}>Dr/Cr</th>
                                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', color: COLORS.darkGray }}>Assign Category</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentOneOffTransactions.map((transaction, index) => (
                                    <TransactionRow
                                        key={`${transaction.id}-${index}`}
                                        transaction={transaction}
                                        isUnidentified={true}
                                        showSensitiveData={showSensitiveData}
                                        categoryMapping={categoryMapping}
                                        visibleCategories={visibleCategories}
                                        handleCategorizeWithLearning={handleCategorizeWithLearning}
                                        onOpenCategoryPicker={handleOpenCategoryPicker}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <PaginationControls
                        currentPage={oneOffPage}
                        setCurrentPage={setOneOffPage}
                        totalPages={totalOneOffPages}
                    />
                        </>
                    )}
                </div>
            )}

            {/* Categorized Transactions */}
            {transactions.length > 0 && (
                <div className="bg-white p-6 rounded-lg border" data-tour-id="transaction-table">
                    <div className="mb-6">
                        <button
                            onClick={() => setCategorizedExpanded(!categorizedExpanded)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                textAlign: 'left',
                                marginBottom: '1rem'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {categorizedExpanded ? <ChevronUp style={{ height: '1.5rem', width: '1.5rem' }} /> : <ChevronDown style={{ height: '1.5rem', width: '1.5rem' }} />}
                                <h3 className="text-lg font-semibold" style={{ color: COLORS.darkGray }}>
                                    Categorized Transactions ({filteredTransactions.length})
                                </h3>
                            </div>
                        </button>

                        {categorizedExpanded && (
                            <>
                                {/* Search and Filter Controls */}
                                <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem',
                            padding: '1rem',
                            backgroundColor: COLORS.backgroundGray,
                            borderRadius: '0.5rem'
                        }}>
                            <div style={{ position: 'relative' }}>
                                <Search style={{
                                    position: 'absolute',
                                    left: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    height: '1rem',
                                    width: '1rem',
                                    color: COLORS.mediumGray
                                }} />
                                <input
                                    type="text"
                                    placeholder="Search transactions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        paddingLeft: '2.5rem',
                                        width: '100%',
                                        border: `1px solid ${COLORS.lightGray}`,
                                        borderRadius: '0.5rem',
                                        padding: '0.5rem 0.75rem',
                                        color: COLORS.darkGray,
                                        backgroundColor: COLORS.white
                                    }}
                                />
                            </div>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                style={{
                                    border: `1px solid ${COLORS.lightGray}`,
                                    borderRadius: '0.5rem',
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: COLORS.white,
                                    color: COLORS.darkGray
                                }}
                            >
                                <option value="">All Categories</option>
                                {[...new Set(transactions.map(t => t.category?.name).filter(Boolean))].map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                style={{
                                    border: `1px solid ${COLORS.lightGray}`,
                                    borderRadius: '0.5rem',
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: COLORS.white,
                                    color: COLORS.darkGray
                                }}
                            >
                                <option value="">All Types</option>
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                                <option value="drawings">Drawings</option>
                            </select>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                style={{
                                    border: `1px solid ${COLORS.lightGray}`,
                                    borderRadius: '0.5rem',
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: COLORS.white,
                                    color: COLORS.darkGray
                                }}
                            >
                                <option value="default">Default Order</option>
                                <option value="date-desc">Date (Newest First)</option>
                                <option value="date-asc">Date (Oldest First)</option>
                                <option value="amount-desc">Amount (Highest First)</option>
                                <option value="amount-asc">Amount (Lowest First)</option>
                            </select>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Filter style={{ height: '1rem', width: '1rem', color: COLORS.mediumGray }} />
                                <span style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                                    {getFilteredTransactions().length} of {transactions.length} shown
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                                <thead>
                                    <tr style={{ backgroundColor: COLORS.backgroundGray }}>
                                        <th className="px-4 py-2 text-left">Date</th>
                                        <th className="px-4 py-2 text-left">Details</th>
                                        <th className="px-4 py-2 text-right">Amount</th>
                                        <th className="px-4 py-2 text-center">Dr/Cr</th>
                                        <th className="px-4 py-2 text-left">Category</th>
                                        <th className="px-4 py-2 text-left">Type</th>
                                        <th className="px-4 py-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentCategorizedTransactions.map((transaction, index) => (
                                        <TransactionRow
                                            key={`${transaction.id}-${index}`}
                                            transaction={transaction}
                                            isUnidentified={false}
                                            showSensitiveData={showSensitiveData}
                                            categoryMapping={categoryMapping}
                                            visibleCategories={visibleCategories}
                                            recategorizeTransaction={recategorizeTransaction}
                                            onOpenCategoryPicker={handleOpenCategoryPicker}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <PaginationControls
                            currentPage={categorizedPage}
                            setCurrentPage={setCategorizedPage}
                            totalPages={totalCategorizedPages}
                        />
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {transactions.length === 0 && unidentifiedTransactions.length === 0 && (
                <div className="bg-white p-6 rounded-lg border text-center">
                    <FileText className="mx-auto h-12 w-12 mb-4" style={{ color: COLORS.mediumGray }} />
                    <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.darkGray }}>No Transactions Loaded</h3>
                    <p style={{ color: COLORS.mediumGray }}>Upload a CSV file to see your transactions here.</p>
                </div>
            )}

            {/* Category Picker Modal */}
            <CategoryPickerModal
                isOpen={showCategoryPicker}
                onClose={() => {
                    setShowCategoryPicker(false);
                    setSelectedTransaction(null);
                }}
                transaction={selectedTransaction}
                onCategorySelect={handleCategorySelect}
                categoryMapping={categoryMapping}
            />
        </div>
    );
}