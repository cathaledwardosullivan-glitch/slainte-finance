import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, Clock, Loader2, ChevronDown, ChevronRight, FileText, ArrowRight } from 'lucide-react';
import COLORS from '../../utils/colors';

/**
 * StagedReviewPanel — Floating side panel that appears next to Finn during
 * conversational review of staged transactions. Shows clusters visually
 * and updates in real-time as Finn applies categories.
 *
 * Driven entirely by CustomEvents dispatched from FinnContext's staged:review handler.
 * No props needed — manages its own state.
 */
const StagedReviewPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [stagedData, setStagedData] = useState(null);
  const [appliedClusters, setAppliedClusters] = useState({}); // { clusterIndex: categoryName }
  const [autoApplied, setAutoApplied] = useState(0);
  const [rescoring, setRescoring] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState(null);
  const [totalApplied, setTotalApplied] = useState(0);

  // Event listeners
  useEffect(() => {
    const handleOpen = (e) => {
      const { stagedData: data } = e.detail;
      setStagedData(data);
      setAppliedClusters({});
      setAutoApplied(0);
      setTotalApplied(0);
      setRescoring(false);
      setExpandedCluster(null);
      setIsOpen(true);
    };

    const handleApplied = (e) => {
      const { appliedCount, clusterIndex, categoryName, isAuto } = e.detail;
      if (isAuto) {
        setAutoApplied(appliedCount);
        setTotalApplied(prev => prev + appliedCount);
      } else if (clusterIndex !== undefined) {
        setAppliedClusters(prev => ({ ...prev, [clusterIndex]: categoryName || 'Categorised' }));
        setTotalApplied(prev => prev + (appliedCount || 0));
      }
    };

    const handleRescoreStart = () => setRescoring(true);

    const handleRescoreDone = (e) => {
      const { promoted, updatedClusters } = e.detail;
      setRescoring(false);
      if (promoted > 0) {
        setTotalApplied(prev => prev + promoted);
      }
      // Update clusters with rescored data
      if (updatedClusters) {
        setStagedData(prev => prev ? { ...prev, reviewClusters: updatedClusters } : prev);
        // Reset applied clusters since indices changed after rescore
        setAppliedClusters({});
      }
    };

    const handleClose = () => {
      setIsOpen(false);
    };

    window.addEventListener('staged-review:open', handleOpen);
    window.addEventListener('staged-review:applied', handleApplied);
    window.addEventListener('staged-review:rescore-start', handleRescoreStart);
    window.addEventListener('staged-review:rescore-done', handleRescoreDone);
    window.addEventListener('staged-review:close', handleClose);

    return () => {
      window.removeEventListener('staged-review:open', handleOpen);
      window.removeEventListener('staged-review:applied', handleApplied);
      window.removeEventListener('staged-review:rescore-start', handleRescoreStart);
      window.removeEventListener('staged-review:rescore-done', handleRescoreDone);
      window.removeEventListener('staged-review:close', handleClose);
    };
  }, []);

  if (!isOpen || !stagedData) return null;

  const totalTransactions = stagedData.summary?.totalTransactions || 0;
  const reviewClusters = stagedData.reviewClusters || [];
  const multiClusters = reviewClusters.filter(c => c.memberCount > 1);
  const singletons = reviewClusters.filter(c => c.memberCount === 1);
  const progressPercent = totalTransactions > 0 ? Math.round((totalApplied / totalTransactions) * 100) : 0;

  // Determine which cluster is "active" — first non-applied multi-member cluster
  const activeClusterIndex = multiClusters.findIndex((_, i) => !appliedClusters[i]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '5rem',
        left: 'calc(1.5rem + min(400px, calc(100vw - 3rem)) + 0.75rem)',
        bottom: '5.5rem',
        zIndex: 50,
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${COLORS.borderLight}`,
        width: '380px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideInFromLeft 0.25s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={16} />
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
            Transaction Review
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none', border: 'none', color: COLORS.white,
            cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem',
            display: 'flex', alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Source file + progress */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${COLORS.borderLight}`, flexShrink: 0 }}>
        <div style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '0.375rem' }}>
          {stagedData.sourceFile}
        </div>

        {/* Progress bar */}
        <div style={{
          height: '6px', borderRadius: '3px', backgroundColor: `${COLORS.borderLight}`,
          overflow: 'hidden', marginBottom: '0.375rem',
        }}>
          <div style={{
            height: '100%', borderRadius: '3px',
            backgroundColor: progressPercent === 100 ? COLORS.incomeColor : COLORS.slainteBlue,
            width: `${progressPercent}%`,
            transition: 'width 0.5s ease-out, background-color 0.3s',
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: COLORS.textSecondary }}>
          <span>{totalApplied} of {totalTransactions} applied</span>
          <span style={{ fontWeight: 600, color: progressPercent === 100 ? COLORS.incomeColor : COLORS.slainteBlue }}>
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{
        padding: '0.5rem 1rem', borderBottom: `1px solid ${COLORS.borderLight}`,
        display: 'flex', gap: '0.75rem', fontSize: '0.7rem', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {autoApplied > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: COLORS.incomeColor }}>
            <CheckCircle size={12} /> {autoApplied} auto-applied
          </span>
        )}
        {multiClusters.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: COLORS.textSecondary }}>
            <ArrowRight size={12} /> {Object.keys(appliedClusters).length}/{multiClusters.length} clusters done
          </span>
        )}
        {rescoring && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: COLORS.slainteBlue }}>
            <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Re-scoring...
          </span>
        )}
      </div>

      {/* Scrollable cluster list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {/* Multi-member clusters */}
        {multiClusters.map((cluster, i) => {
          const isApplied = appliedClusters[i] !== undefined;
          const isActive = i === activeClusterIndex && !isApplied;
          const isExpanded = expandedCluster === i;

          return (
            <ClusterCard
              key={`cluster-${i}`}
              cluster={cluster}
              index={i}
              isApplied={isApplied}
              isActive={isActive}
              appliedCategory={appliedClusters[i]}
              isExpanded={isExpanded}
              onToggleExpand={() => setExpandedCluster(isExpanded ? null : i)}
              stagedData={stagedData}
            />
          );
        })}

        {/* Singletons */}
        {singletons.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{
              fontSize: '0.7rem', fontWeight: 600, color: COLORS.textSecondary,
              padding: '0.25rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              One-off transactions ({singletons.length})
            </div>
            {singletons.map((cluster, i) => {
              const globalIndex = multiClusters.length + i;
              const isApplied = appliedClusters[globalIndex] !== undefined;

              return (
                <div
                  key={`singleton-${i}`}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    marginBottom: '0.25rem',
                    fontSize: '0.75rem',
                    backgroundColor: isApplied ? `${COLORS.incomeColor}08` : COLORS.bgPage,
                    border: `1px solid ${isApplied ? `${COLORS.incomeColor}30` : COLORS.borderLight}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, marginRight: '0.5rem', color: COLORS.textPrimary,
                  }}>
                    {cluster.representativeDescription}
                  </span>
                  <span style={{
                    fontWeight: 600, whiteSpace: 'nowrap',
                    color: cluster.totalAmount >= 0 ? COLORS.incomeColor : COLORS.expenseColor,
                    fontSize: '0.7rem',
                  }}>
                    {cluster.totalAmount >= 0 ? '+' : '-'}€{Math.abs(cluster.totalAmount).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideInFromLeft {
          from { opacity: 0; transform: translateX(-1rem); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

/**
 * ClusterCard — A single review cluster with expandable member list
 */
const ClusterCard = ({ cluster, index, isApplied, isActive, appliedCategory, isExpanded, onToggleExpand, stagedData }) => {
  const bgColor = isApplied
    ? `${COLORS.incomeColor}08`
    : isActive
      ? `${COLORS.slainteBlue}06`
      : COLORS.bgPage;

  const borderColor = isApplied
    ? `${COLORS.incomeColor}40`
    : isActive
      ? COLORS.slainteBlue
      : COLORS.borderLight;

  // Find member transactions for expanded view
  const memberTransactions = isExpanded ? findClusterMembers(cluster, stagedData) : [];

  return (
    <div
      style={{
        marginBottom: '0.375rem',
        borderRadius: '0.5rem',
        border: `1px solid ${borderColor}`,
        borderLeft: isActive ? `3px solid ${COLORS.slainteBlue}` : `1px solid ${borderColor}`,
        backgroundColor: bgColor,
        transition: 'all 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* Cluster header */}
      <div
        onClick={onToggleExpand}
        style={{
          padding: '0.625rem 0.75rem',
          cursor: 'pointer',
          display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        }}
      >
        {/* Status icon */}
        <div style={{ flexShrink: 0, marginTop: '0.125rem' }}>
          {isApplied ? (
            <CheckCircle size={14} color={COLORS.incomeColor} />
          ) : isActive ? (
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: `2px solid ${COLORS.slainteBlue}`,
              animation: 'pulse 2s ease-in-out infinite',
            }} />
          ) : (
            <Clock size={14} color={COLORS.textSecondary} />
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.8rem', fontWeight: 600, color: COLORS.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {cluster.representativeDescription}
          </div>
          <div style={{
            fontSize: '0.7rem', color: COLORS.textSecondary,
            display: 'flex', gap: '0.75rem', marginTop: '0.125rem',
          }}>
            <span>{cluster.memberCount} transactions</span>
            <span style={{
              fontWeight: 600,
              color: cluster.totalAmount >= 0 ? COLORS.incomeColor : COLORS.expenseColor,
            }}>
              {cluster.totalAmount >= 0 ? '+' : '-'}€{Math.abs(cluster.totalAmount).toLocaleString()}
            </span>
          </div>
          {isApplied && (
            <div style={{
              fontSize: '0.7rem', color: COLORS.incomeColor, fontWeight: 500, marginTop: '0.125rem',
            }}>
              → {appliedCategory}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <div style={{ flexShrink: 0, color: COLORS.textSecondary }}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {/* Expanded member list */}
      {isExpanded && memberTransactions.length > 0 && (
        <div style={{
          borderTop: `1px solid ${COLORS.borderLight}`,
          padding: '0.375rem 0.5rem',
          maxHeight: '12rem',
          overflowY: 'auto',
        }}>
          {memberTransactions.slice(0, 20).map((txn, j) => (
            <div
              key={txn.id || j}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.25rem 0.375rem', fontSize: '0.7rem',
                borderRadius: '0.25rem',
                backgroundColor: j % 2 === 0 ? 'transparent' : `${COLORS.bgPage}`,
              }}
            >
              <span style={{ color: COLORS.textSecondary, marginRight: '0.5rem', flexShrink: 0 }}>
                {txn.date ? new Date(txn.date).toLocaleDateString('en-IE', { day: '2-digit', month: 'short' }) : ''}
              </span>
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: COLORS.textPrimary, marginRight: '0.5rem',
              }}>
                {txn.details}
              </span>
              <span style={{
                fontWeight: 600, whiteSpace: 'nowrap',
                color: (txn.credit || txn.isIncome) ? COLORS.incomeColor : COLORS.expenseColor,
              }}>
                {(txn.credit || txn.isIncome) ? '+' : '-'}€{Math.abs(txn.amount || txn.debit || txn.credit || 0).toLocaleString()}
              </span>
            </div>
          ))}
          {memberTransactions.length > 20 && (
            <div style={{ fontSize: '0.65rem', color: COLORS.textSecondary, padding: '0.25rem 0.375rem', textAlign: 'center' }}>
              ... and {memberTransactions.length - 20} more
            </div>
          )}
        </div>
      )}

      {/* Pulse animation for active cluster */}
      {isActive && (
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      )}
    </div>
  );
};

/**
 * Find transactions belonging to a cluster by matching the representative description.
 * Same matching logic as the apply-cluster handler in FinnContext.
 */
function findClusterMembers(cluster, stagedData) {
  if (!stagedData?.transactions) return [];

  const repDesc = (cluster.representativeDescription || '').toLowerCase();
  const repClean = repDesc.replace(/[0-9]/g, '').trim().substring(0, 8);

  return stagedData.transactions.filter(t => {
    if (t.id === cluster.representativeId) return true;
    if (t.stagedCohort !== 'review') return false;
    const txnClean = (t.details || '').toLowerCase().replace(/[0-9]/g, '').trim().substring(0, 8);
    return repClean.length >= 4 && repClean === txnClean;
  });
}

export default StagedReviewPanel;
