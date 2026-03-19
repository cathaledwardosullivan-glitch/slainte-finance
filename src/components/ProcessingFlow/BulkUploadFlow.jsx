import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PanelLeftOpen, Loader, CheckCircle, Save } from 'lucide-react';
import COLORS from '../../utils/colors';
import { useProcessingFlow, STAGES, COHORTS } from './ProcessingFlowContext';
import ProcessingFlowPanel from './index';
import FinnEducationPanel from './FinnEducationPanel';
import { processTransactionsWithEngine } from '../../utils/transactionProcessor';
import { batchAICategorization } from '../../utils/aiCategorization';

// =============================================================================
// CONFIGURATION
// =============================================================================

const WAVE_SIZE = 350;
const COLLAPSED_KEY = 'slainte_bulk_finn_panel_collapsed';
export const PENDING_UPLOAD_KEY = 'slainte_bulk_upload_pending';

// =============================================================================
// COLLAPSED STATUS BAR (shown when Finn panel is hidden)
// =============================================================================

const CollapsedStatusBar = ({ onExpand, waveInfo, aiStatus }) => {
  const aiProgressPercent = aiStatus?.total > 0
    ? Math.round((aiStatus.progress / aiStatus.total) * 100)
    : 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.5rem 1rem',
      backgroundColor: COLORS.bgPage,
      borderBottom: `1px solid ${COLORS.borderLight}`,
      fontSize: '0.8125rem',
      color: COLORS.textSecondary
    }}>
      <button
        onClick={onExpand}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.625rem',
          border: `1px solid ${COLORS.slainteBlue}30`,
          borderRadius: '6px',
          backgroundColor: COLORS.white,
          color: COLORS.slainteBlue,
          fontSize: '0.75rem',
          fontWeight: 500,
          cursor: 'pointer'
        }}
      >
        <PanelLeftOpen style={{ width: '14px', height: '14px' }} />
        Show Finn
      </button>

      {waveInfo && (
        <span style={{ fontWeight: 500 }}>Wave {waveInfo.current}/{waveInfo.total}</span>
      )}

      {aiStatus?.running ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Loader style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
          AI: {aiStatus.total} txns · {aiProgressPercent}%
        </span>
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <CheckCircle style={{ width: '12px', height: '12px', color: COLORS.incomeColor }} />
          Ready
        </span>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * BulkUploadFlow — Orchestrates Finn education panel alongside ProcessingFlowPanel
 * for bulk uploads (200+ transactions). Manages wave splitting and background prefetch.
 */
export default function BulkUploadFlow({
  transactions,
  categoryMapping,
  existingTransactions,
  corrections,
  recordCorrection,
  onComplete,
  onWaveComplete,    // Called per-wave to commit transactions immediately
  onSaveAndExit,     // Called with remaining transactions when user saves progress
  onCancel,
  onRemoveIdentifier
}) {
  const processingFlow = useProcessingFlow();
  const { stage, aiProcessing, aiProgress, isFlowOpen, completeFlow, startProcessing } = processingFlow;

  // Panel visibility
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === 'true'
  );

  // Wave management
  const [waves, setWaves] = useState([]);
  const [currentWaveIndex, setCurrentWaveIndex] = useState(0);
  const [processedCorpus, setProcessedCorpus] = useState([]);
  const [allCompletedTransactions, setAllCompletedTransactions] = useState([]);
  const [allStats, setAllStats] = useState(null);
  const [flowComplete, setFlowComplete] = useState(false);

  // Background prefetch
  const prefetchRef = useRef(new Map()); // waveIndex → prefetched results
  const prefetchPromiseRef = useRef(new Map()); // waveIndex → in-flight Promise
  const prefetchAbortRef = useRef(false);

  // AI status tracking (for FinnEducationPanel)
  const aiStatus = {
    running: aiProcessing,
    progress: aiProgress.current,
    total: aiProgress.total
  };

  const waveInfo = waves.length > 0
    ? { current: currentWaveIndex + 1, total: waves.length }
    : null;

  // Split transactions into waves on mount
  useEffect(() => {
    if (transactions.length === 0) return;

    const newWaves = [];
    let remaining = [...transactions];
    while (remaining.length > 0) {
      const size = Math.min(WAVE_SIZE, remaining.length);
      newWaves.push(remaining.slice(0, size));
      remaining = remaining.slice(size);
    }
    setWaves(newWaves);
  }, [transactions]);

  // Start first wave when waves are set + eagerly prefetch wave 2
  useEffect(() => {
    if (waves.length > 0 && currentWaveIndex === 0 && !isFlowOpen && !flowComplete) {
      startWave(0);
      // Eagerly start prefetch for wave 2 immediately — don't wait for wave 1 to finish
      if (waves.length > 1) {
        startBackgroundPrefetch(1);
      }
    }
  }, [waves]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collapse preference persistence
  const handleCollapse = useCallback(() => {
    setIsPanelCollapsed(true);
    localStorage.setItem(COLLAPSED_KEY, 'true');
  }, []);

  const handleExpand = useCallback(() => {
    setIsPanelCollapsed(false);
    localStorage.setItem(COLLAPSED_KEY, 'false');
  }, []);

  // Background prefetch — runs engine + AI for a future wave.
  // Stores the promise so startWave can await it if still in-flight.
  // Only prefetches 1 wave ahead to avoid wasting API calls if user cancels.
  const runPrefetch = useCallback(async (waveIndex) => {
    const waveData = waves[waveIndex];
    if (!waveData) return;

    console.log(`[BulkUploadFlow] Starting background prefetch for wave ${waveIndex + 1} (${waveData.length} txns)`);

    try {
      const corpus = [...existingTransactions, ...processedCorpus];

      // 1. Engine categorization (synchronous, ~2-3s)
      const { transactions: processed } = processTransactionsWithEngine(
        waveData,
        categoryMapping,
        corpus
      );

      if (prefetchAbortRef.current) return;

      // 2. AI for uncertain transactions
      const needsAI = processed.filter(t =>
        t.groupCohort === COHORTS.AI_ASSIST || t.groupCohort === COHORTS.REVIEW
      );

      if (needsAI.length > 0) {
        const aiResults = await batchAICategorization(needsAI, 'group', {
          existingTransactions: corpus,
          corrections,
          categoryMapping
        });

        if (prefetchAbortRef.current) return;

        // Apply AI results to processed transactions
        const updateMap = new Map();
        aiResults.forEach(({ transactionId, suggestion }) => {
          if (suggestion && suggestion.group) {
            updateMap.set(transactionId, {
              groupAISuggested: true,
              aiGroupSuggestion: suggestion,
              ...(suggestion.confidence >= 0.70 ? {
                group: suggestion.group,
                groupConfidence: suggestion.confidence
              } : {})
            });
          }
        });

        const finalProcessed = processed.map(t => {
          const update = updateMap.get(t.id);
          return update ? { ...t, ...update } : t;
        });

        prefetchRef.current.set(waveIndex, finalProcessed);
        console.log(`[BulkUploadFlow] Prefetch complete for wave ${waveIndex + 1}`);
      } else {
        prefetchRef.current.set(waveIndex, processed);
        console.log(`[BulkUploadFlow] Prefetch complete for wave ${waveIndex + 1} (no AI needed)`);
      }

    } catch (err) {
      console.error(`[BulkUploadFlow] Prefetch error for wave ${waveIndex + 1}:`, err);
    }
  }, [waves, existingTransactions, processedCorpus, categoryMapping, corrections]);

  // Entry point: starts prefetch only if not already done or in-flight
  const startBackgroundPrefetch = useCallback((waveIndex) => {
    if (prefetchRef.current.has(waveIndex) || prefetchPromiseRef.current.has(waveIndex)) return;
    const promise = runPrefetch(waveIndex);
    prefetchPromiseRef.current.set(waveIndex, promise);
  }, [runPrefetch]);

  // Launch processing for a specific wave — awaits in-flight prefetch if available
  const startWave = useCallback(async (waveIndex) => {
    const waveData = waves[waveIndex];
    if (!waveData) return;

    // Check for completed prefetch first
    let prefetched = prefetchRef.current.get(waveIndex);

    // If not ready but prefetch is in-flight, await it instead of starting from scratch
    if (!prefetched && prefetchPromiseRef.current.has(waveIndex)) {
      console.log(`[BulkUploadFlow] Wave ${waveIndex + 1}: prefetch in progress — awaiting...`);
      try {
        await prefetchPromiseRef.current.get(waveIndex);
        prefetched = prefetchRef.current.get(waveIndex);
      } catch (e) {
        console.warn(`[BulkUploadFlow] Wave ${waveIndex + 1}: prefetch failed, processing from scratch`);
      }
    }

    const corpus = [...existingTransactions, ...processedCorpus];

    if (prefetched) {
      console.log(`[BulkUploadFlow] Starting wave ${waveIndex + 1} with prefetched data (${prefetched.length} txns)`);
      startProcessing(prefetched, categoryMapping, {
        existingTransactions: corpus,
        corrections,
        recordCorrection,
        skipCategoryStage: true,
        prefetchedAI: true,
        waveInfo: { current: waveIndex + 1, total: waves.length }
      });
    } else {
      console.log(`[BulkUploadFlow] Starting wave ${waveIndex + 1} fresh (${waveData.length} txns)`);
      startProcessing(waveData, categoryMapping, {
        existingTransactions: corpus,
        corrections,
        recordCorrection,
        skipCategoryStage: true,
        waveInfo: { current: waveIndex + 1, total: waves.length }
      });
    }

    // Prefetch next wave (1 ahead only — avoids wasting API calls if user cancels)
    if (waveIndex + 1 < waves.length) {
      startBackgroundPrefetch(waveIndex + 1);
    }
  }, [waves, existingTransactions, processedCorpus, categoryMapping, corrections, recordCorrection, startProcessing, startBackgroundPrefetch]);

  // Handle wave completion from ProcessingFlowPanel
  const handleWaveComplete = useCallback((result) => {
    const { transactions: completed, stats: waveStats } = result;

    // Add completed transactions to running totals
    const newAllCompleted = [...allCompletedTransactions, ...completed];
    setAllCompletedTransactions(newAllCompleted);

    // Add auto-matched to corpus for next wave
    const autoMatched = completed.filter(t =>
      t.groupCohort === COHORTS.AUTO || t.unifiedCohort === 'auto'
    );
    setProcessedCorpus(prev => [...prev, ...autoMatched]);

    // Merge stats
    setAllStats(prev => {
      if (!prev) return waveStats;
      return {
        ...prev,
        total: (prev.total || 0) + (waveStats?.total || 0),
        income: (prev.income || 0) + (waveStats?.income || 0),
        expense: (prev.expense || 0) + (waveStats?.expense || 0),
        groupAuto: (prev.groupAuto || 0) + (waveStats?.groupAuto || 0),
        groupAiAssist: (prev.groupAiAssist || 0) + (waveStats?.groupAiAssist || 0),
        groupReview: (prev.groupReview || 0) + (waveStats?.groupReview || 0)
      };
    });

    // Per-wave commit: save this wave's transactions to app state immediately
    if (onWaveComplete) {
      onWaveComplete({ transactions: completed, stats: waveStats });
    }

    const nextWaveIndex = currentWaveIndex + 1;

    if (nextWaveIndex < waves.length) {
      // More waves to process
      setCurrentWaveIndex(nextWaveIndex);
      // Start next wave — will await in-flight prefetch if available
      startWave(nextWaveIndex);
    } else {
      // All waves complete — clear any pending stash
      localStorage.removeItem(PENDING_UPLOAD_KEY);
      setFlowComplete(true);
      onComplete({
        transactions: newAllCompleted,
        stats: allStats || waveStats
      });
    }
  }, [currentWaveIndex, waves, allCompletedTransactions, allStats, startWave, onComplete, onWaveComplete]);

  // Handle Save & Exit: commit completed waves (already done per-wave), stash remaining
  const handleSaveAndExit = useCallback(() => {
    prefetchAbortRef.current = true;

    // Remaining = current in-progress wave + all future waves
    const remainingWaves = waves.slice(currentWaveIndex);
    const remainingTransactions = remainingWaves.flat();

    if (remainingTransactions.length > 0) {
      // Stash remaining for resume
      const stash = {
        remainingTransactions,
        completedWaveCount: currentWaveIndex,
        totalWaveCount: waves.length,
        totalTransactionCount: transactions.length,
        completedTransactionCount: transactions.length - remainingTransactions.length,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(PENDING_UPLOAD_KEY, JSON.stringify(stash));
      console.log(`[BulkUploadFlow] Saved progress: ${currentWaveIndex}/${waves.length} waves, ${remainingTransactions.length} remaining`);
    }

    if (onSaveAndExit) {
      onSaveAndExit(remainingTransactions);
    } else {
      onCancel();
    }
  }, [waves, currentWaveIndex, transactions, onSaveAndExit, onCancel]);

  // Handle cancel (discard all — no stash)
  const handleCancel = useCallback(() => {
    prefetchAbortRef.current = true;
    localStorage.removeItem(PENDING_UPLOAD_KEY);
    onCancel();
  }, [onCancel]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: COLORS.overlayDark,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '95vw',
        maxWidth: '1600px',
        height: '90vh',
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Collapsed status bar when Finn panel is hidden */}
        {isPanelCollapsed && (
          <CollapsedStatusBar
            onExpand={handleExpand}
            waveInfo={waveInfo}
            aiStatus={aiStatus}
          />
        )}

        {/* Main content area */}
        <div style={{
          flex: 1,
          display: 'flex',
          gap: isPanelCollapsed ? 0 : '0',
          overflow: 'hidden'
        }}>
          {/* Left: Finn Education Panel */}
          {!isPanelCollapsed && (
            <FinnEducationPanel
              transactionCount={transactions.length}
              aiStatus={aiStatus}
              waveInfo={waveInfo}
              categoryMapping={categoryMapping}
              onCollapse={handleCollapse}
            />
          )}

          {/* Right: ProcessingFlowPanel (embedded) */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {isFlowOpen && (
              <ProcessingFlowPanel
                embedded={true}
                categoryMapping={categoryMapping}
                onComplete={handleWaveComplete}
                onCancel={handleCancel}
                onRemoveIdentifier={onRemoveIdentifier}
              />
            )}
          </div>
        </div>

        {/* Save & Exit bar — visible after at least 1 wave completed and more remain */}
        {currentWaveIndex > 0 && !flowComplete && waves.length > 1 && (
          <div style={{
            padding: '0.5rem 1rem',
            borderTop: `1px solid ${COLORS.borderLight}`,
            backgroundColor: COLORS.bgPage,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '0.8125rem', color: COLORS.textSecondary }}>
              {currentWaveIndex} of {waves.length} waves completed — progress saved automatically
            </span>
            <button
              onClick={handleSaveAndExit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.875rem',
                border: `1px solid ${COLORS.slainteBlue}40`,
                borderRadius: '6px',
                backgroundColor: COLORS.white,
                color: COLORS.slainteBlue,
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <Save style={{ width: '14px', height: '14px' }} />
              Save & Exit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
