import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, CheckCircle, Clock, Loader2, ChevronDown, ChevronRight, FileText, ArrowRight, Check, Pencil, Search, CheckCheck } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { GROUPS, SECTION_TO_GROUP } from '../../utils/categorizationEngine';
import COLORS from '../../utils/colors';

/**
 * StagedReviewPanel — Floating side panel next to Finn during conversational
 * review of staged transactions. Supports two modes:
 *
 * Two-pass architecture:
 *   Pass 1 (group mode):    Confirm groups → dashboard ready
 *   Pass 2 (category mode): Assign categories within groups → P&L ready
 */

// Build ordered list of groups for the picker
const GROUP_LIST = Object.entries(GROUPS)
  .filter(([key]) => key !== 'UNKNOWN') // Don't show UNKNOWN as an option
  .sort((a, b) => a[1].displayOrder - b[1].displayOrder)
  .map(([key, g]) => ({ code: key, name: g.name, type: g.type }));

const StagedReviewPanel = () => {
  const { transactions, setTransactions, categoryMapping, setCategoryMapping } = useAppContext();

  const [isOpen, setIsOpen] = useState(false);
  const [stagedData, setStagedData] = useState(null);
  const [stagedId, setStagedId] = useState(null);
  const [appliedClusters, setAppliedClusters] = useState({}); // { clusterIndex: groupName/categoryName }
  const [autoApplied, setAutoApplied] = useState(0);
  const [rescoring, setRescoring] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState(null);
  const [totalApplied, setTotalApplied] = useState(0);
  const [changingCluster, setChangingCluster] = useState(null); // index of cluster showing picker
  const [searchText, setSearchText] = useState('');
  const [applying, setApplying] = useState(null); // index of cluster currently being applied
  const searchInputRef = useRef(null);

  // Pass 2: Review mode — 'group' for Pass 1, 'category' for Pass 2
  const [reviewMode, setReviewMode] = useState('group'); // 'group' | 'category'

  // Build category list indexed by group for the Pass 2 picker
  const categoriesByGroup = useMemo(() => {
    const map = {};
    for (const cat of categoryMapping) {
      const group = SECTION_TO_GROUP[cat.section];
      if (!group) continue;
      if (!map[group]) map[group] = [];
      if (!map[group].find(c => c.code === cat.code)) {
        map[group].push({ code: cat.code, name: cat.name, section: cat.section, type: cat.type });
      }
    }
    return map;
  }, [categoryMapping]);

  // Apply a single cluster with the given GROUP (Pass 1) or CATEGORY (Pass 2)
  const applyCluster = useCallback(async (clusterIndex, target, cluster) => {
    if (!stagedData || !window.electronAPI?.backgroundProcessor) return;

    setApplying(clusterIndex);
    try {
      const members = findClusterMembers(cluster, stagedData, reviewMode);
      if (members.length === 0) return;

      let overridden;
      let appliedLabel;

      if (reviewMode === 'category') {
        // Pass 2: Assign CATEGORY (target is { code, name, section })
        overridden = members.map(t => ({
          ...t,
          categoryCode: target.code,
          categoryName: target.name,
          categorySection: target.section,
          categoryReviewed: true,
          categoryCohort: 'auto',
          categoryMatchType: 'user-review',
        }));
        appliedLabel = target.name;

        // Update transactions already in React state (Pass 2 operates on applied transactions)
        setTransactions(prev => prev.map(t => {
          const match = overridden.find(o => o.id === t.id);
          return match || t;
        }));
      } else {
        // Pass 1: Assign GROUP (target is { code, name, type })
        overridden = members.map(t => ({
          ...t,
          suggestedGroup: target.code,
          groupConfirmed: true,
          categoryMatchType: 'finn-background',
          stagedCohort: 'group-confirmed',
        }));
        appliedLabel = target.name;

        // Add to React state
        setTransactions(prev => [...prev, ...overridden]);

        // Clean up staging file
        const txnIds = members.map(t => t.id);
        await window.electronAPI.backgroundProcessor.removeFromStaged(stagedId, txnIds);
      }

      // Add identifier for future learning
      const identifier = (cluster.representativeDescription || '').trim();
      if (identifier.length >= 3) {
        const cleanId = identifier.replace(/\d{2,}/g, '').replace(/\s+/g, ' ').trim().split(/\s{2,}/)[0].trim();
        if (cleanId.length >= 3) {
          let targetCat;
          if (reviewMode === 'category') {
            targetCat = categoryMapping.find(c => c.code === target.code);
          } else {
            // Group mode — attach to first category in group
            const groupCategories = categoryMapping.filter(c => SECTION_TO_GROUP[c.section] === target.code);
            targetCat = groupCategories[0];
          }
          if (targetCat) {
            const existingIds = (targetCat.identifiers || []).map(id => id.toLowerCase());
            if (!existingIds.includes(cleanId.toLowerCase())) {
              setCategoryMapping(prev => prev.map(cat => {
                if (cat.code === targetCat.code) {
                  return { ...cat, identifiers: [...(cat.identifiers || []), cleanId] };
                }
                return cat;
              }));
            }
          }
        }
      }

      // Update panel state
      setAppliedClusters(prev => ({ ...prev, [clusterIndex]: appliedLabel }));
      setTotalApplied(prev => prev + members.length);

      // Remove applied transactions from cached stagedData (both modes)
      if (reviewMode === 'group') {
        const txnIds = new Set(members.map(t => t.id));
        setStagedData(prev => {
          if (!prev) return prev;
          return { ...prev, transactions: prev.transactions.filter(t => !txnIds.has(t.id)) };
        });
      } else {
        // In category mode, mark as resolved rather than removing (transactions already applied)
        const txnIds = new Set(members.map(t => t.id));
        setStagedData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            transactions: prev.transactions.map(t =>
              txnIds.has(t.id) ? { ...t, categoryCode: target.code, categoryName: target.name, categoryCohort: 'auto' } : t
            ),
          };
        });
      }

      // Notify FinnContext
      const eventName = reviewMode === 'category' ? 'staged-review:category-applied' : 'staged-review:applied';
      window.dispatchEvent(new CustomEvent(eventName, {
        detail: {
          stagedId, appliedCount: members.length, clusterIndex,
          groupName: reviewMode === 'group' ? appliedLabel : undefined,
          categoryName: reviewMode === 'category' ? appliedLabel : undefined,
          categoryCode: reviewMode === 'category' ? target.code : undefined,
          isAuto: false,
        }
      }));
    } finally {
      setApplying(null);
      setChangingCluster(null);
      setSearchText('');
    }
  }, [stagedData, stagedId, reviewMode, setTransactions, setCategoryMapping, categoryMapping]);

  // Accept All — apply suggested groups/categories to all pending clusters
  const acceptAll = useCallback(async () => {
    if (!stagedData) return;
    const reviewClusters = stagedData.reviewClusters || [];
    const multiClusters = reviewClusters.filter(c => c.memberCount > 1);

    for (let i = 0; i < multiClusters.length; i++) {
      if (appliedClusters[i] !== undefined) continue;
      const cluster = multiClusters[i];

      if (reviewMode === 'category') {
        if (!cluster.suggestedCategoryCode) continue;
        const targetCat = categoriesByGroup[cluster.suggestedGroup]?.find(c => c.code === cluster.suggestedCategoryCode);
        if (!targetCat) continue;
        await applyCluster(i, targetCat, cluster);
      } else {
        if (!cluster.suggestedGroup) continue;
        const targetGroup = GROUP_LIST.find(g => g.code === cluster.suggestedGroup);
        if (!targetGroup) continue;
        await applyCluster(i, targetGroup, cluster);
      }
    }
  }, [stagedData, appliedClusters, applyCluster, reviewMode, categoriesByGroup]);

  // Event listeners
  useEffect(() => {
    const handleOpen = (e) => {
      const { stagedData: data, mode } = e.detail;
      setStagedData(data);
      setStagedId(data.id);
      setAppliedClusters({});
      setAutoApplied(0);
      setTotalApplied(0);
      setRescoring(false);
      setExpandedCluster(null);
      setChangingCluster(null);
      setSearchText('');
      setReviewMode(mode || 'group');
      setIsOpen(true);
    };

    const handleApplied = (e) => {
      const { appliedCount, clusterIndex, groupName, categoryName, isAuto } = e.detail;
      if (isAuto) {
        setAutoApplied(appliedCount);
        setTotalApplied(prev => prev + appliedCount);
      } else if (clusterIndex !== undefined) {
        setAppliedClusters(prev => ({ ...prev, [clusterIndex]: categoryName || groupName || 'Applied' }));
        setTotalApplied(prev => prev + (appliedCount || 0));
      }
    };

    const handleRescoreStart = () => setRescoring(true);

    const handleRescoreDone = (e) => {
      const { promoted, updatedClusters } = e.detail;
      setRescoring(false);
      if (promoted > 0) setTotalApplied(prev => prev + promoted);
      if (updatedClusters) {
        setStagedData(prev => prev ? { ...prev, reviewClusters: updatedClusters } : prev);
        setAppliedClusters({});
      }
    };

    // Pass 2 mode switch — opens panel in category mode with Pass 2 review clusters
    const handlePass2 = (e) => {
      const { stagedData: data, reviewClusters } = e.detail;
      if (data) {
        setStagedData({ ...data, reviewClusters: reviewClusters || data.reviewClusters });
        setStagedId(data.id || 'applied');
      }
      setReviewMode('category');
      setAppliedClusters({});
      setAutoApplied(e.detail.autoApplied || 0);
      setTotalApplied(e.detail.autoApplied || 0);
      setExpandedCluster(null);
      setChangingCluster(null);
      setSearchText('');
      setIsOpen(true);
    };

    const handleClose = () => setIsOpen(false);

    window.addEventListener('staged-review:open', handleOpen);
    window.addEventListener('staged-review:applied', handleApplied);
    window.addEventListener('staged-review:category-applied', handleApplied);
    window.addEventListener('staged-review:rescore-start', handleRescoreStart);
    window.addEventListener('staged-review:rescore-done', handleRescoreDone);
    window.addEventListener('staged-review:pass2', handlePass2);
    window.addEventListener('staged-review:close', handleClose);

    return () => {
      window.removeEventListener('staged-review:open', handleOpen);
      window.removeEventListener('staged-review:applied', handleApplied);
      window.removeEventListener('staged-review:category-applied', handleApplied);
      window.removeEventListener('staged-review:rescore-start', handleRescoreStart);
      window.removeEventListener('staged-review:rescore-done', handleRescoreDone);
      window.removeEventListener('staged-review:pass2', handlePass2);
      window.removeEventListener('staged-review:close', handleClose);
    };
  }, []);

  // Focus search input when picker opens
  useEffect(() => {
    if (changingCluster !== null && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [changingCluster]);

  if (!isOpen || !stagedData) return null;

  const isCategory = reviewMode === 'category';
  const totalTransactions = stagedData.summary?.totalTransactions || stagedData.transactions?.length || 0;
  const reviewClusters = stagedData.reviewClusters || [];
  const multiClusters = reviewClusters.filter(c => c.memberCount > 1);
  const singletons = reviewClusters.filter(c => c.memberCount === 1);
  const progressPercent = totalTransactions > 0 ? Math.round((totalApplied / totalTransactions) * 100) : 0;

  const activeClusterIndex = multiClusters.findIndex((_, i) => !appliedClusters[i]);
  const allClustersResolved = multiClusters.length === 0 || activeClusterIndex === -1;

  // Count pending clusters with suggestions
  const pendingWithSuggestions = multiClusters.filter((c, i) => {
    if (appliedClusters[i] !== undefined) return false;
    return isCategory ? !!c.suggestedCategoryCode : !!c.suggestedGroup;
  }).length;

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
          backgroundColor: isCategory ? COLORS.slainteBlue : COLORS.textPrimary,
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
            {isCategory ? 'Category Assignment' : 'Group Assignment'}
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
          {stagedData.sourceFile || (isCategory ? 'Category assignment' : '')}
        </div>
        <div style={{
          height: '6px', borderRadius: '3px', backgroundColor: COLORS.borderLight,
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
          <span>{totalApplied} of {totalTransactions} {isCategory ? 'categorised' : 'grouped'}</span>
          <span style={{ fontWeight: 600, color: progressPercent === 100 ? COLORS.incomeColor : COLORS.slainteBlue }}>
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Summary strip with Accept All */}
      <div style={{
        padding: '0.5rem 1rem', borderBottom: `1px solid ${COLORS.borderLight}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '0.7rem', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {autoApplied > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: COLORS.incomeColor }}>
              <CheckCircle size={12} /> {autoApplied} auto
            </span>
          )}
          {multiClusters.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: COLORS.textSecondary }}>
              <ArrowRight size={12} /> {Object.keys(appliedClusters).length}/{multiClusters.length} clusters
            </span>
          )}
          {rescoring && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: COLORS.slainteBlue }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Re-scoring
            </span>
          )}
        </div>
        {pendingWithSuggestions > 1 && (
          <button
            onClick={acceptAll}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
              border: `1px solid ${COLORS.incomeColor}`,
              backgroundColor: `${COLORS.incomeColor}10`,
              color: COLORS.incomeColor,
              fontSize: '0.7rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <CheckCheck size={12} /> Accept All {isCategory ? 'Categories' : 'Groups'}
          </button>
        )}
      </div>

      {/* Scrollable cluster list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {multiClusters.map((cluster, i) => {
          const isApplied = appliedClusters[i] !== undefined;
          const isActive = i === activeClusterIndex && !isApplied;
          const isChanging = changingCluster === i;
          const isApplying = applying === i;

          return (
            <ClusterCard
              key={`cluster-${i}`}
              cluster={cluster}
              index={i}
              isApplied={isApplied}
              isActive={isActive}
              isChanging={isChanging}
              isApplying={isApplying}
              appliedLabel={appliedClusters[i]}
              isExpanded={expandedCluster === i}
              onToggleExpand={() => setExpandedCluster(expandedCluster === i ? null : i)}
              onAccept={() => {
                if (isCategory) {
                  const cats = categoriesByGroup[cluster.suggestedGroup] || [];
                  const cat = cats.find(c => c.code === cluster.suggestedCategoryCode);
                  if (cat) applyCluster(i, cat, cluster);
                } else {
                  const group = GROUP_LIST.find(g => g.code === cluster.suggestedGroup);
                  if (group) applyCluster(i, group, cluster);
                }
              }}
              onStartChange={() => { setChangingCluster(i); setSearchText(''); }}
              onCancelChange={() => { setChangingCluster(null); setSearchText(''); }}
              onSelectItem={(item) => applyCluster(i, item, cluster)}
              searchText={searchText}
              onSearchChange={setSearchText}
              searchInputRef={changingCluster === i ? searchInputRef : null}
              stagedData={stagedData}
              reviewMode={reviewMode}
              categoriesByGroup={categoriesByGroup}
            />
          );
        })}

        {/* Singletons — shown after all clusters resolved */}
        {singletons.length > 0 && allClustersResolved && (
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
                    padding: '0.5rem 0.75rem', borderRadius: '0.5rem', marginBottom: '0.25rem',
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
                    {cluster.totalAmount >= 0 ? '+' : '-'}{Math.abs(cluster.totalAmount).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInFromLeft {
          from { opacity: 0; transform: translateX(-1rem); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

/**
 * ClusterCard — A review cluster with Accept/Change buttons.
 * In group mode: group picker (10 options).
 * In category mode: category picker filtered by the cluster's group (6-10 options).
 */
const ClusterCard = ({
  cluster, index, isApplied, isActive, isChanging, isApplying,
  appliedLabel, isExpanded, onToggleExpand,
  onAccept, onStartChange, onCancelChange, onSelectItem,
  searchText, onSearchChange, searchInputRef,
  stagedData, reviewMode, categoriesByGroup,
}) => {
  const isCategory = reviewMode === 'category';

  // Determine suggestion
  const hasSuggestion = isCategory
    ? !!cluster.suggestedCategoryCode
    : !!cluster.suggestedGroup;

  const suggestionLabel = isCategory
    ? cluster.suggestedCategory || cluster.suggestedCategoryCode
    : (GROUP_LIST.find(g => g.code === cluster.suggestedGroup)?.name || null);

  // Group context label for category mode
  const groupLabel = cluster.suggestedGroup
    ? (GROUPS[cluster.suggestedGroup]?.name || cluster.suggestedGroup)
    : null;

  const bgColor = isApplied
    ? `${COLORS.incomeColor}08`
    : isActive ? `${COLORS.slainteBlue}06` : COLORS.bgPage;

  const borderColor = isApplied
    ? `${COLORS.incomeColor}40`
    : isActive ? COLORS.slainteBlue : COLORS.borderLight;

  const memberTransactions = isExpanded ? findClusterMembers(cluster, stagedData, reviewMode) : [];

  // Build picker items based on mode
  const pickerItems = useMemo(() => {
    if (isCategory) {
      // Categories within this cluster's group
      const cats = categoriesByGroup[cluster.suggestedGroup] || [];
      if (searchText.length >= 1) {
        const lower = searchText.toLowerCase();
        return cats.filter(c =>
          c.name.toLowerCase().includes(lower) ||
          c.code.toLowerCase().includes(lower)
        );
      }
      return cats;
    } else {
      // Groups
      if (searchText.length >= 1) {
        const lower = searchText.toLowerCase();
        return GROUP_LIST.filter(g =>
          g.name.toLowerCase().includes(lower) ||
          g.code.toLowerCase().includes(lower)
        );
      }
      return GROUP_LIST;
    }
  }, [isCategory, categoriesByGroup, cluster.suggestedGroup, searchText]);

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
        onClick={!isChanging ? onToggleExpand : undefined}
        style={{
          padding: '0.625rem 0.75rem',
          cursor: isChanging ? 'default' : 'pointer',
          display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        }}
      >
        {/* Status icon */}
        <div style={{ flexShrink: 0, marginTop: '0.125rem' }}>
          {isApplying ? (
            <Loader2 size={14} color={COLORS.slainteBlue} style={{ animation: 'spin 1s linear infinite' }} />
          ) : isApplied ? (
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
              {cluster.totalAmount >= 0 ? '+' : '-'}{Math.abs(cluster.totalAmount).toLocaleString()}
            </span>
          </div>
          {/* Group context in category mode */}
          {isCategory && groupLabel && !isApplied && (
            <div style={{ fontSize: '0.65rem', color: COLORS.slainteBlue, marginTop: '0.125rem' }}>
              Group: {groupLabel}
            </div>
          )}
          {/* AI reasoning hint */}
          {!isApplied && (cluster.opusReasoning || cluster.categoryReasoning) && (
            <div style={{ fontSize: '0.65rem', color: COLORS.textSecondary, marginTop: '0.125rem', fontStyle: 'italic' }}>
              {cluster.categoryReasoning || cluster.opusReasoning}
            </div>
          )}
          {isApplied && (
            <div style={{ fontSize: '0.7rem', color: COLORS.incomeColor, fontWeight: 500, marginTop: '0.125rem' }}>
              {appliedLabel}
            </div>
          )}
          {/* Suggestion + buttons (when not applied and not changing) */}
          {!isApplied && !isChanging && (
            <div style={{ marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {hasSuggestion && suggestionLabel ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAccept(); }}
                    disabled={isApplying}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.2rem 0.5rem', borderRadius: '0.375rem',
                      border: 'none',
                      backgroundColor: COLORS.incomeColor,
                      color: COLORS.white,
                      fontSize: '0.65rem', fontWeight: 600,
                      cursor: 'pointer',
                      maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    <Check size={10} /> {suggestionLabel}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onStartChange(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.2rem 0.4rem', borderRadius: '0.375rem',
                      border: `1px solid ${COLORS.borderLight}`,
                      backgroundColor: COLORS.white,
                      color: COLORS.textSecondary,
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Pencil size={10} /> Change
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onStartChange(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.2rem 0.5rem', borderRadius: '0.375rem',
                    border: `1px solid ${COLORS.slainteBlue}`,
                    backgroundColor: `${COLORS.slainteBlue}10`,
                    color: COLORS.slainteBlue,
                    fontSize: '0.65rem', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Search size={10} /> {isCategory ? 'Assign Category' : 'Assign Group'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        {!isChanging && (
          <div style={{ flexShrink: 0, color: COLORS.textSecondary }}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>

      {/* Inline picker (group or category) */}
      {isChanging && (
        <div style={{
          borderTop: `1px solid ${COLORS.borderLight}`,
          padding: '0.5rem 0.75rem',
          backgroundColor: COLORS.bgPage,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
            <Search size={12} color={COLORS.textSecondary} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={isCategory ? 'Search categories...' : 'Search groups...'}
              style={{
                flex: 1, border: `1px solid ${COLORS.borderLight}`, borderRadius: '0.375rem',
                padding: '0.3rem 0.5rem', fontSize: '0.75rem', outline: 'none',
                backgroundColor: COLORS.white,
              }}
              onFocus={(e) => e.target.style.borderColor = COLORS.slainteBlue}
              onBlur={(e) => e.target.style.borderColor = COLORS.borderLight}
            />
            <button
              onClick={onCancelChange}
              style={{
                background: 'none', border: 'none', color: COLORS.textSecondary,
                cursor: 'pointer', padding: '0.125rem', fontSize: '0.7rem',
              }}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ maxHeight: '12rem', overflowY: 'auto' }}>
            {pickerItems.map(item => (
              <button
                key={item.code}
                onClick={() => onSelectItem(item)}
                style={{
                  display: 'flex', width: '100%', textAlign: 'left',
                  padding: '0.375rem 0.5rem', borderRadius: '0.25rem',
                  border: 'none', backgroundColor: 'transparent',
                  cursor: 'pointer', fontSize: '0.75rem',
                  color: COLORS.textPrimary,
                  alignItems: 'center', gap: '0.5rem',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${COLORS.slainteBlue}10`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: (item.type === 'income') ? COLORS.incomeColor
                    : (item.type === 'non-business') ? COLORS.textSecondary
                    : COLORS.expenseColor,
                }} />
                <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </span>
                <span style={{ color: COLORS.textSecondary, fontSize: '0.6rem', flexShrink: 0 }}>
                  {item.code}
                </span>
              </button>
            ))}
            {pickerItems.length === 0 && (
              <div style={{ padding: '0.5rem', fontSize: '0.7rem', color: COLORS.textSecondary, textAlign: 'center' }}>
                No matching {isCategory ? 'categories' : 'groups'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expanded member list */}
      {isExpanded && !isChanging && memberTransactions.length > 0 && (
        <div style={{
          borderTop: `1px solid ${COLORS.borderLight}`,
          padding: '0.375rem 0.5rem',
          maxHeight: '10rem',
          overflowY: 'auto',
        }}>
          {memberTransactions.slice(0, 20).map((txn, j) => (
            <div
              key={txn.id || j}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.25rem 0.375rem', fontSize: '0.7rem',
                borderRadius: '0.25rem',
                backgroundColor: j % 2 === 0 ? 'transparent' : COLORS.bgPage,
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
                {(txn.credit || txn.isIncome) ? '+' : '-'}{Math.abs(txn.amount || txn.debit || txn.credit || 0).toLocaleString()}
              </span>
            </div>
          ))}
          {memberTransactions.length > 20 && (
            <div style={{ fontSize: '0.65rem', color: COLORS.textSecondary, padding: '0.25rem', textAlign: 'center' }}>
              ... and {memberTransactions.length - 20} more
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Find transactions belonging to a cluster by matching representative description.
 * In category mode, matches against all transactions (not just stagedCohort === 'review').
 */
function findClusterMembers(cluster, stagedData, reviewMode) {
  if (!stagedData?.transactions) return [];
  const repClean = (cluster.representativeDescription || '').toLowerCase().replace(/[0-9]/g, '').trim().substring(0, 8);

  return stagedData.transactions.filter(t => {
    if (t.id === cluster.representativeId) return true;
    // In group mode, only review cohort; in category mode, match uncategorised transactions
    if (reviewMode === 'category') {
      if (t.categoryCode && t.categoryCohort === 'auto') return false; // already categorised
    } else {
      if (t.stagedCohort !== 'review') return false;
    }
    const txnClean = (t.details || '').toLowerCase().replace(/[0-9]/g, '').trim().substring(0, 8);
    return repClean.length >= 4 && repClean === txnClean;
  });
}

export default StagedReviewPanel;
