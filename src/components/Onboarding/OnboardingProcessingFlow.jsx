/**
 * Onboarding Processing Flow
 *
 * Wraps the modern ProcessingFlow for first-time transaction uploads during onboarding.
 * Uses wave processing to bootstrap the categorization system when there are no
 * existing transactions to compare against.
 *
 * Features:
 * - Wave-based processing (builds corpus progressively)
 * - Adaptive confidence scoring (identifier-heavy in Wave 1)
 * - Finn-guided UI with contextual help
 * - Progress tracking across waves
 */

import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { processInWaves, getWaveProcessingSummary, WAVE_CONFIG } from '../../utils/waveProcessor';
import { ProcessingFlowProvider, useProcessingFlow, STAGES } from '../ProcessingFlow/ProcessingFlowContext';
import { COLORS } from '../../utils/colors';

// =============================================================================
// WAVE PROCESSING STATES
// =============================================================================

const WAVE_STATES = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  PROCESSING: 'processing',
  REVIEWING: 'reviewing',
  COMPLETE: 'complete',
  ERROR: 'error'
};

// =============================================================================
// WAVE PROGRESS DISPLAY
// =============================================================================

const WaveProgressBar = ({ currentWave, totalWaves, waveProgress, totalProgress }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '4px',
      fontSize: '13px',
      color: '#666'
    }}>
      <span>Wave {currentWave} of {totalWaves}</span>
      <span>{Math.round(totalProgress)}%</span>
    </div>

    {/* Overall progress */}
    <div style={{
      height: '8px',
      backgroundColor: '#E0E0E0',
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: '8px'
    }}>
      <div style={{
        height: '100%',
        width: `${totalProgress}%`,
        backgroundColor: COLORS.slainteBlue,
        borderRadius: '4px',
        transition: 'width 0.3s ease'
      }} />
    </div>

    {/* Wave-specific info */}
    {waveProgress && (
      <div style={{
        display: 'flex',
        gap: '16px',
        fontSize: '12px',
        color: '#888'
      }}>
        <span>Auto: {waveProgress.auto || 0}</span>
        <span>Needs Review: {(waveProgress.aiAssist || 0) + (waveProgress.review || 0)}</span>
      </div>
    )}
  </div>
);

WaveProgressBar.propTypes = {
  currentWave: PropTypes.number.isRequired,
  totalWaves: PropTypes.number.isRequired,
  waveProgress: PropTypes.object,
  totalProgress: PropTypes.number.isRequired
};

// =============================================================================
// FINN MESSAGE COMPONENT
// =============================================================================

const FinnMessage = ({ message, isProcessing }) => (
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#F5F8FF',
    borderRadius: '12px',
    marginBottom: '16px'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: COLORS.slainteBlue,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '16px',
      flexShrink: 0
    }}>
      F
    </div>
    <div style={{ flex: 1 }}>
      <div style={{
        fontWeight: '500',
        color: '#333',
        marginBottom: '4px'
      }}>
        Finn
      </div>
      <div style={{
        color: '#666',
        fontSize: '14px',
        lineHeight: 1.5
      }}>
        {message}
        {isProcessing && (
          <span style={{ marginLeft: '8px' }}>
            <span className="loading-dots">...</span>
          </span>
        )}
      </div>
    </div>
  </div>
);

FinnMessage.propTypes = {
  message: PropTypes.string.isRequired,
  isProcessing: PropTypes.bool
};

// =============================================================================
// COHORT SUMMARY COMPONENT
// =============================================================================

const CohortSummary = ({ stats }) => {
  if (!stats) return null;

  const cohorts = [
    {
      label: 'Auto-Categorized',
      count: stats.autoCohort,
      percent: stats.autoPercent,
      color: COLORS.incomeColor,
      description: 'High confidence - no review needed'
    },
    {
      label: 'AI Assisted',
      count: stats.aiAssistCohort,
      percent: stats.aiAssistPercent,
      color: COLORS.slainteBlue,
      description: 'AI suggestion - verify if needed'
    },
    {
      label: 'Needs Review',
      count: stats.reviewCohort,
      percent: stats.reviewPercent,
      color: COLORS.expenseColor,
      description: 'Low confidence - your input needed'
    }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '12px',
      marginBottom: '16px'
    }}>
      {cohorts.map(cohort => (
        <div
          key={cohort.label}
          style={{
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: `2px solid ${cohort.color}20`,
            textAlign: 'center'
          }}
        >
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: cohort.color
          }}>
            {cohort.count}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#666',
            marginTop: '4px'
          }}>
            {cohort.label}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#999',
            marginTop: '2px'
          }}>
            ({cohort.percent.toFixed(1)}%)
          </div>
        </div>
      ))}
    </div>
  );
};

CohortSummary.propTypes = {
  stats: PropTypes.object
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const OnboardingProcessingFlowInner = ({
  transactions,
  categoryMapping,
  onComplete,
  onCancel,
  verbose = false
}) => {
  const [waveState, setWaveState] = useState(WAVE_STATES.IDLE);
  const [currentWave, setCurrentWave] = useState(0);
  const [totalWaves, setTotalWaves] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [waveDetails, setWaveDetails] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [finnMessage, setFinnMessage] = useState('');

  const processingFlow = useProcessingFlow();

  // Calculate total waves on mount (using adaptive wave sizing)
  useEffect(() => {
    if (transactions?.length > 0) {
      // Estimate wave count: 5 waves of 100 for first 500, then 500 per wave
      const firstPhaseCount = Math.min(transactions.length, 500);
      const firstPhaseWaves = Math.ceil(firstPhaseCount / WAVE_CONFIG.INITIAL_WAVE_SIZE);
      const remainingCount = Math.max(0, transactions.length - 500);
      const remainingWaves = Math.ceil(remainingCount / WAVE_CONFIG.STANDARD_WAVE_SIZE);
      setTotalWaves(Math.min(firstPhaseWaves + remainingWaves, WAVE_CONFIG.MAX_WAVES));
    }
  }, [transactions]);

  // Get contextual Finn message based on state
  const getFinnMessage = useCallback(() => {
    switch (waveState) {
      case WAVE_STATES.IDLE:
        return `I'll help you organize ${transactions?.length || 0} transactions into expense groups. Since this is your first upload, I'll process them in waves to learn as I go.`;

      case WAVE_STATES.PREPARING:
        return `Preparing to process ${transactions?.length || 0} transactions in ${totalWaves} waves...`;

      case WAVE_STATES.PROCESSING:
        if (currentWave === 1) {
          return `Processing Wave 1 - I'm using your practice profile identifiers (staff names, partners) to match transactions. This first wave helps me learn patterns for later waves.`;
        }
        return `Processing Wave ${currentWave} of ${totalWaves} - Using patterns learned from previous waves to improve accuracy.`;

      case WAVE_STATES.REVIEWING:
        const summary = results ? getWaveProcessingSummary(results) : null;
        if (summary?.improvement?.improved) {
          return `Great news! Accuracy improved from ${summary.improvement.firstWaveAutoRate} in Wave 1 to ${summary.improvement.lastWaveAutoRate} in the final wave. We'll sort these into expense groups now - you can assign specific categories later when needed.`;
        }
        return `Processing complete! We'll now sort these into expense groups. You can assign more specific categories later when generating reports.`;

      case WAVE_STATES.COMPLETE:
        return `All done! Your transactions are organized into groups and ready to use. When you need more detail (like for P&L reports), I can help you assign specific categories.`;

      case WAVE_STATES.ERROR:
        return `I encountered an issue: ${error}. Would you like to try again?`;

      default:
        return '';
    }
  }, [waveState, transactions, totalWaves, currentWave, results, error]);

  // Update Finn message when state changes
  useEffect(() => {
    setFinnMessage(getFinnMessage());
  }, [getFinnMessage]);

  // Start wave processing
  const startWaveProcessing = useCallback(async () => {
    if (!transactions || transactions.length === 0) {
      setError('No transactions to process');
      setWaveState(WAVE_STATES.ERROR);
      return;
    }

    setWaveState(WAVE_STATES.PROCESSING);
    setError(null);

    try {
      const result = await processInWaves(transactions, categoryMapping, {
        verbose,
        onWaveComplete: ({ waveNumber, totalWaves: waves, waveDetail }) => {
          setCurrentWave(waveNumber);
          setTotalWaves(waves);
          setWaveDetails(prev => [...prev, waveDetail]);
        },
        onProgress: (processed, total) => {
          setProcessedCount(processed);
        }
      });

      setResults(result);
      setWaveState(WAVE_STATES.REVIEWING);

      // Start the ProcessingFlow with the wave-processed results
      // This allows the user to review AI_ASSIST and REVIEW cohorts
      // Note: skipCategoryStage=true to avoid overwhelming users during onboarding
      // Categories can be assigned later when generating detailed reports
      processingFlow.startProcessing(
        result.results,
        categoryMapping,
        {
          existingTransactions: result.results.filter(r => r.unifiedCohort === 'auto'),
          corrections: [],
          skipCategoryStage: true  // Onboarding: stop at Group level, Categories later
        }
      );

    } catch (err) {
      console.error('[OnboardingProcessingFlow] Processing error:', err);
      setError(err.message || 'Failed to process transactions');
      setWaveState(WAVE_STATES.ERROR);
    }
  }, [transactions, categoryMapping, verbose, processingFlow]);

  // Handle completion
  const handleComplete = useCallback(() => {
    if (results) {
      const flowResult = processingFlow.completeFlow();
      onComplete({
        transactions: flowResult.transactions || results.results,
        stats: results.stats,
        waveDetails: results.waveDetails
      });
    }
    setWaveState(WAVE_STATES.COMPLETE);
  }, [results, processingFlow, onComplete]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    processingFlow.cancelFlow();
    onCancel?.();
  }, [processingFlow, onCancel]);

  // Calculate progress percentage
  const progressPercent = transactions?.length > 0
    ? (processedCount / transactions.length) * 100
    : 0;

  // Current wave progress
  const currentWaveDetail = waveDetails[currentWave - 1];

  return (
    <div style={{
      padding: '24px',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      {/* Finn guidance */}
      <FinnMessage
        message={finnMessage}
        isProcessing={waveState === WAVE_STATES.PROCESSING}
      />

      {/* Wave progress */}
      {waveState === WAVE_STATES.PROCESSING && (
        <WaveProgressBar
          currentWave={currentWave}
          totalWaves={totalWaves}
          waveProgress={currentWaveDetail?.stats}
          totalProgress={progressPercent}
        />
      )}

      {/* Cohort summary after processing */}
      {waveState === WAVE_STATES.REVIEWING && results && (
        <CohortSummary stats={results.stats} />
      )}

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginTop: '24px',
        justifyContent: 'flex-end'
      }}>
        {waveState === WAVE_STATES.IDLE && (
          <>
            <button
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={startWaveProcessing}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: COLORS.slainteBlue,
                color: 'white',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Start Categorization
            </button>
          </>
        )}

        {waveState === WAVE_STATES.REVIEWING && (
          <>
            <button
              onClick={handleCancel}
              style={{
                padding: '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: COLORS.slainteBlue,
                color: 'white',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Continue to Review
            </button>
          </>
        )}

        {waveState === WAVE_STATES.ERROR && (
          <>
            <button
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={startWaveProcessing}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: COLORS.slainteBlue,
                color: 'white',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </>
        )}
      </div>

      {/* Wave improvement visualization (after processing) */}
      {waveState === WAVE_STATES.REVIEWING && waveDetails.length > 1 && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '500',
            color: '#666',
            marginBottom: '12px'
          }}>
            Wave Processing Improvement
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {waveDetails.map((wave, idx) => (
              <React.Fragment key={wave.waveNumber}>
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    Wave {wave.waveNumber}
                  </div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: COLORS.incomeColor
                  }}>
                    {((wave.stats.auto / wave.transactionCount) * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#999' }}>
                    auto
                  </div>
                </div>
                {idx < waveDetails.length - 1 && (
                  <div style={{ color: '#ccc', fontSize: '18px' }}>→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

OnboardingProcessingFlowInner.propTypes = {
  transactions: PropTypes.array.isRequired,
  categoryMapping: PropTypes.array.isRequired,
  onComplete: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  verbose: PropTypes.bool
};

// =============================================================================
// WRAPPED COMPONENT WITH PROVIDER
// =============================================================================

const OnboardingProcessingFlow = (props) => (
  <ProcessingFlowProvider>
    <OnboardingProcessingFlowInner {...props} />
  </ProcessingFlowProvider>
);

OnboardingProcessingFlow.propTypes = OnboardingProcessingFlowInner.propTypes;

export default OnboardingProcessingFlow;

export { WAVE_STATES };
