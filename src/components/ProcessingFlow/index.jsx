/**
 * Processing Flow Component
 *
 * Finn-guided transaction processing flow with stages:
 * - Type sorting (automatic)
 * - Group sorting with cohort review
 * - Category sorting with cohort review (deferrable)
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  ProcessingFlowProvider,
  useProcessingFlow,
  STAGES,
  COHORTS
} from './ProcessingFlowContext';
import { GROUPS } from '../../utils/categorizationEngine';
import COLORS from '../../utils/colors';

// Destructure for convenience
const { slainteBlue, incomeColor, expenseColor, highlightYellow } = COLORS;

// Finn avatar for guidance messages
const FinnAvatar = () => (
  <div style={{
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${slainteBlue} 0%, #357ABD 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 600,
    fontSize: '14px',
    flexShrink: 0
  }}>
    F
  </div>
);

// Stage indicator - Updated to include AI processing stages
const StageIndicator = ({ currentStage }) => {
  const stages = [
    { key: 'type', label: 'Type', stages: [STAGES.TYPE_SORTING, STAGES.TYPE_REVIEW] },
    { key: 'group', label: 'Group', stages: [STAGES.GROUP_SORTING, STAGES.GROUP_AI_PROCESSING, STAGES.GROUP_REVIEW] },
    { key: 'category', label: 'Category', stages: [STAGES.CATEGORY_SORTING, STAGES.CATEGORY_AI_PROCESSING, STAGES.CATEGORY_REVIEW] }
  ];

  const getCurrentStageIndex = () => {
    for (let i = 0; i < stages.length; i++) {
      if (stages[i].stages.includes(currentStage)) return i;
    }
    return currentStage === STAGES.COMPLETE ? stages.length : -1;
  };

  const currentIndex = getCurrentStageIndex();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '12px 0'
    }}>
      {stages.map((stage, i) => (
        <React.Fragment key={stage.key}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <div style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: i < currentIndex ? incomeColor :
                         i === currentIndex ? slainteBlue : '#e0e0e0',
              color: i <= currentIndex ? 'white' : '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 600
            }}>
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize: '13px',
              fontWeight: i === currentIndex ? 600 : 400,
              color: i === currentIndex ? slainteBlue : '#666'
            }}>
              {stage.label}
            </span>
          </div>
          {i < stages.length - 1 && (
            <div style={{
              width: 30,
              height: 2,
              background: i < currentIndex ? incomeColor : '#e0e0e0'
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// Cohort badge - Updated labels to reflect actual behavior
const CohortBadge = ({ cohort, count }) => {
  const colors = {
    [COHORTS.AUTO]: { bg: '#e8f5e9', color: '#2e7d32', label: 'Auto-Matched', icon: '✓' },
    [COHORTS.AI_ASSIST]: { bg: '#e3f2fd', color: '#1565c0', label: 'AI Suggested', icon: '✦' },
    [COHORTS.REVIEW]: { bg: '#fff3e0', color: '#ef6c00', label: 'Need Input', icon: '?' },
    [COHORTS.CONFLICT]: { bg: '#fce4ec', color: '#ad1457', label: 'Conflict', icon: '⚠' },
    needs_review: { bg: '#fff3e0', color: '#ef6c00', label: 'Needs Review', icon: '?' }
  };

  const style = colors[cohort] || { bg: '#f5f5f5', color: '#666', label: cohort, icon: '' };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 12,
      background: style.bg,
      color: style.color,
      fontSize: '12px',
      fontWeight: 500
    }}>
      {style.icon && <span>{style.icon}</span>}
      <span>{style.label}</span>
      <span style={{
        background: style.color,
        color: 'white',
        borderRadius: 8,
        padding: '1px 6px',
        fontSize: '11px'
      }}>
        {count}
      </span>
    </div>
  );
};

// Finn guidance message
const FinnGuidance = ({ message }) => (
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    background: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 16
  }}>
    <FinnAvatar />
    <div style={{
      flex: 1,
      fontSize: '14px',
      lineHeight: 1.5,
      color: '#333'
    }}>
      {message}
    </div>
  </div>
);

// Auto-matched transactions debug panel - collapsible list of all AUTO cohort transactions
const AutoMatchedDebugPanel = ({ transactions, isGroupLevel }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedTx, setExpandedTx] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 50;

  const autoMatched = transactions.filter(t =>
    isGroupLevel ? t.groupCohort === 'auto' : t.categoryCohort === 'auto'
  );

  if (autoMatched.length === 0) return null;

  // Calculate pagination
  const totalPages = Math.ceil(autoMatched.length / PAGE_SIZE);
  const startIdx = showAll ? 0 : currentPage * PAGE_SIZE;
  const endIdx = showAll ? autoMatched.length : Math.min(startIdx + PAGE_SIZE, autoMatched.length);
  const displayedTransactions = autoMatched.slice(startIdx, endIdx);

  return (
    <div style={{
      marginBottom: 16,
      border: '1px solid #e8f5e9',
      borderRadius: 8,
      overflow: 'hidden'
    }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: '#e8f5e9',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          fontWeight: 500,
          color: '#2e7d32'
        }}
      >
        <span>✓ Auto-Matched ({autoMatched.length}) - Click to inspect calculations</span>
        <span>{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div style={{ maxHeight: showAll ? 600 : 400, overflowY: 'auto', padding: 8, background: '#fafafa' }}>
          {displayedTransactions.map((tx, i) => {
            const calc = tx.calculationDetails;
            const similarCalc = calc?.similar || {};
            const identifierCalc = calc?.identifier || {};
            const isThisExpanded = expandedTx === tx.id;

            return (
              <div key={tx.id} style={{
                padding: 8,
                marginBottom: 4,
                background: 'white',
                borderRadius: 6,
                border: '1px solid #e0e0e0',
                fontSize: '11px'
              }}>
                <div
                  onClick={() => setExpandedTx(isThisExpanded ? null : tx.id)}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{tx.details?.substring(0, 45)}{tx.details?.length > 45 ? '...' : ''}</span>
                    <span style={{ marginLeft: 8, color: '#666' }}>
                      → {isGroupLevel ? tx.group : tx.categoryName || tx.categoryCode}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: '#e8f5e9',
                      color: '#2e7d32',
                      fontWeight: 500
                    }}>
                      {((tx.unifiedConfidence || 0) * 100).toFixed(0)}%
                    </span>
                    <span style={{ color: '#999' }}>{isThisExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>

                {isThisExpanded && calc && (
                  <div style={{
                    marginTop: 8,
                    padding: 8,
                    background: '#f8f9fa',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    fontSize: '10px'
                  }}>
                    <div style={{ marginBottom: 6 }}>
                      <strong>SIMILAR TRANSACTIONS (90% weight):</strong>
                      {similarCalc.count > 0 ? (
                        <div style={{ paddingLeft: 8, marginTop: 4 }}>
                          {(similarCalc.matches || []).slice(0, 3).map((m, j) => (
                            <div key={j} style={{ color: (m.diffRatio || 0) > 0.5 ? '#ef6c00' : '#666' }}>
                              #{j + 1}: "{(m.details || '').substring(0, 30)}..." → diff {(m.diffRatio || 0).toFixed(2)}
                              {(m.diffRatio || 0) > 0.5 && ' (weak)'}
                            </div>
                          ))}
                          <div style={{ color: '#1565c0', marginTop: 4 }}>
                            Avg diff: {(similarCalc.avgDiffRatio || 0).toFixed(4)} | Count: {similarCalc.count}
                          </div>
                          <div style={{ color: '#1565c0' }}>
                            Formula: {similarCalc.formula || `1 - (${(similarCalc.avgDiffRatio || 0).toFixed(4)})^${similarCalc.count}`} = {((similarCalc.score || 0) * 100).toFixed(1)}%
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#999', marginLeft: 8 }}>None</span>
                      )}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <strong>IDENTIFIER (10% weight):</strong>
                      {identifierCalc.bestMatch ? (
                        <span style={{ marginLeft: 8, color: '#2e7d32' }}>
                          "{identifierCalc.bestMatch}" → {((identifierCalc.score || 0) * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span style={{ color: '#999', marginLeft: 8 }}>None</span>
                      )}
                    </div>
                    {(() => {
                      // Calculate pre-AI combined score for display
                      const preAIScore = (similarCalc.score || 0) * 0.9 + (identifierCalc.score || 0) * 0.1;
                      const hasAIBoost = calc?.bayesian && calc.bayesian.aiConfidence > 0;
                      const finalScore = tx.unifiedConfidence || 0;

                      return (
                        <>
                          <div style={{
                            borderTop: '1px solid #ddd',
                            paddingTop: 4,
                            color: hasAIBoost ? '#666' : '#2e7d32',
                            fontWeight: hasAIBoost ? 'normal' : 600
                          }}>
                            COMBINED: ({((similarCalc.score || 0) * 100).toFixed(0)}% × 0.9) + ({((identifierCalc.score || 0) * 100).toFixed(0)}% × 0.1) = {(preAIScore * 100).toFixed(1)}%
                          </div>
                          {hasAIBoost && (
                            <div style={{
                              marginTop: 4,
                              padding: 4,
                              background: calc.bayesian.aiConfirmed ? '#e8f5e9' : '#fff3e0',
                              borderRadius: 4,
                              color: calc.bayesian.aiConfirmed ? '#1b5e20' : '#e65100'
                            }}>
                              <strong>{calc.bayesian.aiConfirmed ? '+ AI CONFIRMED:' : '⚠ AI OVERRIDE:'}</strong>
                              {calc.bayesian.aiConfirmed ? (
                                <>
                                  {' '}{(calc.bayesian.prePrediction * 100).toFixed(0)}% pre + {(calc.bayesian.aiConfidence * 100).toFixed(0)}% AI → {(calc.bayesian.combined * 100).toFixed(1)}%
                                  <div style={{ fontSize: '9px', marginTop: 2 }}>
                                    Formula: 1 - (1 - {(calc.bayesian.prePrediction * 100).toFixed(0)}%) × (1 - {(calc.bayesian.aiConfidence * 100).toFixed(0)}%)
                                  </div>
                                </>
                              ) : (
                                <>
                                  {' '}AI suggests different group ({(calc.bayesian.aiConfidence * 100).toFixed(0)}% confidence)
                                  <div style={{ fontSize: '9px', marginTop: 2 }}>
                                    No Bayesian boost - AI disagrees with pre-prediction
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                          <div style={{
                            marginTop: 4,
                            fontWeight: 600,
                            color: finalScore >= 0.90 ? '#2e7d32' : finalScore >= 0.50 ? '#ed6c02' : '#d32f2f'
                          }}>
                            FINAL: {(finalScore * 100).toFixed(1)}% → {finalScore >= 0.90 ? 'AUTO ✓' : finalScore >= 0.50 ? 'AI_ASSIST' : 'REVIEW'}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination controls */}
          {autoMatched.length > PAGE_SIZE && (
            <div style={{
              padding: 12,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 12,
              borderTop: '1px solid #e0e0e0',
              marginTop: 8
            }}>
              {!showAll ? (
                <>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      border: '1px solid #ccc',
                      background: currentPage === 0 ? '#f5f5f5' : 'white',
                      cursor: currentPage === 0 ? 'default' : 'pointer',
                      fontSize: '12px',
                      color: currentPage === 0 ? '#999' : '#333'
                    }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    Page {currentPage + 1} of {totalPages} ({startIdx + 1}-{endIdx} of {autoMatched.length})
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      border: '1px solid #ccc',
                      background: currentPage >= totalPages - 1 ? '#f5f5f5' : 'white',
                      cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer',
                      fontSize: '12px',
                      color: currentPage >= totalPages - 1 ? '#999' : '#333'
                    }}
                  >
                    Next →
                  </button>
                  <button
                    onClick={() => setShowAll(true)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      border: '1px solid #2e7d32',
                      background: 'white',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#2e7d32'
                    }}
                  >
                    Show All
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setShowAll(false); setCurrentPage(0); }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: '1px solid #666',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#666'
                  }}
                >
                  Show Paginated ({autoMatched.length} total)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Stats summary card
const StatsSummary = ({ stats }) => {
  if (!stats) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12,
      marginBottom: 16
    }}>
      <div style={{
        padding: 12,
        background: '#f5f5f5',
        borderRadius: 8,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 600, color: '#333' }}>
          {stats.total}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>Total</div>
      </div>
      <div style={{
        padding: 12,
        background: '#e8f5e9',
        borderRadius: 8,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 600, color: incomeColor }}>
          {stats.income}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>Income</div>
      </div>
      <div style={{
        padding: 12,
        background: '#ffebee',
        borderRadius: 8,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 600, color: expenseColor }}>
          {stats.expense}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>Expense</div>
      </div>
      <div style={{
        padding: 12,
        background: stats.typeAnomalies > 0 ? '#fff3e0' : '#f5f5f5',
        borderRadius: 8,
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 600,
          color: stats.typeAnomalies > 0 ? '#ef6c00' : '#999'
        }}>
          {stats.typeAnomalies}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>Anomalies</div>
      </div>
    </div>
  );
};

// Cohort distribution display - Order: Auto-Matched → Conflict → Needs Review (merged AI+Review)
const CohortDistribution = ({ counts, layer }) => (
  <div style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  }}>
    <CohortBadge cohort={COHORTS.AUTO} count={counts.auto} />
    {counts.conflict > 0 && (
      <CohortBadge cohort={COHORTS.CONFLICT} count={counts.conflict} />
    )}
    {(counts.ai_assist + counts.review) > 0 && (
      <CohortBadge cohort="needs_review" count={counts.ai_assist + counts.review} />
    )}
  </div>
);

// Debug panel for calculation details
const CalculationDebugPanel = ({ transaction }) => {
  const calc = transaction.calculationDetails;
  if (!calc) return null;

  const similarCalc = calc.similar || {};
  const identifierCalc = calc.identifier || {};

  return (
    <div style={{
      marginTop: 8,
      padding: 10,
      background: '#f8f9fa',
      borderRadius: 6,
      fontSize: '11px',
      fontFamily: 'monospace',
      borderLeft: '3px solid ' + slainteBlue
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#333' }}>
        Confidence Calculation
      </div>

      {/* Similar Transactions Score (90% weight) */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 500, color: '#666' }}>
          SIMILAR TRANSACTIONS (90% weight):
        </div>
        {similarCalc.count > 0 ? (
          <>
            <div style={{ paddingLeft: 8, color: '#444' }}>
              {(similarCalc.matches || []).slice(0, 3).map((match, i) => (
                <div key={i} style={{ marginTop: 2 }}>
                  #{i + 1}: "{(match.details || '').substring(0, 35)}..." → diff {match.diffRatio?.toFixed(4) || 'N/A'}
                </div>
              ))}
              <div style={{ marginTop: 4, color: '#1565c0' }}>
                Avg diff ratio: {similarCalc.avgDiffRatio?.toFixed(4) || 'N/A'}
              </div>
              <div style={{ color: '#1565c0' }}>
                Formula: {similarCalc.formula || 'N/A'}
              </div>
              <div style={{ fontWeight: 500, color: '#2e7d32' }}>
                Similar Score: {((similarCalc.score || 0) * 100).toFixed(1)}%
              </div>
            </div>
          </>
        ) : (
          <div style={{ paddingLeft: 8, color: '#999' }}>No similar transactions found</div>
        )}
      </div>

      {/* Identifier Score (10% weight) */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 500, color: '#666' }}>
          IDENTIFIER MATCH (10% weight):
        </div>
        <div style={{ paddingLeft: 8, color: '#444' }}>
          {identifierCalc.bestMatch ? (
            <>
              <div>Best: "{identifierCalc.bestMatch}" → {identifierCalc.matchedChars}/{identifierCalc.totalChars} chars ({identifierCalc.matchType})</div>
              <div style={{ fontWeight: 500, color: '#2e7d32' }}>
                Identifier Score: {((identifierCalc.score || 0) * 100).toFixed(1)}%
              </div>
            </>
          ) : (
            <div style={{ color: '#999' }}>No identifier match</div>
          )}
        </div>
      </div>

      {/* Combined Score */}
      <div style={{
        borderTop: '1px solid #ddd',
        paddingTop: 6,
        marginTop: 6
      }}>
        <div style={{ fontWeight: 500, color: '#666' }}>
          COMBINED ({calc.formula || 'N/A'}):
        </div>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: (transaction.unifiedConfidence || 0) >= 0.90 ? '#2e7d32' :
                 (transaction.unifiedConfidence || 0) >= 0.50 ? '#1565c0' : '#ef6c00'
        }}>
          FINAL: {((transaction.unifiedConfidence || 0) * 100).toFixed(1)}% → {(transaction.unifiedCohort || 'review').toUpperCase()}
          {(transaction.unifiedConfidence || 0) >= 0.90 && ' ✓'}
        </div>
      </div>
    </div>
  );
};

// Transaction review item - Shows match type and AI reasoning with selection controls
// Now supports batch application to similar transactions
const TransactionReviewItem = ({ transaction, onUpdate, categoryMapping, isGroupLevel, onRecordCorrection, similarTransactions = [], onUpdateAndSimilar, onChangeWithSimilar, onSimilarChanged }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingGroup, setIsChangingGroup] = useState(false); // For category level: user wants to change group
  const [showDebug, setShowDebug] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState(transaction.comment || '');
  const [showBatchApply, setShowBatchApply] = useState(false); // Show option to apply to similar
  const selectionMadeRef = useRef(false); // Track if selection was just made to prevent blur interference
  const amount = transaction.debit || transaction.credit || transaction.amount;
  const isExpense = transaction.type === 'expense';
  const hasSimilar = similarTransactions.length > 0;

  // Determine what kind of match we have
  const matchType = isGroupLevel ? transaction.groupMatchType : transaction.categoryMatchType;
  const aiSuggestion = isGroupLevel ? transaction.aiGroupSuggestion : transaction.aiCategorySuggestion;
  const reason = isGroupLevel ? transaction.groupReason : transaction.categoryReason;
  const matchedIdentifier = isGroupLevel ? transaction.groupMatchedIdentifier : transaction.categoryMatchedIdentifier;

  // Format the match info
  // Priority: USER SELECTION > identifier > AI suggestion > unified confidence > similar transaction > probability > no match
  const getMatchInfo = () => {
    // CRITICAL: If user has manually selected, ALWAYS show their choice, not AI's suggestion
    // This prevents the UI from reverting to AI suggestion after user makes a selection
    const isUserSelected = matchType === 'user_selected' ||
                           matchType === 'user_accepted_ai' ||
                           matchType === 'user_accepted' ||
                           matchType === 'user_changed_group' ||
                           matchType === 'user_resolved_conflict';

    if (isUserSelected) {
      // User has made a choice - show their selected value
      const displayName = isGroupLevel
        ? (GROUPS[transaction.group]?.name || transaction.group)
        : (transaction.categoryName || transaction.categoryCode);
      return {
        label: 'User selected',
        detail: 'You selected this category',
        color: '#2e7d32',  // Green for user choice
        displayGroup: isGroupLevel ? transaction.group : null,
        displayCategory: !isGroupLevel ? transaction.categoryCode : null,
        displayName
      };
    }

    if (matchType === 'identifier') {
      return { label: 'Identifier matched', detail: matchedIdentifier, color: '#2e7d32' };
    }

    // AI suggestion - but FIRST check if transaction already has a different value
    // (e.g., from similar transaction matching). If so, show the transaction's value.
    if (aiSuggestion) {
      const aiConfidence = Math.round((aiSuggestion.confidence || 0) * 100);
      const aiGroup = aiSuggestion.group;
      const aiCategory = aiSuggestion.categoryCode;

      // CRITICAL FIX: Check if transaction's value differs from AI's suggestion
      // This happens when similar transaction matching set a category, then AI suggested differently
      // In this case, show what's actually set on the transaction (the select's value)
      const transactionHasDifferentCategory = !isGroupLevel &&
        transaction.categoryCode &&
        aiCategory &&
        transaction.categoryCode !== aiCategory;

      const transactionHasDifferentGroup = isGroupLevel &&
        transaction.group &&
        transaction.group !== 'UNKNOWN' &&
        aiGroup &&
        transaction.group !== aiGroup;

      if (transactionHasDifferentCategory || transactionHasDifferentGroup) {
        // Transaction has a value that differs from AI - show transaction's value
        // This prevents the confusing case where dropdown shows one thing but display shows another
        const displayName = isGroupLevel
          ? (GROUPS[transaction.group]?.name || transaction.group)
          : (transaction.categoryName || transaction.categoryCode);

        return {
          label: `Similar match (AI suggested different)`,
          detail: `Set to ${displayName}. AI suggested: ${isGroupLevel ? GROUPS[aiGroup]?.name : aiSuggestion.categoryName}`,
          color: '#ff9800',  // Orange to indicate conflict
          displayGroup: isGroupLevel ? transaction.group : null,
          displayCategory: !isGroupLevel ? transaction.categoryCode : null,
          displayName,
          aiSuggestsDifferent: true  // Flag for UI styling
        };
      }

      // Get the display group/category - use AI's suggestion when available
      // IMPORTANT: If AI couldn't determine a group (undefined or UNKNOWN), default to OTHER
      const effectiveGroup = (aiGroup && aiGroup !== 'UNKNOWN') ? aiGroup : 'OTHER';
      const displayGroup = isGroupLevel ? effectiveGroup : null;
      const displayCategory = !isGroupLevel ? aiCategory : null;
      const displayName = isGroupLevel
        ? (GROUPS[effectiveGroup]?.name || 'Petty Cash / Other')
        : aiSuggestion.categoryName;

      // Use AI's reasoning directly
      const reasoning = aiSuggestion.reasoning || `AI suggested this assignment with ${aiConfidence}% confidence.`;

      return {
        label: `${aiConfidence}% AI confidence`,
        detail: reasoning,
        color: '#1565c0',
        // Pass the AI's suggested group/category as the display value
        displayGroup,
        displayCategory,
        displayName
      };
    }

    // Unified confidence match - new Levenshtein-based scoring
    // Generate more descriptive reasoning from calculation details
    if (matchType === 'unified_confidence') {
      const confidence = transaction.unifiedConfidence || 0;
      const cohort = transaction.unifiedCohort || 'review';
      const calc = transaction.calculationDetails;

      // Build descriptive reasoning from similar transactions
      let detailedReason = '';
      let suggestedCategoryCode = null;
      let suggestedCategoryName = null;

      if (calc?.similar?.matches?.length > 0) {
        const topMatches = calc.similar.matches.slice(0, 2);
        const matchDescriptions = topMatches.map(m => {
          const similarity = Math.round((1 - (m.diffRatio || 0)) * 100);
          const shortDetails = (m.details || '').substring(0, 25);
          return `"${shortDetails}..." (${similarity}% similar)`;
        });
        detailedReason = `Similar to ${matchDescriptions.join(' and ')}`;

        // Add category/group info if available - show appropriate level based on isGroupLevel
        const firstMatch = topMatches[0];
        if (firstMatch) {
          if (isGroupLevel) {
            // Group level: show group name
            if (firstMatch.group) {
              const groupName = GROUPS[firstMatch.group]?.name || firstMatch.group;
              detailedReason += ` which was categorized as ${groupName}`;
            }
          } else {
            // Category level: show category name, not group name
            // Also extract the suggested category for display
            if (firstMatch.categoryName || firstMatch.category?.name) {
              suggestedCategoryName = firstMatch.categoryName || firstMatch.category?.name;
              suggestedCategoryCode = firstMatch.categoryCode || firstMatch.category?.code;
              detailedReason += ` which was categorized as ${suggestedCategoryName}`;
            } else if (firstMatch.categoryCode || firstMatch.category?.code) {
              // Fallback to code if name not available
              const catCode = firstMatch.categoryCode || firstMatch.category?.code;
              const cat = categoryMapping?.find(c => c.code === catCode);
              suggestedCategoryCode = catCode;
              suggestedCategoryName = cat?.name || catCode;
              detailedReason += ` which was categorized as ${suggestedCategoryName}`;
            }
          }
        }
        detailedReason += '.';
      } else {
        detailedReason = reason || 'Categorized based on transaction analysis.';
      }

      return {
        label: `${Math.round(confidence * 100)}% confidence`,
        detail: detailedReason,
        color: cohort === 'auto' ? '#2e7d32' : cohort === 'ai_assist' ? '#1565c0' : '#ef6c00',
        // For category level, provide the suggested category from similar transactions
        displayCategory: !isGroupLevel ? suggestedCategoryCode : null,
        displayName: !isGroupLevel ? suggestedCategoryName : null
      };
    }

    // Similar transaction match - based on existing categorized transactions
    if (matchType === 'similar_transaction' && reason) {
      return { label: 'Similar transaction', detail: reason, color: '#7b1fa2' }; // Purple for similar
    }

    if (matchType === 'probability' && reason) {
      return { label: 'Partial match', detail: reason, color: '#ef6c00' };
    }

    // Check if this is an UNKNOWN group - show as "Petty Cash / Other" default with guidance
    const currentGroup = isGroupLevel ? transaction.group : null;
    if (currentGroup === 'UNKNOWN') {
      return {
        label: 'Needs review',
        detail: 'No matching patterns found. Defaulting to Petty Cash / Other - please accept or change.',
        color: '#ef6c00',  // Orange for needs action
        isUnknown: true,
        displayGroup: 'OTHER',  // Show OTHER as the display group
        displayName: 'Petty Cash / Other'
      };
    }

    return { label: 'No match', detail: 'Please categorize manually', color: '#c62828' };
  };

  const matchInfo = getMatchInfo();

  // Get current value for editing
  const currentValue = isGroupLevel ? transaction.group : transaction.categoryCode;

  // Get options for the dropdown
  const getOptions = () => {
    if (isGroupLevel) {
      // Show all groups (including Income, Non-Business) so user can reclassify freely
      // Only exclude UNKNOWN (system state, not user-selectable)
      return Object.values(GROUPS)
        .filter(g => g.code !== 'UNKNOWN')
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(g => ({ value: g.code, label: g.name }));
    } else {
      // When in "change group" mode, show group options instead of categories
      if (isChangingGroup) {
        return Object.values(GROUPS)
          .filter(g => g.code !== 'UNKNOWN')
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(g => ({ value: `GROUP:${g.code}`, label: g.name }));
      }

      // Get categories in the current group
      const groupCode = transaction.group;
      const categoryOptions = (categoryMapping || [])
        .filter(cat => {
          const section = cat.section?.toUpperCase() || '';
          if (groupCode === 'INCOME') return section.includes('INCOME');
          if (groupCode === 'STAFF') return section.includes('STAFF');
          if (groupCode === 'PREMISES') return section.includes('PREMISES');
          if (groupCode === 'MEDICAL') return section.includes('MEDICAL');
          if (groupCode === 'OFFICE') return section.includes('OFFICE') || section.includes('ADMIN');
          if (groupCode === 'PROFESSIONAL') return section.includes('PROFESSIONAL');
          if (groupCode === 'MOTOR') return section.includes('MOTOR');
          if (groupCode === 'NON_BUSINESS') return section.includes('NON-BUSINESS') || section.includes('DRAWING');
          return section.includes('OTHER');
        })
        .map(c => ({ value: c.code, label: c.name }));

      // Add "CHANGE GROUP" option at the top
      return [
        { value: 'CHANGE_GROUP', label: '— CHANGE GROUP —', isSpecial: true },
        ...categoryOptions
      ];
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value;

    console.log('[TransactionReviewItem] handleChange called:', {
      newValue,
      isGroupLevel,
      transactionId: transaction.id,
      currentCategory: transaction.categoryCode
    });

    // Mark that a selection was made - prevents blur from interfering
    selectionMadeRef.current = true;

    // Handle special "CHANGE GROUP" selection - switches to group selection mode
    if (newValue === 'CHANGE_GROUP') {
      setIsChangingGroup(true);
      selectionMadeRef.current = false; // Not a final selection, allow blur to work
      return; // Keep dropdown open, now showing groups
    }

    // Handle group selection when in "change group" mode (prefixed with GROUP:)
    if (newValue.startsWith('GROUP:')) {
      const selectedGroupCode = newValue.replace('GROUP:', '');
      console.log('[TransactionReviewItem] Changing group to:', selectedGroupCode);
      if (onUpdate) {
        // Determine if the group change also changes the transaction type
        const selectedGroup = GROUPS[selectedGroupCode];
        const newType = selectedGroup ? selectedGroup.type : transaction.type;
        // Update the group and reset category (needs re-categorization)
        const groupChangeUpdates = {
          group: selectedGroupCode,
          groupReviewed: true,
          groupMatchType: 'user_changed_group',
          ...(newType !== transaction.type ? { type: newType } : {}),
          // Reset category since group changed
          categoryCode: null,
          categoryName: null,
          categoryReviewed: false,
          categoryMatchType: null,
          category: null,
          aiCategorySuggestion: null
        };

        // Auto-apply to similar transactions
        if (hasSimilar && onChangeWithSimilar) {
          const { updatedCount, previousStates } = onChangeWithSimilar(transaction.id, groupChangeUpdates, 'group');
          if (updatedCount > 0 && onSimilarChanged) {
            const groupName = selectedGroup?.name || selectedGroupCode;
            onSimilarChanged(
              `Changed to ${groupName} \u2014 applied to ${updatedCount} similar transaction${updatedCount > 1 ? 's' : ''}`,
              previousStates
            );
          }
        } else {
          onUpdate(transaction.id, groupChangeUpdates);
        }
      }
      setIsChangingGroup(false);
      setIsEditing(false);
      return;
    }

    if (onUpdate) {
      if (isGroupLevel) {
        // Record AI correction if user chose differently from AI suggestion
        if (onRecordCorrection && aiSuggestion && aiSuggestion.group !== newValue) {
          const aiSuggestedGroup = GROUPS[aiSuggestion.group];
          const userChosenGroup = GROUPS[newValue];
          if (aiSuggestedGroup && userChosenGroup) {
            onRecordCorrection(
              'expense_categorization',
              transaction.details?.substring(0, 50) || 'Unknown',
              { code: aiSuggestion.group, name: aiSuggestedGroup.name },
              { code: newValue, name: userChosenGroup.name },
              {
                amount: transaction.debit || transaction.credit || transaction.amount,
                type: transaction.type,
                layer: 'group',
                aiConfidence: aiSuggestion.confidence
              }
            );
          }
        }
        // Determine if the group change also changes the transaction type
        const selectedGroup = GROUPS[newValue];
        const newType = selectedGroup ? selectedGroup.type : transaction.type;
        const groupUpdates = {
          group: newValue,
          groupReviewed: true,
          groupMatchType: 'user_selected',
          groupCohort: 'auto', // Mark as resolved so AI won't re-process
          ...(newType !== transaction.type ? { type: newType } : {})
        };

        // Auto-apply to similar transactions (skip already user-changed ones)
        if (hasSimilar && onChangeWithSimilar) {
          const { updatedCount, previousStates } = onChangeWithSimilar(transaction.id, groupUpdates, 'group');
          if (updatedCount > 0 && onSimilarChanged) {
            const groupName = selectedGroup?.name || newValue;
            onSimilarChanged(
              `Changed to ${groupName} \u2014 applied to ${updatedCount} similar transaction${updatedCount > 1 ? 's' : ''}`,
              previousStates
            );
          }
        } else {
          onUpdate(transaction.id, groupUpdates);
        }
      } else {
        const selectedCat = categoryMapping?.find(c => c.code === newValue);
        // Record AI correction if user chose differently from AI suggestion
        if (onRecordCorrection && aiSuggestion && aiSuggestion.categoryCode !== newValue) {
          const aiSuggestedCat = categoryMapping?.find(c => c.code === aiSuggestion.categoryCode);
          if (aiSuggestedCat && selectedCat) {
            onRecordCorrection(
              'expense_categorization',
              transaction.details?.substring(0, 50) || 'Unknown',
              { code: aiSuggestion.categoryCode, name: aiSuggestedCat.name },
              { code: newValue, name: selectedCat.name },
              {
                amount: transaction.debit || transaction.credit || transaction.amount,
                type: transaction.type,
                layer: 'category',
                group: transaction.group,
                aiConfidence: aiSuggestion.confidence
              }
            );
          }
        }
        console.log('[TransactionReviewItem] Updating category:', {
          transactionId: transaction.id,
          from: transaction.categoryCode,
          to: newValue,
          categoryName: selectedCat?.name,
          categoryFound: !!selectedCat,
          availableCategories: categoryMapping?.filter(c => c.section?.toUpperCase().includes('STAFF')).map(c => c.code)
        });
        const categoryUpdates = {
          categoryCode: newValue,
          categoryName: selectedCat?.name || newValue,
          categoryReviewed: true,
          categoryMatchType: 'user_selected',
          categoryCohort: 'auto', // Mark as resolved so AI won't re-process
          category: selectedCat
        };

        // Auto-apply to similar transactions (skip already user-changed ones)
        if (hasSimilar && onChangeWithSimilar) {
          const { updatedCount, previousStates } = onChangeWithSimilar(transaction.id, categoryUpdates, 'category');
          if (updatedCount > 0 && onSimilarChanged) {
            const catName = selectedCat?.name || newValue;
            onSimilarChanged(
              `Changed to ${catName} \u2014 applied to ${updatedCount} similar transaction${updatedCount > 1 ? 's' : ''}`,
              previousStates
            );
          }
        } else {
          onUpdate(transaction.id, categoryUpdates);
        }
      }
    }
    console.log('[TransactionReviewItem] Setting isEditing to false');
    setIsChangingGroup(false);
    setIsEditing(false);
  };

  return (
    <div style={{
      padding: 12,
      background: 'white',
      borderRadius: 8,
      border: '1px solid #e0e0e0',
      marginBottom: 8
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#333',
            marginBottom: 4
          }}>
            {transaction.details?.substring(0, 50)}
            {transaction.details?.length > 50 && '...'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {transaction.date instanceof Date
              ? transaction.date.toLocaleDateString()
              : transaction.date}
          </div>
        </div>
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: isExpense ? expenseColor : incomeColor
        }}>
          {isExpense ? '-' : '+'}€{amount?.toLocaleString()}
        </div>
      </div>

      {/* Suggestion with match type indicator and selection */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: '12px'
      }}>
        {/* Suggested Group/Category - larger and more prominent */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px 12px',
          background: matchInfo.aiSuggestsDifferent ? '#fff3e0' : '#f8f9fa',
          borderRadius: 6,
          borderLeft: `3px solid ${matchInfo.color}`
        }}>
          {isEditing ? (
            <select
              value={isChangingGroup ? '' : (currentValue || '')}
              onChange={handleChange}
              onMouseDown={(e) => {
                // DEBUG: Log what was clicked
                console.log('[TransactionReviewItem] Select mousedown, target value:', e.target.value);
              }}
              onClick={(e) => {
                // DEBUG: Log click event
                console.log('[TransactionReviewItem] Select clicked, current value:', currentValue);
              }}
              onBlur={() => {
                // Delay blur handling to allow onChange to complete first
                // This prevents race condition where blur closes dropdown before selection is processed
                setTimeout(() => {
                  // Skip if a selection was just made - handleChange already set the state
                  if (selectionMadeRef.current) {
                    console.log('[TransactionReviewItem] Blur skipped - selection was made');
                    selectionMadeRef.current = false;
                    return;
                  }
                  console.log('[TransactionReviewItem] Blur triggered - closing dropdown');
                  setIsEditing(false);
                  setIsChangingGroup(false);
                }, 150);
              }}
              autoFocus
              style={{
                padding: '6px 10px',
                borderRadius: 4,
                border: '1px solid ' + (isChangingGroup ? '#ff9800' : slainteBlue),
                fontSize: '13px',
                flex: 1,
                maxWidth: 250,
                background: isChangingGroup ? '#fff8e1' : 'white'
              }}
            >
              <option value="">{isChangingGroup ? 'Select new group...' : 'Select...'}</option>
              {getOptions().map(opt => (
                <option
                  key={opt.value}
                  value={opt.value}
                  style={opt.isSpecial ? { fontWeight: 'bold', color: '#1565c0' } : {}}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* Group/Category display
                    For Groups:
                    1. AI's suggested group (matchInfo.displayName)
                    2. UNKNOWN defaults to "Petty Cash / Other"
                    3. Algorithm's assigned group
                    For Categories:
                    1. AI's suggested category (matchInfo.displayName)
                    2. Similar transaction's category (matchInfo.displayName from unified_confidence)
                    3. Transaction's assigned category (transaction.categoryName)
                    4. "Uncategorized" as fallback
                */}
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>
                  → {isGroupLevel
                    ? (matchInfo.displayName ||
                       (transaction.group === 'UNKNOWN' ? 'Petty Cash / Other' :
                        (GROUPS[transaction.group]?.name || transaction.group)))
                    : (matchInfo.displayName || transaction.categoryName || 'Uncategorized')
                  }
                </span>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: matchInfo.color + '20',
                  color: matchInfo.color,
                  fontSize: '11px',
                  fontWeight: 500
                }}>
                  {matchInfo.label}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Action buttons row */}
        {onUpdate && !isEditing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Accept button - accepts the displayed suggestion (AI's or algorithm's) */}
            {!transaction[isGroupLevel ? 'groupReviewed' : 'categoryReviewed'] && (
              <>
                <button
                  onClick={() => {
                    const updates = isGroupLevel
                      ? {
                          group: matchInfo.displayGroup || (transaction.group === 'UNKNOWN' ? 'OTHER' : transaction.group),
                          groupReviewed: true,
                          groupCohort: 'auto',
                          groupMatchType: matchInfo.displayGroup ? 'user_accepted_ai' :
                            (transaction.groupMatchType === 'none' ? 'user_accepted' : transaction.groupMatchType)
                        }
                      : {
                          categoryCode: matchInfo.displayCategory || transaction.categoryCode,
                          categoryName: categoryMapping?.find(c => c.code === (matchInfo.displayCategory || transaction.categoryCode))?.name || matchInfo.displayCategory || transaction.categoryCode,
                          categoryReviewed: true,
                          categoryCohort: 'auto',
                          categoryMatchType: matchInfo.displayCategory ? 'user_accepted_ai' :
                            (transaction.categoryMatchType === 'none' ? 'user_accepted' : transaction.categoryMatchType),
                          category: categoryMapping?.find(c => c.code === (matchInfo.displayCategory || transaction.categoryCode))
                        };
                    onUpdate(transaction.id, updates);
                  }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: 'none',
                    background: '#4caf50',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: 'white',
                    fontWeight: 500
                  }}
                >
                  Accept
                </button>

                {/* Batch apply button - only show if there are similar transactions */}
                {hasSimilar && onUpdateAndSimilar && (
                  <button
                    onClick={() => {
                      const updates = isGroupLevel
                        ? {
                            group: matchInfo.displayGroup || (transaction.group === 'UNKNOWN' ? 'OTHER' : transaction.group),
                            groupReviewed: true,
                            groupCohort: 'auto',
                            groupMatchType: 'batch_applied'
                          }
                        : {
                            categoryCode: matchInfo.displayCategory || transaction.categoryCode,
                            categoryName: categoryMapping?.find(c => c.code === (matchInfo.displayCategory || transaction.categoryCode))?.name || matchInfo.displayCategory || transaction.categoryCode,
                            categoryReviewed: true,
                            categoryCohort: 'auto',
                            categoryMatchType: 'batch_applied',
                            category: categoryMapping?.find(c => c.code === (matchInfo.displayCategory || transaction.categoryCode))
                          };
                      const count = onUpdateAndSimilar(transaction.id, updates, true);
                      console.log(`[BatchApply] Applied to ${count} transactions`);
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      border: '2px solid #7b1fa2',
                      background: '#f3e5f5',
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: '#7b1fa2',
                      fontWeight: 600
                    }}
                    title={`Apply to this and ${similarTransactions.length} similar transactions`}
                  >
                    Accept +{similarTransactions.length} Similar
                  </button>
                )}
              </>
            )}
            {/* Show reviewed checkmark if already accepted */}
            {transaction[isGroupLevel ? 'groupReviewed' : 'categoryReviewed'] && (
              <span style={{
                padding: '4px 8px',
                borderRadius: 4,
                background: '#e8f5e9',
                color: '#2e7d32',
                fontSize: '11px',
                fontWeight: 500
              }}>
                ✓ Accepted
              </span>
            )}
            <button
              onClick={() => {
                // DEBUG: Log state when dropdown opens
                const options = getOptions();
                console.log('[TransactionReviewItem] Change button clicked:', {
                  transactionId: transaction.id,
                  transactionDetails: transaction.details?.substring(0, 40),
                  currentValue: currentValue,
                  currentCategoryCode: transaction.categoryCode,
                  currentCategoryName: transaction.categoryName,
                  aiSuggestionCode: aiSuggestion?.categoryCode,
                  aiSuggestionName: aiSuggestion?.categoryName,
                  matchType: matchType,
                  displayedName: matchInfo.displayName,
                  optionsCount: options.length,
                  optionValues: options.slice(0, 10).map(o => ({ value: o.value, label: o.label }))
                });
                setIsEditing(true);
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid #ccc',
                background: 'white',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#666'
              }}
            >
              Change
            </button>
            <button
              onClick={() => setShowCommentInput(!showCommentInput)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid #ccc',
                background: showCommentInput ? '#e3f2fd' : 'white',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#666'
              }}
            >
              {comment ? '✎ Edit Comment' : '+ Add Comment'}
            </button>
          </div>
        )}

        {/* Comment input */}
        {showCommentInput && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note about this transaction..."
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 4,
                border: '1px solid #ddd',
                fontSize: '12px'
              }}
            />
            <button
              onClick={() => {
                onUpdate(transaction.id, { comment });
                setShowCommentInput(false);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: 'none',
                background: slainteBlue,
                color: 'white',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              Save
            </button>
          </div>
        )}

        {/* Show full reasoning if available - no truncation */}
        {matchInfo.detail && (
          <div style={{
            color: '#555',
            fontSize: '12px',
            lineHeight: 1.5,
            padding: '8px 10px',
            background: '#fafafa',
            borderRadius: 4,
            marginTop: 2
          }}>
            {matchInfo.detail}
          </div>
        )}

        {/* Show calculations toggle - show only if calculation details exist */}
        {transaction.calculationDetails && (
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              marginTop: 4,
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #ddd',
              background: showDebug ? '#e3f2fd' : 'transparent',
              cursor: 'pointer',
              fontSize: '10px',
              color: '#666',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              width: 'fit-content'
            }}
          >
            {showDebug ? '▼' : '▶'} Show calculations
          </button>
        )}
      </div>

      {/* Calculation debug panel */}
      {showDebug && <CalculationDebugPanel transaction={transaction} />}
    </div>
  );
};

// Review panel for a cohort - Updated to reflect two-path architecture
// Now supports batch application to similar transactions
const CohortReviewPanel = ({ cohort, transactions, onAcceptAll, onSkip, isGroupLevel, categoryMapping, onUpdateTransaction, onRecordCorrection, getSimilarTransactions, onUpdateAndSimilar, onChangeWithSimilar, onUndoSimilarChange }) => {
  const [similarNotification, setSimilarNotification] = useState(null);
  const notificationTimeoutRef = useRef(null);

  // Show notification with auto-dismiss after 6 seconds
  const showSimilarNotification = useCallback((message, undoData) => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    setSimilarNotification({ message, undoData });
    notificationTimeoutRef.current = setTimeout(() => setSimilarNotification(null), 6000);
  }, []);

  const handleUndo = useCallback(() => {
    if (similarNotification?.undoData && onUndoSimilarChange) {
      onUndoSimilarChange(similarNotification.undoData);
      setSimilarNotification(null);
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    }
  }, [similarNotification, onUndoSimilarChange]);

  // Labels reflect the actual matching logic:
  // - AUTO: Identifier matched (binary) → high confidence
  // - AI_ASSIST: No identifier match, AI provided suggestion
  // - REVIEW: No identifier match, low probability, user must decide
  const cohortLabels = {
    [COHORTS.REVIEW]: {
      title: 'Needs Review',
      description: 'These transactions could not be matched automatically. Please select the correct group.'
    },
    [COHORTS.AI_ASSIST]: {
      title: 'Needs Review',
      description: 'These transactions matched a likely group based on similar patterns. Please confirm or adjust.'
    },
    [COHORTS.CONFLICT]: {
      title: 'Identifier Conflicts',
      description: 'Multiple identifiers matched different categories - please choose.'
    }
  };

  const info = cohortLabels[cohort] || { title: 'Review', description: '' };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e0e0e0',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '12px 16px',
        background: '#f8f9fa',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#333' }}>
            {info.title} ({transactions.length})
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {info.description}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cohort === COHORTS.AI_ASSIST && onSkip && (
            <button
              onClick={onSkip}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #e0e0e0',
                background: 'white',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#666'
              }}
            >
              Skip Review
            </button>
          )}
          {onAcceptAll && (
            <button
              onClick={onAcceptAll}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: slainteBlue,
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500
              }}
            >
              Accept All
            </button>
          )}
        </div>
      </div>

      <div style={{
        maxHeight: 300,
        overflowY: 'auto',
        padding: 12
      }}>
        {transactions.slice(0, 20).map(tx => {
          // Get similar transactions for this transaction (if function provided)
          const similarTxs = getSimilarTransactions ? getSimilarTransactions(tx.id) : [];
          return (
            <TransactionReviewItem
              key={tx.id}
              transaction={tx}
              isGroupLevel={isGroupLevel}
              categoryMapping={categoryMapping}
              onUpdate={onUpdateTransaction}
              onRecordCorrection={onRecordCorrection}
              similarTransactions={similarTxs}
              onUpdateAndSimilar={onUpdateAndSimilar}
              onChangeWithSimilar={onChangeWithSimilar}
              onSimilarChanged={showSimilarNotification}
            />
          );
        })}
        {transactions.length > 20 && (
          <div style={{
            padding: 12,
            textAlign: 'center',
            color: '#666',
            fontSize: '13px'
          }}>
            + {transactions.length - 20} more transactions
          </div>
        )}
      </div>

      {/* Notification bar for "Change + Similar" with undo */}
      {similarNotification && (
        <div style={{
          padding: '8px 12px',
          background: '#e8f5e9',
          borderTop: '1px solid #c8e6c9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#2e7d32'
        }}>
          <span>{similarNotification.message}</span>
          {similarNotification.undoData && (
            <button
              onClick={handleUndo}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                border: '1px solid #2e7d32',
                background: 'white',
                color: '#2e7d32',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Conflict Resolution Panel - Shows transactions with identifier conflicts
const ConflictResolutionPanel = ({ transactions, onResolve, isGroupLevel, categoryMapping, onRemoveIdentifier }) => {
  // Track removed identifiers: { identifier: Set of removed category codes }
  const [removedIdentifiers, setRemovedIdentifiers] = useState({});
  // Track transactions being auto-resolved (for animation)
  const [resolvingTransactions, setResolvingTransactions] = useState(new Set());

  if (!transactions || transactions.length === 0) return null;

  // Get effective conflicts for a transaction (excluding removed options)
  const getEffectiveConflicts = (tx) => {
    const conflicts = isGroupLevel ? tx.groupConflicts : tx.categoryConflicts;
    const matchedIdentifier = isGroupLevel ? tx.groupMatchedIdentifier : tx.categoryMatchedIdentifier;
    const removedForIdentifier = removedIdentifiers[matchedIdentifier] || new Set();

    if (!conflicts) return [];

    return conflicts.filter(conflict => {
      const categoryCode = isGroupLevel ? conflict.groupCode : conflict.categoryCode;
      return !removedForIdentifier.has(categoryCode);
    });
  };

  // Handle removing an identifier from a specific category
  const handleRemoveIdentifier = (categoryCode, identifier, transactionId) => {
    if (!onRemoveIdentifier) return;

    // 1. Remove from category mapping (persisted change)
    onRemoveIdentifier(categoryCode, identifier);

    // 2. Track locally that this category is removed for this identifier
    setRemovedIdentifiers(prev => {
      const newRemoved = { ...prev };
      if (!newRemoved[identifier]) {
        newRemoved[identifier] = new Set();
      }
      newRemoved[identifier] = new Set([...newRemoved[identifier], categoryCode]);
      return newRemoved;
    });

    // 3. Check if this leaves only ONE option for any transaction with this identifier
    //    If so, auto-resolve those transactions after a brief delay for visual feedback
    setTimeout(() => {
      // Find all transactions with this identifier that now have only 1 option
      const affectedTransactions = transactions.filter(tx => {
        const txIdentifier = isGroupLevel ? tx.groupMatchedIdentifier : tx.categoryMatchedIdentifier;
        if (txIdentifier !== identifier) return false;

        const conflicts = isGroupLevel ? tx.groupConflicts : tx.categoryConflicts;
        if (!conflicts) return false;

        // Get updated removed set (including the one we just added)
        const updatedRemoved = new Set([...(removedIdentifiers[identifier] || []), categoryCode]);
        const remainingConflicts = conflicts.filter(c => {
          const code = isGroupLevel ? c.groupCode : c.categoryCode;
          return !updatedRemoved.has(code);
        });

        return remainingConflicts.length === 1;
      });

      if (affectedTransactions.length > 0) {
        // Mark transactions as resolving (for animation)
        setResolvingTransactions(new Set(affectedTransactions.map(tx => tx.id)));

        // Auto-resolve after animation
        setTimeout(() => {
          affectedTransactions.forEach(tx => {
            const conflicts = isGroupLevel ? tx.groupConflicts : tx.categoryConflicts;
            const updatedRemoved = new Set([...(removedIdentifiers[identifier] || []), categoryCode]);
            const remainingConflict = conflicts.find(c => {
              const code = isGroupLevel ? c.groupCode : c.categoryCode;
              return !updatedRemoved.has(code);
            });

            if (remainingConflict && onResolve) {
              onResolve(tx.id, remainingConflict, isGroupLevel);
            }
          });

          setResolvingTransactions(new Set());
        }, 800);
      }
    }, 100);
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '2px solid #ad1457',
      overflow: 'hidden',
      marginBottom: 16
    }}>
      <div style={{
        padding: '12px 16px',
        background: '#fce4ec',
        borderBottom: '1px solid #f8bbd9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#ad1457', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚠</span> Identifier Conflicts ({transactions.length})
          </div>
          <div style={{ fontSize: '12px', color: '#880e4f' }}>
            These transactions matched multiple categories - choose correct one or remove wrong identifiers
          </div>
        </div>
      </div>

      <div style={{
        maxHeight: 350,
        overflowY: 'auto',
        padding: 12
      }}>
        {transactions.map(tx => {
          const matchedIdentifier = isGroupLevel ? tx.groupMatchedIdentifier : tx.categoryMatchedIdentifier;
          const effectiveConflicts = getEffectiveConflicts(tx);
          const amount = tx.debit || tx.credit || tx.amount;
          const isExpense = tx.type === 'expense';
          const isResolving = resolvingTransactions.has(tx.id);
          const removedForIdentifier = removedIdentifiers[matchedIdentifier] || new Set();

          return (
            <div key={tx.id} style={{
              padding: 12,
              background: isResolving ? '#e8f5e9' : 'white',
              borderRadius: 8,
              border: isResolving ? '2px solid #4caf50' : '1px solid #f8bbd9',
              marginBottom: 8,
              transition: 'all 0.3s ease',
              opacity: isResolving ? 0.8 : 1
            }}>
              {/* Transaction details */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 8
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#333', marginBottom: 4 }}>
                    {tx.details?.substring(0, 60)}{tx.details?.length > 60 && '...'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    Matched identifier: <strong>{matchedIdentifier}</strong>
                  </div>
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: isExpense ? expenseColor : incomeColor
                }}>
                  {isExpense ? '-' : '+'}€{amount?.toLocaleString()}
                </div>
              </div>

              {/* Show resolving message */}
              {isResolving && (
                <div style={{
                  padding: '8px 12px',
                  background: '#c8e6c9',
                  borderRadius: 6,
                  fontSize: '12px',
                  color: '#2e7d32',
                  fontWeight: 500,
                  textAlign: 'center',
                  marginBottom: 8
                }}>
                  ✓ Auto-resolving with remaining option...
                </div>
              )}

              {/* Conflict options */}
              {!isResolving && (
                <>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: 8 }}>
                    {effectiveConflicts.length > 1
                      ? `This identifier appears in ${effectiveConflicts.length} ${isGroupLevel ? 'groups' : 'categories'}. Choose the correct one, or remove wrong identifiers:`
                      : `Only one option remains. Click to confirm:`
                    }
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {effectiveConflicts.map((conflict, i) => {
                      const categoryCode = isGroupLevel ? conflict.groupCode : conflict.categoryCode;
                      const categoryName = isGroupLevel
                        ? (GROUPS[conflict.groupCode]?.name || conflict.groupCode)
                        : (conflict.categoryName || conflict.categoryCode);
                      const isOnlyOption = effectiveConflicts.length === 1;

                      return (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          background: isOnlyOption ? '#e8f5e9' : '#fafafa',
                          borderRadius: 6,
                          border: isOnlyOption ? '2px solid #4caf50' : '1px solid #e0e0e0',
                          transition: 'all 0.3s ease'
                        }}>
                          {/* Choose this category button */}
                          <button
                            onClick={() => onResolve && onResolve(tx.id, conflict, isGroupLevel)}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              borderRadius: 4,
                              border: isOnlyOption ? '1px solid #4caf50' : '1px solid #ad1457',
                              background: isOnlyOption ? '#4caf50' : 'white',
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: isOnlyOption ? 'white' : '#ad1457',
                              fontWeight: 500,
                              textAlign: 'left',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              if (!isOnlyOption) e.target.style.background = '#fce4ec';
                            }}
                            onMouseOut={(e) => {
                              if (!isOnlyOption) e.target.style.background = 'white';
                            }}
                          >
                            {isOnlyOption ? '✓ Confirm: ' : '✓ Choose: '}{categoryName}
                          </button>

                          {/* Remove identifier from this category button - only show if more than 1 option */}
                          {onRemoveIdentifier && !isOnlyOption && (
                            <button
                              onClick={() => handleRemoveIdentifier(categoryCode, matchedIdentifier, tx.id)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 4,
                                border: '1px solid #c62828',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '11px',
                                color: '#c62828',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseOver={(e) => {
                                e.target.style.background = '#ffebee';
                              }}
                              onMouseOut={(e) => {
                                e.target.style.background = 'white';
                              }}
                              title={`Remove "${matchedIdentifier}" from ${categoryName}`}
                            >
                              ✕ Remove ID
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// AI Processing indicator
const AIProcessingIndicator = ({ progress }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    background: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 16
  }}>
    <div style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${slainteBlue} 0%, #357ABD 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: 600,
      fontSize: '14px'
    }}>
      F
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 500, color: '#1565c0', fontSize: '14px' }}>
        Finn is analyzing transactions...
      </div>
      {progress.total > 0 && (
        <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
          Processing {progress.total} transaction{progress.total !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  </div>
);

// Main Processing Flow Panel
const ProcessingFlowPanel = ({ categoryMapping, onComplete, onCancel, onRemoveIdentifier, embedded = false }) => {
  const {
    stage,
    stats,
    processingTransactions,
    getFinnMessage,
    getStageSummary,
    getCohortCounts,
    getTransactionsByCohort,
    nextStage,
    acceptAutoCategorized,
    skipAiAssistReview,
    deferCategoryProcessing,
    completeFlow,
    cancelFlow,
    updateTransaction,
    skipToStage,
    // AI state and actions
    aiProcessing,
    aiProgress,
    aiError,
    runAICategorization,
    // AI Learning
    recordCorrection,
    // Onboarding mode
    skipCategoryStage,
    // Batch similar transactions
    getSimilarTransactions,
    updateTransactionAndSimilar,
    changeWithSimilar,
    undoSimilarChange,
    // Wave info (bulk upload mode)
    waveInfo
  } = useProcessingFlow();

  const summary = getStageSummary();
  const message = getFinnMessage();

  // Current layer based on stage
  const currentLayer = stage.includes('group') ? 'group' : 'category';
  const cohortCounts = getCohortCounts(currentLayer);

  // Get transactions for each cohort
  const reviewTransactions = getTransactionsByCohort(COHORTS.REVIEW, currentLayer);
  const aiAssistTransactions = getTransactionsByCohort(COHORTS.AI_ASSIST, currentLayer);
  const conflictTransactions = getTransactionsByCohort(COHORTS.CONFLICT, currentLayer);

  // Auto-run AI when entering review stage with transactions that need help
  // START EARLY: Begin AI analysis in background during TYPE_REVIEW so it's ready when user moves to GROUP
  const [aiAutoRunTriggered, setAiAutoRunTriggered] = useState({ group: false, category: false });

  useEffect(() => {
    // Calculate needs for GROUP layer (since we want to start early)
    const groupCohortCounts = getCohortCounts('group');
    const groupNeedsAI = (groupCohortCounts.review > 0 || groupCohortCounts.ai_assist > 0);
    const hasGroupAISuggestions = processingTransactions.some(t => t.groupAISuggested);

    // Calculate needs for current layer
    const needsAI = (reviewTransactions.length > 0 || aiAssistTransactions.length > 0);
    const hasAISuggestions = processingTransactions.some(t =>
      currentLayer === 'group' ? t.groupAISuggested : t.categoryAISuggested
    );

    console.log('[ProcessingFlow] AI trigger effect:', {
      stage,
      currentLayer,
      needsAI,
      hasAISuggestions,
      aiProcessing,
      aiAutoRunTriggered,
      reviewTransactionsCount: reviewTransactions.length,
      aiAssistTransactionsCount: aiAssistTransactions.length,
      isTypeReview: stage === STAGES.TYPE_REVIEW,
      isGroupReview: stage === STAGES.GROUP_REVIEW,
      isCategoryReview: stage === STAGES.CATEGORY_REVIEW
    });

    // START AI EARLY: Begin group analysis during TYPE_REVIEW so it runs in background
    // This reduces perceived wait time when user moves to GROUP stage
    const isTypeReviewStage = stage === STAGES.TYPE_REVIEW;
    const isGroupStage = stage === STAGES.GROUP_SORTING || stage === STAGES.GROUP_REVIEW;
    const isCategoryStage = stage === STAGES.CATEGORY_SORTING || stage === STAGES.CATEGORY_REVIEW;

    // Trigger group AI during TYPE_REVIEW (background) or GROUP stages
    if ((isTypeReviewStage || isGroupStage) && groupNeedsAI && !hasGroupAISuggestions && !aiProcessing && !aiAutoRunTriggered.group) {
      console.log('[ProcessingFlow] Triggering AI for group (background start during:', stage, ')');
      setAiAutoRunTriggered(prev => ({ ...prev, group: true }));
      runAICategorization('group');
    } else if (isCategoryStage && needsAI && !hasAISuggestions && !aiProcessing && !aiAutoRunTriggered.category) {
      console.log('[ProcessingFlow] Triggering AI for category stage:', stage);
      setAiAutoRunTriggered(prev => ({ ...prev, category: true }));
      runAICategorization('category');
    }
  }, [stage, reviewTransactions.length, aiAssistTransactions.length, aiProcessing, processingTransactions, runAICategorization, aiAutoRunTriggered, currentLayer, getCohortCounts]);

  // Auto-complete when reaching COMPLETE stage in onboarding mode (skipCategoryStage)
  // This eliminates the need for users to click "Done" after each wave
  useEffect(() => {
    if (stage === STAGES.COMPLETE && skipCategoryStage) {
      console.log('[ProcessingFlow] Auto-completing wave (onboarding mode)');
      // Small delay to let the UI show the completion briefly
      const timer = setTimeout(() => {
        const result = completeFlow();
        onComplete?.(result);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [stage, skipCategoryStage, completeFlow, onComplete]);

  // Handle conflict resolution
  const handleResolveConflict = (transactionId, choice, isGroupLevel) => {
    if (isGroupLevel) {
      updateTransaction(transactionId, {
        group: choice.groupCode,
        groupCohort: 'auto',
        groupReviewed: true,
        groupMatchType: 'user_resolved_conflict'
      });
    } else {
      const selectedCat = categoryMapping?.find(c => c.code === choice.categoryCode);
      updateTransaction(transactionId, {
        categoryCode: choice.categoryCode,
        categoryName: choice.categoryName,
        categoryCohort: 'auto',
        categoryReviewed: true,
        categoryMatchType: 'user_resolved_conflict',
        category: selectedCat
      });
    }
  };

  // Handle close button - properly cancel the flow
  const handleClose = () => {
    cancelFlow();
    onCancel?.();
  };

  // Handle back button navigation
  const handleBack = () => {
    const stageOrder = [
      STAGES.IDLE,
      STAGES.TYPE_SORTING,
      STAGES.TYPE_REVIEW,
      STAGES.GROUP_SORTING,
      STAGES.GROUP_REVIEW,
      STAGES.CATEGORY_SORTING,
      STAGES.CATEGORY_REVIEW,
      STAGES.COMPLETE
    ];

    const currentIndex = stageOrder.indexOf(stage);
    if (currentIndex > 1) { // Don't go back before TYPE_REVIEW
      // Skip sorting stages when going back
      let targetIndex = currentIndex - 1;
      while (targetIndex > 0 && stageOrder[targetIndex].includes('sorting')) {
        targetIndex--;
      }
      // Note: We'd need to add a setStage method to context, for now just show alert
    }
  };

  // Estimate time for review
  const estimatedTime = useMemo(() => {
    const count = reviewTransactions.length + aiAssistTransactions.length;
    if (count === 0) return null;
    const minutes = Math.ceil(count / 5); // ~5 transactions per minute
    return minutes;
  }, [reviewTransactions.length, aiAssistTransactions.length]);

  const handleAcceptAuto = () => {
    acceptAutoCategorized(currentLayer);
  };

  // Accept all AI suggestions - applies the AI's suggested group/category to each transaction
  const handleAcceptAllAISuggestions = () => {
    const isGroupLevel = currentLayer === 'group';
    aiAssistTransactions.forEach(tx => {
      const aiSuggestion = isGroupLevel ? tx.aiGroupSuggestion : tx.aiCategorySuggestion;
      if (isGroupLevel) {
        // Use AI's suggested group, or OTHER if UNKNOWN
        const acceptGroup = aiSuggestion?.group || (tx.group === 'UNKNOWN' ? 'OTHER' : tx.group);
        updateTransaction(tx.id, {
          group: acceptGroup,
          groupReviewed: true,
          groupMatchType: aiSuggestion?.group ? 'user_accepted_ai' : 'user_accepted'
        });
      } else {
        // Use AI's suggested category
        const acceptCategory = aiSuggestion?.categoryCode || tx.categoryCode;
        const selectedCat = categoryMapping?.find(c => c.code === acceptCategory);
        updateTransaction(tx.id, {
          categoryCode: acceptCategory,
          categoryName: selectedCat?.name || acceptCategory,
          categoryReviewed: true,
          categoryMatchType: aiSuggestion?.categoryCode ? 'user_accepted_ai' : 'user_accepted',
          category: selectedCat
        });
      }
    });
  };

  // Accept all REVIEW transactions - defaults UNKNOWN to OTHER
  const handleAcceptAllReview = () => {
    const isGroupLevel = currentLayer === 'group';
    reviewTransactions.forEach(tx => {
      if (isGroupLevel) {
        // Default UNKNOWN to OTHER
        const acceptGroup = tx.group === 'UNKNOWN' ? 'OTHER' : tx.group;
        updateTransaction(tx.id, {
          group: acceptGroup,
          groupReviewed: true,
          groupMatchType: 'user_accepted'
        });
      } else {
        updateTransaction(tx.id, {
          categoryReviewed: true,
          categoryMatchType: 'user_accepted'
        });
      }
    });
  };

  const handleSkipAiAssist = () => {
    skipAiAssistReview(currentLayer);
  };

  const handleContinue = () => {
    nextStage();
  };

  const handleDefer = () => {
    const taskInfo = deferCategoryProcessing();
    // TODO: Create task in TasksWidget
    console.log('[ProcessingFlow] Deferred category processing:', taskInfo);
  };

  const handleComplete = () => {
    const result = completeFlow();
    onComplete?.(result);
  };

  // Render based on stage
  const renderStageContent = () => {
    switch (stage) {
      case STAGES.TYPE_SORTING:
        return (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: slainteBlue,
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: 24,
                height: 24,
                border: '3px solid white',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
            <div style={{ fontSize: '16px', color: '#333' }}>
              Processing transactions...
            </div>
          </div>
        );

      case STAGES.TYPE_REVIEW:
        return (
          <>
            <StatsSummary stats={summary} />

            {/* Show success message if no anomalies */}
            {(!summary?.typeAnomalies || summary.typeAnomalies === 0) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                background: '#e8f5e9',
                borderRadius: 8,
                marginBottom: 16
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: incomeColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 600
                }}>
                  ✓
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: '#2e7d32' }}>
                    Type sorting complete
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    All {summary?.total || 0} transactions classified as income or expense
                  </div>
                </div>
              </div>
            )}

            {/* Show anomalies panel if there are any */}
            {summary?.typeAnomalies > 0 && (
              <CohortReviewPanel
                cohort={COHORTS.REVIEW}
                transactions={processingTransactions.filter(t => t.typeAnomaly)}
                isGroupLevel={false}
                categoryMapping={categoryMapping}
              />
            )}

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button
                onClick={handleContinue}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: slainteBlue,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Continue to Groups →
              </button>
            </div>
          </>
        );

      case STAGES.GROUP_SORTING:
      case STAGES.GROUP_AI_PROCESSING:
      case STAGES.GROUP_REVIEW:
        const hasGroupAISuggestions = processingTransactions.some(t => t.groupAISuggested);
        const needsGroupAI = (reviewTransactions.length > 0 || aiAssistTransactions.length > 0) && !hasGroupAISuggestions;
        const aiInProgress = aiProcessing || needsGroupAI;
        const hasUnresolvedConflicts = conflictTransactions.length > 0;

        return (
          <>
            <StatsSummary stats={summary} />
            <CohortDistribution counts={cohortCounts} layer="group" />

            {/* Debug panel for auto-matched transactions */}
            <AutoMatchedDebugPanel transactions={processingTransactions} isGroupLevel={true} />

            {/* Show AI processing indicator */}
            {aiProcessing && <AIProcessingIndicator progress={aiProgress} />}

            {/* Step 1: Conflicts must be resolved FIRST */}
            {hasUnresolvedConflicts && (
              <>
                <div style={{
                  padding: 12,
                  background: '#fff3e0',
                  borderRadius: 8,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <span style={{ fontSize: '16px' }}>⚠️</span>
                  <div style={{ fontSize: '13px', color: '#e65100' }}>
                    <strong>Step 1:</strong> Please resolve these identifier conflicts before reviewing other transactions.
                  </div>
                </div>
                <ConflictResolutionPanel
                  transactions={conflictTransactions}
                  onResolve={handleResolveConflict}
                  isGroupLevel={true}
                  categoryMapping={categoryMapping}
                  onRemoveIdentifier={onRemoveIdentifier}
                />
              </>
            )}

            {/* Step 2: Wait for AI to complete before showing review panels */}
            {!hasUnresolvedConflicts && aiInProgress && !aiProcessing && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                background: '#e3f2fd',
                borderRadius: 8,
                marginBottom: 16
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#1565c0', marginBottom: 4 }}>
                    AI Analysis Required
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {reviewTransactions.length + aiAssistTransactions.length} transactions need AI analysis
                  </div>
                </div>
                <button
                  onClick={() => runAICategorization('group')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: slainteBlue,
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  Run Analysis
                </button>
              </div>
            )}

            {/* Step 2: Show review panels SEQUENTIALLY after conflicts resolved and AI complete */}
            {/* Order: Conflicts (Step 1) → Needs Review (Step 2: AI suggestions first, then manual) */}
            {!hasUnresolvedConflicts && !aiInProgress && (
              <>
                {/* Step 2: Needs Review - AI suggestions shown first */}
                {aiAssistTransactions.length > 0 && (
                  <>
                    <div style={{
                      padding: 10,
                      background: '#fff3e0',
                      borderRadius: 8,
                      marginBottom: 12,
                      fontSize: '13px',
                      color: '#ef6c00'
                    }}>
                      <strong>Step 2 of 2:</strong> Review these transactions. Some have suggestions — accept or change them.
                    </div>
                    <CohortReviewPanel
                      cohort={COHORTS.AI_ASSIST}
                      transactions={aiAssistTransactions}
                      onAcceptAll={handleAcceptAllAISuggestions}
                      onSkip={handleSkipAiAssist}
                      isGroupLevel={true}
                      categoryMapping={categoryMapping}
                      onUpdateTransaction={updateTransaction}
                      onRecordCorrection={recordCorrection}
                      getSimilarTransactions={getSimilarTransactions}
                      onUpdateAndSimilar={updateTransactionAndSimilar}
                      onChangeWithSimilar={changeWithSimilar}
                      onUndoSimilarChange={undoSimilarChange}
                    />
                  </>
                )}

                {/* Step 2 continued: Manual review - shown after AI suggestions resolved */}
                {aiAssistTransactions.length === 0 && reviewTransactions.length > 0 && (
                  <>
                    <div style={{
                      padding: 10,
                      background: '#fff3e0',
                      borderRadius: 8,
                      marginBottom: 12,
                      fontSize: '13px',
                      color: '#ef6c00'
                    }}>
                      <strong>Step 2 of 2:</strong> These transactions need manual review. Please select the correct group for each.
                    </div>
                    <CohortReviewPanel
                      cohort={COHORTS.REVIEW}
                      transactions={reviewTransactions}
                      onAcceptAll={handleAcceptAllReview}
                      isGroupLevel={true}
                      categoryMapping={categoryMapping}
                      onUpdateTransaction={updateTransaction}
                      onRecordCorrection={recordCorrection}
                      getSimilarTransactions={getSimilarTransactions}
                      onUpdateAndSimilar={updateTransactionAndSimilar}
                      onChangeWithSimilar={changeWithSimilar}
                      onUndoSimilarChange={undoSimilarChange}
                    />
                  </>
                )}

                {/* Show success if all reviewed */}
                {reviewTransactions.length === 0 && aiAssistTransactions.length === 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    background: '#e8f5e9',
                    borderRadius: 8,
                    marginBottom: 16
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: incomeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 600
                    }}>
                      ✓
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: '#2e7d32' }}>
                        Group sorting complete
                      </div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        All transactions have been assigned to groups
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{
              marginTop: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {estimatedTime && (
                <div style={{ fontSize: '13px', color: '#666' }}>
                  Estimated: ~{estimatedTime} min to review
                </div>
              )}
              <button
                onClick={handleContinue}
                disabled={aiProcessing || conflictTransactions.length > 0}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: (aiProcessing || conflictTransactions.length > 0) ? '#ccc' : slainteBlue,
                  color: 'white',
                  cursor: (aiProcessing || conflictTransactions.length > 0) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                title={conflictTransactions.length > 0 ? 'Resolve conflicts first' : (aiProcessing ? 'AI analysis in progress...' : '')}
              >
                {aiProcessing && (
                  <span style={{
                    width: 14,
                    height: 14,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
                {aiProcessing ? 'AI Analyzing...' : (skipCategoryStage ? 'Complete Wave' : 'Continue to Categories')}
              </button>
            </div>
          </>
        );

      case STAGES.CATEGORY_SORTING:
        return (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <CohortDistribution counts={getCohortCounts('category')} layer="category" />
            </div>
            {estimatedTime && (
              <div style={{ fontSize: '14px', color: '#666', marginBottom: 20 }}>
                About {reviewTransactions.length + aiAssistTransactions.length} transactions to review (~{estimatedTime} min)
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={handleDefer}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: '1px solid #e0e0e0',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#666'
                }}
              >
                Do This Later
              </button>
              <button
                onClick={handleContinue}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: slainteBlue,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Continue
              </button>
            </div>
          </div>
        );

      case STAGES.CATEGORY_AI_PROCESSING:
      case STAGES.CATEGORY_REVIEW:
        const catReviewTx = getTransactionsByCohort(COHORTS.REVIEW, 'category');
        const catAITx = getTransactionsByCohort(COHORTS.AI_ASSIST, 'category');
        const catConflictTx = getTransactionsByCohort(COHORTS.CONFLICT, 'category');
        const hasCategoryAISuggestions = processingTransactions.some(t => t.categoryAISuggested);
        const needsCategoryAI = (catReviewTx.length > 0 || catAITx.length > 0) && !hasCategoryAISuggestions;
        const hasCategoryUnresolvedConflicts = catConflictTx.length > 0;
        const catAiInProgress = aiProcessing || needsCategoryAI;

        return (
          <>
            <CohortDistribution counts={getCohortCounts('category')} layer="category" />

            {/* Debug panel for auto-matched transactions */}
            <AutoMatchedDebugPanel transactions={processingTransactions} isGroupLevel={false} />

            {/* Show AI processing indicator */}
            {aiProcessing && <AIProcessingIndicator progress={aiProgress} />}

            {/* Step 1: Conflicts must be resolved FIRST */}
            {hasCategoryUnresolvedConflicts && (
              <>
                <div style={{
                  padding: 12,
                  background: '#fff3e0',
                  borderRadius: 8,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <span style={{ fontSize: '16px' }}>⚠️</span>
                  <div style={{ fontSize: '13px', color: '#e65100' }}>
                    <strong>Step 1:</strong> Please resolve these identifier conflicts before reviewing other transactions.
                  </div>
                </div>
                <ConflictResolutionPanel
                  transactions={catConflictTx}
                  onResolve={handleResolveConflict}
                  isGroupLevel={false}
                  categoryMapping={categoryMapping}
                  onRemoveIdentifier={onRemoveIdentifier}
                />
              </>
            )}

            {/* Step 2: Wait for AI to complete before showing review panels */}
            {!hasCategoryUnresolvedConflicts && catAiInProgress && !aiProcessing && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                background: '#e3f2fd',
                borderRadius: 8,
                marginBottom: 16
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#1565c0', marginBottom: 4 }}>
                    AI Analysis Required
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {catReviewTx.length + catAITx.length} category assignments need AI analysis
                  </div>
                </div>
                <button
                  onClick={() => runAICategorization('category')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: slainteBlue,
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  Run Analysis
                </button>
              </div>
            )}

            {/* Step 2: Show review panels SEQUENTIALLY after conflicts resolved and AI complete */}
            {/* Order: Conflicts (Step 1) → Needs Review (Step 2: AI suggestions first, then manual) */}
            {!hasCategoryUnresolvedConflicts && !catAiInProgress && (
              <>
                {/* Step 2: Needs Review - AI suggestions shown first */}
                {catAITx.length > 0 && (
                  <>
                    <div style={{
                      padding: 10,
                      background: '#fff3e0',
                      borderRadius: 8,
                      marginBottom: 12,
                      fontSize: '13px',
                      color: '#ef6c00'
                    }}>
                      <strong>Step 2 of 2:</strong> Review these category suggestions. Accept or change each one.
                    </div>
                    <CohortReviewPanel
                      cohort={COHORTS.AI_ASSIST}
                      transactions={catAITx}
                      onAcceptAll={handleAcceptAllAISuggestions}
                      onSkip={handleSkipAiAssist}
                      isGroupLevel={false}
                      categoryMapping={categoryMapping}
                      onUpdateTransaction={updateTransaction}
                      onRecordCorrection={recordCorrection}
                      getSimilarTransactions={getSimilarTransactions}
                      onUpdateAndSimilar={updateTransactionAndSimilar}
                      onChangeWithSimilar={changeWithSimilar}
                      onUndoSimilarChange={undoSimilarChange}
                    />
                  </>
                )}

                {/* Step 2 continued: Manual review - shown after AI suggestions resolved */}
                {catAITx.length === 0 && catReviewTx.length > 0 && (
                  <>
                    <div style={{
                      padding: 10,
                      background: '#fff3e0',
                      borderRadius: 8,
                      marginBottom: 12,
                      fontSize: '13px',
                      color: '#ef6c00'
                    }}>
                      <strong>Step 2 of 2:</strong> These transactions need manual review. Please select the correct category for each.
                    </div>
                    <CohortReviewPanel
                      cohort={COHORTS.REVIEW}
                      transactions={catReviewTx}
                      onAcceptAll={handleAcceptAllReview}
                      isGroupLevel={false}
                      categoryMapping={categoryMapping}
                      onUpdateTransaction={updateTransaction}
                      onRecordCorrection={recordCorrection}
                      getSimilarTransactions={getSimilarTransactions}
                      onUpdateAndSimilar={updateTransactionAndSimilar}
                      onChangeWithSimilar={changeWithSimilar}
                      onUndoSimilarChange={undoSimilarChange}
                    />
                  </>
                )}

                {/* Show success if all reviewed */}
                {catReviewTx.length === 0 && catAITx.length === 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    background: '#e8f5e9',
                    borderRadius: 8,
                    marginBottom: 16
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: incomeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 600
                    }}>
                      ✓
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: '#2e7d32' }}>
                        Category sorting complete
                      </div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        All transactions have been assigned to categories
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button
                onClick={handleComplete}
                disabled={aiProcessing || catConflictTx.length > 0}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: (aiProcessing || catConflictTx.length > 0) ? '#ccc' : incomeColor,
                  color: 'white',
                  cursor: (aiProcessing || catConflictTx.length > 0) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
                title={catConflictTx.length > 0 ? 'Resolve conflicts first' : ''}
              >
                Complete
              </button>
            </div>
          </>
        );

      case STAGES.COMPLETE:
        return (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: incomeColor,
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              color: 'white'
            }}>
              ✓
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#333', marginBottom: 8 }}>
              Processing Complete
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: 24 }}>
              {processingTransactions.length} transactions categorized
            </div>
            <button
              onClick={handleComplete}
              style={{
                padding: '12px 32px',
                borderRadius: 8,
                border: 'none',
                background: slainteBlue,
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Done
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // Embedded mode: render inline (for onboarding side-by-side layout)
  // Modal mode: render as fixed overlay (default, for Settings uploads)
  const outerStyle = embedded
    ? { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }
    : {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      };

  const innerStyle = embedded
    ? {
        width: '100%',
        height: '100%',
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }
    : {
        width: '90%',
        maxWidth: 700,
        height: '85vh',
        maxHeight: '90vh',
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      };

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Back button - show if not on first real stage */}
            {stage !== STAGES.TYPE_SORTING && stage !== STAGES.TYPE_REVIEW && stage !== STAGES.IDLE && (
              <button
                onClick={() => {
                  // Navigate back to previous review stage
                  if (stage.includes('category')) {
                    // Go back to GROUP_REVIEW
                    skipToStage(STAGES.GROUP_REVIEW);
                  } else if (stage.includes('group')) {
                    // Go back to TYPE_REVIEW
                    skipToStage(STAGES.TYPE_REVIEW);
                  }
                }}
                disabled={aiProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #e0e0e0',
                  background: aiProcessing ? '#f5f5f5' : 'white',
                  cursor: aiProcessing ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  color: aiProcessing ? '#999' : '#666'
                }}
                title="Go back"
              >
                ← Back
              </button>
            )}
            <div style={{ fontWeight: 600, fontSize: '16px', color: '#333' }}>
              Transaction Processing
              {waveInfo && (
                <span style={{ fontSize: '13px', color: '#666', fontWeight: 400, marginLeft: 8 }}>
                  — Wave {waveInfo.current} of {waveInfo.total}
                </span>
              )}
            </div>
          </div>
          {!embedded && (
            <button
              onClick={handleClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: '#f5f5f5',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close"
            >
              ×
            </button>
          )}
        </div>

        {/* Stage indicator */}
        <StageIndicator currentStage={stage} />

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20
        }}>
          {/* Stage content - clean professional layout without conversational elements */}
          {renderStageContent()}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export { ProcessingFlowProvider, useProcessingFlow, STAGES, COHORTS };
export default ProcessingFlowPanel;
