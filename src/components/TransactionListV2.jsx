import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import { getVisibleCategories } from '../utils/categoryPreferences';
import CategoryPickerModal from './CategoryPickerModal';
import { GROUPS } from '../utils/categorizationEngine';
import { PARENT_CATEGORIES, getParentCategoryForCode, getSubcategoriesForParent } from '../utils/parentCategoryMapping';
import { useProcessingFlow } from './ProcessingFlow/ProcessingFlowContext';
import ProcessingFlowPanel from './ProcessingFlow';
import { Search, Filter, FileText, Target, X, Save, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';

// ─── Confidence helpers ──────────────────────────────────────────────
const getConfidenceColor = (confidence) => {
    if (confidence >= 0.95) return COLORS.incomeColor;   // green
    if (confidence >= 0.50) return COLORS.warning;     // amber
    return COLORS.expenseColor;                           // red
};

const getConfidenceLabel = (confidence) => {
    if (confidence >= 0.95) return 'High';
    if (confidence >= 0.50) return 'Medium';
    return 'Low';
};

const getCohortFromTransaction = (t) => {
    // For categorized transactions, use categoryCohort; for others use groupCohort
    return t.categoryCohort || t.groupCohort || (t.category ? 'auto' : 'review');
};

const getConfidenceFromTransaction = (t) => {
    return t.categoryConfidence ?? t.groupConfidence ?? t.unifiedConfidence ?? (t.category ? 0.95 : 0);
};

const getGroupFromTransaction = (t) => {
    // Try explicit group field, then derive from category section mapping
    if (t.group) return t.group;
    if (t.category?.type === 'income') return 'INCOME';
    if (t.category?.type === 'non-business') return 'NON_BUSINESS';
    return 'UNKNOWN';
};

// ─── TransactionRowV2 ────────────────────────────────────────────────
const TransactionRowV2 = ({
    transaction,
    isUnidentified = false,
    onOpenCategoryPicker,
    onUpdateComment,
    recategorizeTransaction
}) => {
    const [editingComment, setEditingComment] = useState(false);
    const [commentValue, setCommentValue] = useState(transaction.comment || '');
    const isCredit = transaction.credit > 0 || (transaction.amount > 0 && transaction.isIncome);
    const amount = transaction.credit || transaction.debit || transaction.amount || 0;
    const confidence = getConfidenceFromTransaction(transaction);
    const cohort = getCohortFromTransaction(transaction);
    const group = getGroupFromTransaction(transaction);
    const groupInfo = GROUPS[group];

    return (
        <tr
            style={{
                borderBottom: `1px solid ${COLORS.borderLight}`,
                backgroundColor: isUnidentified ? COLORS.warningLighter : 'transparent'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isUnidentified ? COLORS.warningLighter : COLORS.bgPage}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isUnidentified ? COLORS.warningLighter : 'transparent'}
        >
            {/* Confidence dot */}
            <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center' }}>
                <div
                    title={`${getConfidenceLabel(confidence)} confidence (${Math.round(confidence * 100)}%)`}
                    style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: getConfidenceColor(confidence),
                        margin: '0 auto'
                    }}
                />
            </td>
            {/* Date */}
            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                {transaction.date ? new Date(transaction.date).toLocaleDateString() : '-'}
            </td>
            {/* Details */}
            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', maxWidth: '300px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={transaction.details}>
                    {transaction.details}
                </span>
            </td>
            {/* Amount */}
            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                <span style={{ color: isCredit ? COLORS.incomeColor : COLORS.expenseColor }}>
                    {`${isCredit ? '+' : '-'}€${amount.toLocaleString()}`}
                </span>
            </td>
            {/* Dr/Cr */}
            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                <span style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.7rem',
                    fontWeight: '500',
                    backgroundColor: isCredit ? COLORS.incomeColorLight : COLORS.errorLight,
                    color: isCredit ? COLORS.incomeColor : COLORS.expenseColor
                }}>
                    {isCredit ? 'CR' : 'DR'}
                </span>
            </td>
            {/* Group */}
            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                <span style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.25rem',
                    backgroundColor: `${groupInfo?.type === 'income' ? COLORS.incomeColor : groupInfo?.type === 'non-business' ? COLORS.slainteBlue : COLORS.expenseColor}15`,
                    color: COLORS.textPrimary,
                    fontSize: '0.75rem'
                }}>
                    {groupInfo?.name || group}
                </span>
            </td>
            {/* Category */}
            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                {isUnidentified ? (
                    <button
                        onClick={() => onOpenCategoryPicker(transaction)}
                        style={{
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            color: COLORS.white,
                            backgroundColor: COLORS.slainteBlue,
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                        }}
                    >
                        Categorize
                    </button>
                ) : (
                    <span>{transaction.category?.name}</span>
                )}
            </td>
            {/* Comments */}
            <td style={{ padding: '0.5rem 0.75rem', maxWidth: '150px' }}>
                {isUnidentified ? null : editingComment ? (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input
                            type="text"
                            value={commentValue}
                            onChange={(e) => setCommentValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    onUpdateComment?.(transaction.id, commentValue);
                                    setEditingComment(false);
                                } else if (e.key === 'Escape') {
                                    setCommentValue(transaction.comment || '');
                                    setEditingComment(false);
                                }
                            }}
                            autoFocus
                            style={{
                                flex: 1,
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                border: `1px solid ${COLORS.slainteBlue}`,
                                borderRadius: '0.25rem',
                                outline: 'none'
                            }}
                            placeholder="Add comment..."
                        />
                        <button
                            onClick={() => { onUpdateComment?.(transaction.id, commentValue); setEditingComment(false); }}
                            style={{ padding: '0.25rem', backgroundColor: COLORS.incomeColor, border: 'none', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <Save style={{ height: '0.875rem', width: '0.875rem', color: 'white' }} />
                        </button>
                        <button
                            onClick={() => { setCommentValue(transaction.comment || ''); setEditingComment(false); }}
                            style={{ padding: '0.25rem', backgroundColor: COLORS.borderLight, border: 'none', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <X style={{ height: '0.875rem', width: '0.875rem', color: COLORS.textPrimary }} />
                        </button>
                    </div>
                ) : (
                    <div
                        onClick={() => setEditingComment(true)}
                        style={{
                            fontSize: '0.75rem',
                            color: transaction.comment ? COLORS.textPrimary : COLORS.textSecondary,
                            cursor: 'pointer',
                            padding: '0.25rem',
                            borderRadius: '0.25rem',
                            minHeight: '1.5rem',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.bgPage}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Click to add/edit comment"
                    >
                        {transaction.comment || '+ Add'}
                    </div>
                )}
            </td>
            {/* Actions */}
            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                {!isUnidentified && (
                    <button
                        onClick={() => onOpenCategoryPicker(transaction)}
                        style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: COLORS.slainteBlue,
                            backgroundColor: 'transparent',
                            border: `1px solid ${COLORS.slainteBlue}`,
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                        }}
                    >
                        Change
                    </button>
                )}
            </td>
        </tr>
    );
};

// ─── Pagination ──────────────────────────────────────────────────────
const PaginationControls = ({ currentPage, setCurrentPage, totalPages }) => {
    if (totalPages <= 1) return null;

    const btnStyle = (disabled) => ({
        padding: '0.25rem 0.5rem',
        fontSize: '0.75rem',
        border: `1px solid ${COLORS.borderLight}`,
        borderRadius: '0.25rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        backgroundColor: COLORS.white,
        color: COLORS.textPrimary
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <button style={btnStyle(currentPage === 0)} onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>First</button>
            <button style={btnStyle(currentPage === 0)} onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>Prev</button>
            <span style={{ fontSize: '0.8rem', color: COLORS.textSecondary }}>Page {currentPage + 1} of {totalPages}</span>
            <button style={btnStyle(currentPage >= totalPages - 1)} onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>Next</button>
            <button style={btnStyle(currentPage >= totalPages - 1)} onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>Last</button>
        </div>
    );
};

// ─── Pipeline Status Summary ─────────────────────────────────────────
const PipelineStatusSummary = ({ allTransactions, onFilterClick }) => {
    const stats = useMemo(() => {
        const typeStats = { income: 0, expense: 0, nonBusiness: 0, anomaly: 0 };
        const groupStats = { auto: 0, ai_assist: 0, review: 0, conflict: 0 };
        const categoryStats = { matched: 0, ai_assist: 0, review: 0, unmatched: 0 };

        allTransactions.forEach(t => {
            // Type: prefer category.type since detectType() only returns income/expense,
            // while category.type correctly distinguishes non-business (drawings, capital, etc.)
            const type = t.category?.type || t.type || 'expense';
            if (type === 'income') typeStats.income++;
            else if (type === 'non-business' || type === 'drawings') typeStats.nonBusiness++;
            else typeStats.expense++;
            if (t.typeAnomaly) typeStats.anomaly++;

            // Group cohort
            const gc = t.groupCohort;
            if (gc === 'auto' || gc === undefined) groupStats.auto++;
            else if (gc === 'ai_assist') groupStats.ai_assist++;
            else if (gc === 'conflict') groupStats.conflict++;
            else if (gc === 'review') groupStats.review++;

            // Category cohort
            const cc = t.categoryCohort;
            if (!t.category) categoryStats.unmatched++;
            else if (cc === 'auto' || cc === undefined) categoryStats.matched++;
            else if (cc === 'ai_assist') categoryStats.ai_assist++;
            else categoryStats.review++;
        });

        return { typeStats, groupStats, categoryStats };
    }, [allTransactions]);

    const { typeStats, groupStats, categoryStats } = stats;
    const totalGroupReview = groupStats.review + groupStats.conflict;
    const totalCategoryReview = categoryStats.review + categoryStats.unmatched;
    const allGroupsDone = totalGroupReview === 0;
    const allCategoriesDone = totalCategoryReview === 0;

    const StatRow = ({ color, label, count, filterKey }) => (
        <div
            style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem',
                cursor: filterKey ? 'pointer' : 'default',
                padding: '0.15rem 0',
                borderRadius: '0.25rem'
            }}
            onClick={() => filterKey && onFilterClick(filterKey)}
            onMouseEnter={(e) => filterKey && (e.currentTarget.style.backgroundColor = COLORS.bgPage)}
            onMouseLeave={(e) => filterKey && (e.currentTarget.style.backgroundColor = 'transparent')}
        >
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
            <span style={{ color: COLORS.textPrimary }}>{count.toLocaleString()} {label}</span>
        </div>
    );

    const StatusBadge = ({ done }) => (
        <div style={{
            fontSize: '0.7rem', fontWeight: 600,
            color: done ? COLORS.incomeColor : COLORS.warning,
            display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem'
        }}>
            {done ? <CheckCircle style={{ width: 12, height: 12 }} /> : <AlertTriangle style={{ width: 12, height: 12 }} />}
            {done ? 'Complete' : 'Needs review'}
        </div>
    );

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            padding: '1rem',
            backgroundColor: COLORS.white,
            borderRadius: '0.5rem',
            border: `1px solid ${COLORS.borderLight}`
        }}>
            {/* Type column */}
            <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.textSecondary, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Level 1 — Type</div>
                <StatRow color={COLORS.expenseColor} label="expense" count={typeStats.expense} />
                <StatRow color={COLORS.incomeColor} label="income" count={typeStats.income} />
                <StatRow color={COLORS.slainteBlue} label="non-business" count={typeStats.nonBusiness} />
                {typeStats.anomaly > 0 && (
                    <StatRow color={COLORS.warning} label="anomalies" count={typeStats.anomaly} filterKey="anomaly" />
                )}
                <StatusBadge done={typeStats.anomaly === 0} />
            </div>
            {/* Group column */}
            <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.textSecondary, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Level 2 — Group</div>
                <StatRow color={COLORS.incomeColor} label="auto-matched" count={groupStats.auto} />
                <StatRow color={COLORS.warning} label="AI-assisted" count={groupStats.ai_assist} filterKey="group_ai" />
                <StatRow color={COLORS.expenseColor} label="need review" count={groupStats.review} filterKey="group_review" />
                {groupStats.conflict > 0 && (
                    <StatRow color={COLORS.chartViolet} label="conflicts" count={groupStats.conflict} filterKey="group_conflict" />
                )}
                <StatusBadge done={allGroupsDone} />
            </div>
            {/* Category column */}
            <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.textSecondary, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Level 3 — Category</div>
                <StatRow color={COLORS.incomeColor} label="matched" count={categoryStats.matched} />
                <StatRow color={COLORS.warning} label="AI-assisted" count={categoryStats.ai_assist} filterKey="category_ai" />
                <StatRow color={COLORS.expenseColor} label="need review" count={categoryStats.review} filterKey="category_review" />
                {categoryStats.unmatched > 0 && (
                    <StatRow color={COLORS.textSecondary} label="uncategorized" count={categoryStats.unmatched} filterKey="uncategorized" />
                )}
                <StatusBadge done={allCategoriesDone} />
            </div>
        </div>
    );
};

// ─── Action Required Banner ──────────────────────────────────────────
const ActionRequiredBanner = ({ allTransactions, unidentifiedCount, onReviewClick }) => {
    const anomalyCount = allTransactions.filter(t => t.typeAnomaly).length;
    const reviewCount = allTransactions.filter(t =>
        t.groupCohort === 'review' || t.groupCohort === 'conflict' ||
        t.categoryCohort === 'review' || t.categoryCohort === 'conflict'
    ).length;
    const totalNeedAttention = anomalyCount + reviewCount + unidentifiedCount;

    if (totalNeedAttention === 0) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: COLORS.successLight,
                borderRadius: '0.5rem',
                border: `1px solid ${COLORS.successLighter}`
            }}>
                <CheckCircle style={{ width: 16, height: 16, color: COLORS.incomeColor }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: COLORS.successText }}>
                    All transactions categorized
                </span>
            </div>
        );
    }

    return (
        <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: COLORS.warningLighter,
            borderRadius: '0.5rem',
            border: `1px solid ${COLORS.warningLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle style={{ width: 18, height: 18, color: COLORS.warningDark, flexShrink: 0 }} />
                <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.warningText }}>
                        {totalNeedAttention} transaction{totalNeedAttention !== 1 ? 's' : ''} need attention
                    </div>
                    <div style={{ fontSize: '0.75rem', color: COLORS.warningDark, marginTop: '0.15rem' }}>
                        {anomalyCount > 0 && <span>{anomalyCount} type anomal{anomalyCount !== 1 ? 'ies' : 'y'} &middot; </span>}
                        {reviewCount > 0 && <span>{reviewCount} low-confidence (need review) &middot; </span>}
                        {unidentifiedCount > 0 && <span>{unidentifiedCount} uncategorized</span>}
                    </div>
                </div>
            </div>
            <button
                onClick={onReviewClick}
                style={{
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: COLORS.warningText,
                    backgroundColor: COLORS.warningLight,
                    border: `1px solid ${COLORS.warningLight}`,
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.warningLight}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.warningLight}
            >
                Review Now
            </button>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════
export default function TransactionListV2() {
    const {
        transactions,
        setTransactions,
        unidentifiedTransactions,
        setUnidentifiedTransactions,
        categoryMapping,
        setCategoryMapping,
        manualCategorize,
        recategorizeTransaction,
        updateTransactionComment,
        aiCorrections,
        recordAICorrection
    } = useAppContext();

    // ─── ProcessingFlow integration ──────────────────────────────────
    const { isFlowOpen, startProcessing } = useProcessingFlow();

    // IDs of categorized transactions we pulled out for re-processing
    const [reprocessedIds, setReprocessedIds] = useState(new Set());

    const handleReviewNow = useCallback(() => {
        // Collect review-cohort categorized transactions (low confidence, need re-review)
        const reviewCohortTransactions = transactions.filter(t =>
            t.categoryCohort === 'review' || t.categoryCohort === 'conflict' ||
            t.groupCohort === 'review' || t.groupCohort === 'conflict'
        );

        // Combine with unidentified
        const batchToProcess = [...unidentifiedTransactions, ...reviewCohortTransactions];
        if (batchToProcess.length === 0) return;

        // Track which categorized ones we're re-processing so we can remove them on completion
        const ids = new Set(reviewCohortTransactions.map(t => t.id));
        setReprocessedIds(ids);

        // The "existing" context should be the categorized transactions NOT being re-processed
        const stableTransactions = transactions.filter(t => !ids.has(t.id));

        startProcessing(
            batchToProcess,
            categoryMapping,
            {
                existingTransactions: stableTransactions,
                corrections: aiCorrections?.expense_categorization || [],
                recordCorrection: recordAICorrection,
                skipCategoryStage: false
            }
        );
    }, [unidentifiedTransactions, transactions, categoryMapping, aiCorrections, recordAICorrection, startProcessing]);

    const handleProcessingComplete = useCallback((result) => {
        const { transactions: processedTransactions } = result;
        const newCategorized = [];
        const newUnidentified = [];

        processedTransactions.forEach(t => {
            if (t.category && t.categoryCode) {
                newCategorized.push(t);
            } else {
                newUnidentified.push(t);
            }
        });

        // Remove re-processed transactions from the categorized list, then add back the newly categorized
        setTransactions(prev => {
            const filtered = prev.filter(t => !reprocessedIds.has(t.id));
            return [...filtered, ...newCategorized];
        });
        // Replace unidentified with whatever is still unresolved
        setUnidentifiedTransactions(newUnidentified);
        setReprocessedIds(new Set());
    }, [setTransactions, setUnidentifiedTransactions, reprocessedIds]);

    const handleProcessingCancel = useCallback(() => {
        setReprocessedIds(new Set());
    }, []);

    const handleRemoveIdentifier = useCallback((categoryCode, identifier) => {
        setCategoryMapping(prev => prev.map(cat => {
            if (cat.code === categoryCode && cat.identifiers?.includes(identifier)) {
                return { ...cat, identifiers: cat.identifiers.filter(id => id !== identifier) };
            }
            return cat;
        }));
    }, [setCategoryMapping]);

    // ─── Filters ─────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterGroup, setFilterGroup] = useState('');
    const [filterCohort, setFilterCohort] = useState('');       // 'all' | 'auto' | 'ai_assist' | 'review'
    const [sortBy, setSortBy] = useState('default');
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [page, setPage] = useState(0);

    // ─── Category Picker ─────────────────────────────────────────────
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // ─── AI Learning Modal ───────────────────────────────────────────
    const [showLearningModal, setShowLearningModal] = useState(false);
    const [learningTransaction, setLearningTransaction] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [wantToLearn, setWantToLearn] = useState(false);
    const [editedPattern, setEditedPattern] = useState('');

    const visibleCategories = getVisibleCategories(categoryMapping, null, showAllCategories);

    // ─── Unified list: categorized + unidentified ────────────────────
    const allTransactions = useMemo(() => {
        const categorized = transactions.map(t => ({ ...t, _source: 'categorized' }));
        const unidentified = unidentifiedTransactions.map(t => ({ ...t, _source: 'unidentified' }));
        return [...categorized, ...unidentified];
    }, [transactions, unidentifiedTransactions]);

    // ─── Filtering logic ─────────────────────────────────────────────
    const filteredTransactions = useMemo(() => {
        let filtered = allTransactions;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(t => t.details?.toLowerCase().includes(term));
        }
        if (filterCategory) {
            filtered = filtered.filter(t => t.category?.name === filterCategory);
        }
        if (filterType) {
            filtered = filtered.filter(t => {
                const type = t.type || t.category?.type;
                return type === filterType;
            });
        }
        if (filterGroup) {
            filtered = filtered.filter(t => getGroupFromTransaction(t) === filterGroup);
        }
        if (filterCohort === 'auto') {
            filtered = filtered.filter(t => getCohortFromTransaction(t) === 'auto');
        } else if (filterCohort === 'ai_assist') {
            filtered = filtered.filter(t => getCohortFromTransaction(t) === 'ai_assist');
        } else if (filterCohort === 'review') {
            filtered = filtered.filter(t =>
                getCohortFromTransaction(t) === 'review' ||
                getCohortFromTransaction(t) === 'conflict' ||
                t._source === 'unidentified'
            );
        }

        // Sort
        if (sortBy && sortBy !== 'default') {
            filtered = [...filtered].sort((a, b) => {
                switch (sortBy) {
                    case 'date-asc': return new Date(a.date || 0) - new Date(b.date || 0);
                    case 'date-desc': return new Date(b.date || 0) - new Date(a.date || 0);
                    case 'amount-asc': return (a.amount || 0) - (b.amount || 0);
                    case 'amount-desc': return (b.amount || 0) - (a.amount || 0);
                    case 'confidence-asc': return getConfidenceFromTransaction(a) - getConfidenceFromTransaction(b);
                    case 'confidence-desc': return getConfidenceFromTransaction(b) - getConfidenceFromTransaction(a);
                    default: return 0;
                }
            });
        }

        return filtered;
    }, [allTransactions, searchTerm, filterCategory, filterType, filterGroup, filterCohort, sortBy]);

    // ─── Pagination ──────────────────────────────────────────────────
    const perPage = 50;
    const totalPages = Math.ceil(filteredTransactions.length / perPage);
    const startIdx = page * perPage;
    const currentPage = filteredTransactions.slice(startIdx, startIdx + perPage);

    // Reset page when filters change
    useEffect(() => { setPage(0); }, [searchTerm, filterCategory, filterType, filterGroup, filterCohort]);
    useEffect(() => {
        if (page >= totalPages && totalPages > 0) setPage(Math.max(0, totalPages - 1));
    }, [filteredTransactions.length, page, totalPages]);

    // ─── Pipeline stat click → apply filter ──────────────────────────
    const handlePipelineFilterClick = (filterKey) => {
        // Reset other filters first
        setFilterCategory('');
        setFilterType('');
        setFilterGroup('');
        setSearchTerm('');

        switch (filterKey) {
            case 'anomaly':
                // TODO: add typeAnomaly filter if needed
                setFilterCohort('review');
                break;
            case 'group_ai':
            case 'category_ai':
                setFilterCohort('ai_assist');
                break;
            case 'group_review':
            case 'group_conflict':
            case 'category_review':
            case 'uncategorized':
                setFilterCohort('review');
                break;
            default:
                setFilterCohort('');
        }
    };

    // ─── Category picker + learning ──────────────────────────────────
    const handleOpenCategoryPicker = (transaction) => {
        setSelectedTransaction(transaction);
        setShowCategoryPicker(true);
    };

    const handleCategorySelect = (categoryCode) => {
        if (!selectedTransaction) return;
        const category = categoryMapping.find(c => c.code === categoryCode);
        if (!category) return;

        // Set up learning modal
        const updatedTransaction = { ...selectedTransaction, category };
        const hasPattern = selectedTransaction.pattern && typeof selectedTransaction.pattern === 'string' && selectedTransaction.pattern.trim().length > 0;

        setLearningTransaction(updatedTransaction);
        setSelectedCategory(category);
        setWantToLearn(hasPattern);
        setEditedPattern(hasPattern ? selectedTransaction.pattern : '');
        setShowLearningModal(true);
        setShowCategoryPicker(false);
    };

    const applyLearningDecision = () => {
        if (!learningTransaction || !selectedCategory) return;

        // Clear review/conflict cohort flags — user has explicitly chosen the category
        const updatedTransaction = {
            ...learningTransaction,
            category: selectedCategory,
            categoryCode: selectedCategory.code,
            categoryName: selectedCategory.name,
            categoryCohort: 'auto',
            categoryConfidence: 1.0,
            categoryMatchType: 'manual',
            categoryReviewed: true
        };

        // If it already exists in categorized, update in place
        const existingIdx = transactions.findIndex(t => t.id === learningTransaction.id);
        if (existingIdx !== -1) {
            setTransactions(prev => prev.map(t => t.id === learningTransaction.id ? updatedTransaction : t));
        } else {
            setTransactions(prev => [...prev, updatedTransaction]);
        }

        // Always remove from unidentified
        setUnidentifiedTransactions(prev => prev.filter(t => t.id !== learningTransaction.id));

        if (wantToLearn && editedPattern.trim()) {
            const pattern = editedPattern.trim();

            // Add pattern to category identifiers
            if (!selectedCategory.identifiers.some(id => id.toUpperCase() === pattern.toUpperCase())) {
                setCategoryMapping(prev => prev.map(cat => {
                    if (cat.code === selectedCategory.code) {
                        return { ...cat, identifiers: [...cat.identifiers, pattern] };
                    }
                    return cat;
                }));
            }

            // Apply pattern to other matching unidentified
            const matchingTransactions = [];
            const remainingUnidentified = [];

            unidentifiedTransactions.forEach(t => {
                if (t.id === learningTransaction.id) return;
                const detailsUpper = (t.details || '').toString().toUpperCase();
                if (detailsUpper.includes(pattern.toUpperCase())) {
                    matchingTransactions.push({
                        ...t,
                        category: selectedCategory,
                        categoryCode: selectedCategory.code,
                        categoryName: selectedCategory.name,
                        categoryCohort: 'auto',
                        categoryConfidence: 1.0,
                        categoryMatchType: 'manual',
                        categoryReviewed: true
                    });
                } else {
                    remainingUnidentified.push(t);
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
            alert('Transaction categorized successfully!');
        }

        setShowLearningModal(false);
        setLearningTransaction(null);
        setSelectedCategory(null);
    };

    const cancelLearning = () => {
        setShowLearningModal(false);
        setLearningTransaction(null);
        setSelectedCategory(null);
        setEditedPattern('');
        setWantToLearn(false);
    };

    // ─── Cohort filter button style ──────────────────────────────────
    const CohortButton = ({ label, value }) => {
        const active = filterCohort === value;
        return (
            <button
                onClick={() => setFilterCohort(active ? '' : value)}
                style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? COLORS.white : COLORS.textPrimary,
                    backgroundColor: active ? COLORS.slainteBlue : COLORS.white,
                    border: `1px solid ${active ? COLORS.slainteBlue : COLORS.borderLight}`,
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                }}
            >
                {label}
            </button>
        );
    };

    // ─── Unique category names for filter dropdown ───────────────────
    const categoryNames = useMemo(() =>
        [...new Set(transactions.map(t => t.category?.name).filter(Boolean))].sort(),
    [transactions]);

    // ─── Group options sorted by displayOrder ────────────────────────
    const groupOptions = useMemo(() =>
        Object.values(GROUPS).sort((a, b) => a.displayOrder - b.displayOrder),
    []);

    // ═══ RENDER ══════════════════════════════════════════════════════
    if (allTransactions.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <FileText style={{ margin: '0 auto 1rem', height: '3rem', width: '3rem', color: COLORS.textSecondary }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>No Transactions Loaded</h3>
                <p style={{ color: COLORS.textSecondary }}>Upload a CSV file to see your transactions here.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* ─── Header ───────────────────────────────────────── */}
            <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: COLORS.textPrimary, marginBottom: '0.25rem' }}>
                    Transactions
                </h2>
                <p style={{ fontSize: '0.8rem', color: COLORS.textSecondary }}>
                    {transactions.length.toLocaleString()} categorized{unidentifiedTransactions.length > 0 && `, ${unidentifiedTransactions.length.toLocaleString()} unidentified`}
                </p>
            </div>

            {/* ─── Pipeline Status Summary ───────────────────────── */}
            <PipelineStatusSummary
                allTransactions={allTransactions}
                onFilterClick={handlePipelineFilterClick}
            />

            {/* ─── Action Required Banner ────────────────────────── */}
            <ActionRequiredBanner
                allTransactions={allTransactions}
                unidentifiedCount={unidentifiedTransactions.length}
                onReviewClick={handleReviewNow}
            />

            {/* ─── Unified Transaction Table ─────────────────────── */}
            <div style={{ backgroundColor: COLORS.white, borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}`, overflow: 'hidden' }}>
                {/* Filter Bar */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: COLORS.bgPage,
                    borderBottom: `1px solid ${COLORS.borderLight}`,
                    alignItems: 'center'
                }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '150px' }}>
                        <Search style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', height: '0.875rem', width: '0.875rem', color: COLORS.textSecondary }} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                paddingLeft: '2rem',
                                padding: '0.4rem 0.6rem 0.4rem 2rem',
                                border: `1px solid ${COLORS.borderLight}`,
                                borderRadius: '0.375rem',
                                fontSize: '0.8rem',
                                backgroundColor: COLORS.white,
                                color: COLORS.textPrimary
                            }}
                        />
                    </div>
                    {/* Group */}
                    <select
                        value={filterGroup}
                        onChange={(e) => setFilterGroup(e.target.value)}
                        style={{ padding: '0.4rem 0.5rem', border: `1px solid ${COLORS.borderLight}`, borderRadius: '0.375rem', fontSize: '0.8rem', backgroundColor: COLORS.white, color: COLORS.textPrimary }}
                    >
                        <option value="">All Groups</option>
                        {groupOptions.map(g => (
                            <option key={g.code} value={g.code}>{g.name}</option>
                        ))}
                    </select>
                    {/* Category */}
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        style={{ padding: '0.4rem 0.5rem', border: `1px solid ${COLORS.borderLight}`, borderRadius: '0.375rem', fontSize: '0.8rem', backgroundColor: COLORS.white, color: COLORS.textPrimary, maxWidth: '200px' }}
                    >
                        <option value="">All Categories</option>
                        {categoryNames.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    {/* Type */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        style={{ padding: '0.4rem 0.5rem', border: `1px solid ${COLORS.borderLight}`, borderRadius: '0.375rem', fontSize: '0.8rem', backgroundColor: COLORS.white, color: COLORS.textPrimary }}
                    >
                        <option value="">All Types</option>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                        <option value="non-business">Non-Business</option>
                    </select>
                    {/* Sort */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{ padding: '0.4rem 0.5rem', border: `1px solid ${COLORS.borderLight}`, borderRadius: '0.375rem', fontSize: '0.8rem', backgroundColor: COLORS.white, color: COLORS.textPrimary }}
                    >
                        <option value="default">Default Order</option>
                        <option value="date-desc">Date (Newest)</option>
                        <option value="date-asc">Date (Oldest)</option>
                        <option value="amount-desc">Amount (High)</option>
                        <option value="amount-asc">Amount (Low)</option>
                        <option value="confidence-asc">Confidence (Low first)</option>
                        <option value="confidence-desc">Confidence (High first)</option>
                    </select>
                    {/* Category visibility toggle */}
                    <button
                        onClick={() => setShowAllCategories(!showAllCategories)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                            padding: '0.4rem 0.6rem',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: showAllCategories ? COLORS.white : COLORS.slainteBlue,
                            backgroundColor: showAllCategories ? COLORS.slainteBlue : COLORS.white,
                            border: `1px solid ${COLORS.slainteBlue}`,
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                        }}
                        title={showAllCategories ? 'Hide rarely-used categories' : 'Show all categories in picker'}
                    >
                        {showAllCategories ? <EyeOff style={{ height: '0.75rem', width: '0.75rem' }} /> : <Eye style={{ height: '0.75rem', width: '0.75rem' }} />}
                        {showAllCategories ? 'All' : 'Filtered'}
                    </button>
                </div>

                {/* Cohort quick-filter buttons */}
                <div style={{
                    display: 'flex', gap: '0.375rem', padding: '0.5rem 1rem',
                    borderBottom: `1px solid ${COLORS.borderLight}`,
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginRight: '0.25rem' }}>Show:</span>
                    <CohortButton label="All" value="" />
                    <CohortButton label="Auto-matched" value="auto" />
                    <CohortButton label="AI Assisted" value="ai_assist" />
                    <CohortButton label="Needs Review" value="review" />
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
                        <Filter style={{ height: '0.75rem', width: '0.75rem', display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />
                        {filteredTransactions.length} of {allTransactions.length}
                    </span>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: COLORS.bgPage }}>
                                <th style={{ padding: '0.5rem 0.5rem', width: '30px' }} title="Confidence"></th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>Date</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>Details</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>Amount</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>Dr/Cr</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>Group</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>Category</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>Comments</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentPage.map((transaction, index) => (
                                <TransactionRowV2
                                    key={`${transaction.id}-${index}`}
                                    transaction={transaction}
                                    isUnidentified={transaction._source === 'unidentified'}
                                    onOpenCategoryPicker={handleOpenCategoryPicker}
                                    onUpdateComment={updateTransactionComment}
                                    recategorizeTransaction={recategorizeTransaction}
                                />
                            ))}
                            {currentPage.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: COLORS.textSecondary, fontSize: '0.875rem' }}>
                                        No transactions match the current filters
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ padding: '0.5rem 1rem' }}>
                    <PaginationControls currentPage={page} setCurrentPage={setPage} totalPages={totalPages} />
                </div>
            </div>

            {/* ─── AI Learning Modal ─────────────────────────────── */}
            {showLearningModal && (
                <div style={{
                    position: 'fixed', inset: 0,
                    backgroundColor: COLORS.overlayDark,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 50, padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: COLORS.white, borderRadius: '0.5rem',
                        maxWidth: '42rem', width: '100%', maxHeight: '95vh',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '1rem', borderBottom: `1px solid ${COLORS.borderLight}`, flexShrink: 0
                        }}>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', display: 'flex', alignItems: 'center', color: COLORS.textPrimary }}>
                                <Target style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem', color: COLORS.slainteBlue }} />
                                Smart AI Learning
                            </h2>
                            <button onClick={cancelLearning} style={{ color: COLORS.textSecondary, cursor: 'pointer', border: 'none', background: 'none' }}>
                                <X style={{ height: '1.25rem', width: '1.25rem' }} />
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
                            {/* Transaction Details */}
                            <div style={{ backgroundColor: COLORS.bgPage, padding: '1rem', borderRadius: '0.5rem' }}>
                                <h3 style={{ fontWeight: '500', color: COLORS.textPrimary, marginBottom: '0.5rem' }}>Transaction to Categorize:</h3>
                                <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '0.25rem' }}>
                                    <strong>Details:</strong> {learningTransaction?.details}
                                </p>
                                <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '0.25rem' }}>
                                    <strong>Group:</strong> {(() => {
                                        const parent = getParentCategoryForCode(selectedCategory?.code, categoryMapping);
                                        return parent ? `${parent.icon} ${parent.name}` : selectedCategory?.section || 'Unknown';
                                    })()}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <strong style={{ fontSize: '0.875rem', color: COLORS.textSecondary, whiteSpace: 'nowrap' }}>Category:</strong>
                                    <select
                                        value={selectedCategory?.code || ''}
                                        onChange={(e) => {
                                            const newCat = categoryMapping.find(c => c.code === e.target.value);
                                            if (newCat) setSelectedCategory(newCat);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '0.4rem 0.5rem',
                                            border: `1px solid ${COLORS.slainteBlue}`,
                                            borderRadius: '0.375rem',
                                            fontSize: '0.8rem',
                                            backgroundColor: COLORS.white,
                                            color: COLORS.textPrimary
                                        }}
                                    >
                                        {(() => {
                                            const parent = getParentCategoryForCode(selectedCategory?.code, categoryMapping);
                                            const subcats = parent ? getSubcategoriesForParent(parent.id, categoryMapping) : [];
                                            // Show subcategories within the same group, or fall back to all visible
                                            const options = subcats.length > 0 ? subcats.filter(c => c.code.includes('.')) : visibleCategories;
                                            return options.map(c => (
                                                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                                            ));
                                        })()}
                                    </select>
                                </div>
                            </div>

                            {/* Learning Options */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <h3 style={{ fontWeight: '500', color: COLORS.textPrimary }}>Do you want the AI to learn from this categorization?</h3>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center' }}>
                                        <input type="radio" name="learning" checked={!wantToLearn} onChange={() => setWantToLearn(false)} style={{ marginRight: '0.5rem' }} />
                                        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: COLORS.textPrimary }}>No - Just categorize this transaction</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center' }}>
                                        <input type="radio" name="learning" checked={wantToLearn} onChange={() => setWantToLearn(true)} style={{ marginRight: '0.5rem' }} />
                                        <span style={{ fontSize: '0.875rem', color: COLORS.textPrimary }}>Yes - Create AI pattern for future matching</span>
                                    </label>
                                </div>
                            </div>

                            {/* Pattern Selection */}
                            {wantToLearn && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: `1px solid ${COLORS.borderLight}`, paddingTop: '1rem' }}>
                                    <h3 style={{ fontWeight: '500', color: COLORS.textPrimary }}>Configure AI Pattern:</h3>

                                    {/* Identified pattern option */}
                                    {learningTransaction?.pattern && (
                                        <label
                                            style={{
                                                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                                padding: '0.75rem',
                                                backgroundColor: editedPattern === learningTransaction.pattern ? COLORS.infoLighter : COLORS.white,
                                                border: `1px solid ${editedPattern === learningTransaction.pattern ? COLORS.slainteBlue : COLORS.borderLight}`,
                                                borderRadius: '0.5rem', cursor: 'pointer'
                                            }}
                                        >
                                            <input type="radio" name="pattern" checked={editedPattern === learningTransaction.pattern}
                                                onChange={() => setEditedPattern(learningTransaction.pattern)} style={{ marginTop: '0.25rem', flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '600', fontSize: '0.9rem', color: COLORS.textPrimary }}>"{learningTransaction.pattern}"</div>
                                                <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>Will match all transactions containing this pattern</div>
                                            </div>
                                        </label>
                                    )}

                                    {/* Custom pattern input */}
                                    <label
                                        style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                            padding: '0.75rem',
                                            backgroundColor: editedPattern !== learningTransaction?.pattern ? COLORS.infoLighter : COLORS.white,
                                            border: `1px solid ${editedPattern !== learningTransaction?.pattern ? COLORS.slainteBlue : COLORS.borderLight}`,
                                            borderRadius: '0.5rem', cursor: 'pointer'
                                        }}
                                    >
                                        <input type="radio" name="pattern" checked={editedPattern !== learningTransaction?.pattern}
                                            onChange={() => setEditedPattern('')} style={{ marginTop: '0.25rem', flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '500', fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '0.5rem' }}>
                                                {learningTransaction?.pattern ? 'Or use a custom pattern:' : 'Enter a pattern:'}
                                            </div>
                                            <input
                                                type="text"
                                                value={editedPattern === learningTransaction?.pattern ? '' : (editedPattern || '')}
                                                onChange={(e) => { e.stopPropagation(); setEditedPattern(e.target.value); }}
                                                onClick={(e) => { e.stopPropagation(); if (editedPattern === learningTransaction?.pattern) setEditedPattern(''); }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                style={{
                                                    width: '100%', border: `1px solid ${COLORS.borderLight}`, borderRadius: '0.25rem',
                                                    padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontSize: '0.875rem', color: COLORS.textPrimary
                                                }}
                                                onFocus={(e) => {
                                                    e.stopPropagation();
                                                    e.target.style.outline = `2px solid ${COLORS.slainteBlue}`;
                                                    if (editedPattern === learningTransaction?.pattern) setEditedPattern('');
                                                }}
                                                onBlur={(e) => { e.target.style.outline = 'none'; }}
                                                placeholder="e.g., 'AMAZON', 'ESB', 'Dr Smith'"
                                            />
                                            <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.5rem' }}>
                                                Enter any text pattern to match future transactions (case-insensitive)
                                            </div>
                                        </div>
                                    </label>

                                    {/* Preview */}
                                    {editedPattern.trim() && (
                                        <div style={{ backgroundColor: COLORS.infoLighter, padding: '0.75rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.slainteBlue}` }}>
                                            <p style={{ fontSize: '0.875rem', color: COLORS.slainteBlue }}>
                                                <strong>Preview:</strong> This pattern will automatically categorize matching transactions as "<strong>{selectedCategory?.name}</strong>"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{
                            display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
                            padding: '1rem', borderTop: `1px solid ${COLORS.borderLight}`,
                            backgroundColor: COLORS.bgPage, flexShrink: 0
                        }}>
                            <button onClick={cancelLearning} style={{
                                padding: '0.5rem 1rem', color: COLORS.textSecondary,
                                border: `1px solid ${COLORS.borderLight}`, borderRadius: '0.5rem',
                                cursor: 'pointer', backgroundColor: COLORS.white
                            }}>
                                Cancel
                            </button>
                            <button
                                onClick={applyLearningDecision}
                                disabled={wantToLearn && !editedPattern.trim()}
                                style={{
                                    backgroundColor: COLORS.slainteBlue, color: COLORS.white,
                                    padding: '0.5rem 1.5rem', borderRadius: '0.5rem',
                                    display: 'flex', alignItems: 'center', border: 'none',
                                    opacity: (wantToLearn && !editedPattern.trim()) ? 0.5 : 1,
                                    cursor: (wantToLearn && !editedPattern.trim()) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <Save style={{ height: '1rem', width: '1rem', marginRight: '0.5rem' }} />
                                {wantToLearn ? 'Learn & Apply' : 'Just Categorize'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Category Picker Modal ─────────────────────────── */}
            <CategoryPickerModal
                isOpen={showCategoryPicker}
                onClose={() => { setShowCategoryPicker(false); setSelectedTransaction(null); }}
                transaction={selectedTransaction}
                onCategorySelect={handleCategorySelect}
                categoryMapping={categoryMapping}
            />

            {/* ─── ProcessingFlow Panel (for Review Now) ─────────── */}
            {isFlowOpen && (
                <ProcessingFlowPanel
                    categoryMapping={categoryMapping}
                    onComplete={handleProcessingComplete}
                    onCancel={handleProcessingCancel}
                    onRemoveIdentifier={handleRemoveIdentifier}
                />
            )}
        </div>
    );
}
