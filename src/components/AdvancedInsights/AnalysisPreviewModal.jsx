import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, FileText, Database, Cpu, Clock, CheckCircle, AlertCircle, Send, Settings2 } from 'lucide-react';
import { useFinn } from '../../context/FinnContext';
import { useAppContext } from '../../context/AppContext';
import { usePracticeProfile } from '../../hooks/usePracticeProfile';
import {
  ANALYSIS_CATEGORIES,
  DATA_SOURCE_LABELS,
  REPORT_TYPE_LABELS
} from '../../data/suggestedAnalyses';
import COLORS from '../../utils/colors';
import { getHealthCheckSectionStatus } from '../../utils/healthCheckCalculations';

/** Read a dotted path from an object, e.g. 'privatePatients.averageConsultationFee' */
function getNestedValue(obj, path) {
  if (!obj || !path) return null;
  return path.split('.').reduce((o, k) => (o != null ? o[k] : null), obj);
}

/** Build a nested update object from a dotted path, e.g. 'operations.gpClinicalHoursPerWeek' → { operations: { gpClinicalHoursPerWeek: value } } */
function buildNestedUpdate(path, value) {
  const keys = path.split('.');
  const result = {};
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

/**
 * AnalysisPreviewModal - Preview an analysis before generating the report.
 * States: preview → submitted | error
 * After submitting, shows a brief confirmation then auto-closes after 2.5s.
 * The report generates in the background — user is free to browse.
 */
const AnalysisPreviewModal = ({ analysis, onClose, onReportReady }) => {
  const { generateReportFromTab, backgroundTask, TASK_STATUS } = useFinn();
  const { transactions, paymentAnalysisData } = useAppContext();
  const { profile, updateProfile } = usePracticeProfile();
  const [status, setStatus] = useState('preview'); // preview | submitted | error
  const [errorMessage, setErrorMessage] = useState('');
  const [inputValues, setInputValues] = useState({});
  const autoCloseTimer = useRef(null);

  const category = ANALYSIS_CATEGORIES.find(c => c.id === analysis.categoryId);
  const reportTypeInfo = REPORT_TYPE_LABELS[analysis.reportType] || REPORT_TYPE_LABELS.standard;
  const hasDataInputs = analysis.dataInputs && analysis.dataInputs.length > 0;

  // Pre-fill input values from profile on mount
  const prefilledKeys = useMemo(() => {
    if (!hasDataInputs || !profile) return new Set();
    const keys = new Set();
    const initial = {};
    for (const input of analysis.dataInputs) {
      const existing = getNestedValue(profile, input.profilePath);
      if (existing != null && existing !== '') {
        initial[input.key] = String(existing);
        keys.add(input.key);
      }
    }
    setInputValues(initial);
    return keys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, hasDataInputs]);

  // Health Check section status (for GMS Optimisation Summary and similar)
  const sectionStatus = useMemo(() => {
    if (!analysis.showSectionStatus) return null;
    return getHealthCheckSectionStatus(profile, paymentAnalysisData);
  }, [analysis.showSectionStatus, profile, paymentAnalysisData]);

  // Check data availability
  const availableData = {
    transactions: transactions && transactions.length > 0,
    paymentAnalysisData: paymentAnalysisData && paymentAnalysisData.length > 0,
    healthCheckPartial: sectionStatus?.meetsMinimum || false
  };
  const hasRequiredData = analysis.requiresData.every(key => availableData[key]);

  // Auto-close after submission
  useEffect(() => {
    if (status === 'submitted') {
      autoCloseTimer.current = setTimeout(() => {
        onClose();
      }, 2500);
    }
    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, [status, onClose]);

  const handleInputChange = (key, rawValue) => {
    // Keep as string — only allow digits (and optionally one decimal point)
    const cleaned = rawValue.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setInputValues(prev => ({ ...prev, [key]: cleaned }));
  };

  const handleGenerate = () => {
    if (!hasRequiredData) return;

    // Guard: already running
    if (backgroundTask?.status === TASK_STATUS.RUNNING) {
      setErrorMessage('A report is already being generated. Please wait for it to finish.');
      setStatus('error');
      return;
    }

    // Save any entered values back to the practice profile.
    // Call updateProfile once per input to avoid Object.assign overwriting
    // nested keys (e.g. multiple operations.* fields clobbering each other).
    if (hasDataInputs) {
      for (const input of analysis.dataInputs) {
        const val = inputValues[input.key];
        if (val != null && val !== '') {
          const numVal = Number(val);
          if (!isNaN(numVal) && numVal > 0) {
            updateProfile(buildNestedUpdate(input.profilePath, numVal));
          }
        }
      }
    }

    // Fire and forget — don't await. Report generates in background.
    generateReportFromTab(analysis).catch((err) => {
      // Error is handled by FinnContext (sets backgroundTask to FAILED).
      // User will see notification via Finn widget.
      console.error('Report generation failed:', err.message);
    });

    setStatus('submitted');
  };

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.overlayMedium,
        backdropFilter: 'blur(2px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: COLORS.white,
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          position: 'relative'
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.textSecondary,
            padding: '0.25rem',
            borderRadius: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = COLORS.textPrimary}
          onMouseLeave={(e) => e.currentTarget.style.color = COLORS.textSecondary}
        >
          <X style={{ height: '1.25rem', width: '1.25rem' }} />
        </button>

        {/* Preview State */}
        {status === 'preview' && (
          <div style={{ padding: '2rem' }}>
            {/* Category badge */}
            {category && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '0.25rem',
                  backgroundColor: `${category.color}15`,
                  color: category.color,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  marginBottom: '1rem'
                }}
              >
                {category.label}
              </span>
            )}

            {/* Title */}
            <h2 style={{
              fontSize: '1.375rem',
              fontWeight: 700,
              color: COLORS.textPrimary,
              margin: '0 0 0.5rem',
              paddingRight: '2rem'
            }}>
              {analysis.title}
            </h2>

            {/* Description */}
            <p style={{
              fontSize: '0.9375rem',
              color: COLORS.textSecondary,
              lineHeight: 1.6,
              margin: '0 0 1.5rem'
            }}>
              {analysis.description}
            </p>

            {/* What this report covers */}
            {analysis.details && analysis.details.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  margin: '0 0 0.625rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem'
                }}>
                  <FileText style={{ height: '0.875rem', width: '0.875rem', color: COLORS.slainteBlue }} />
                  What this report covers
                </h4>
                <ul style={{
                  margin: 0,
                  paddingLeft: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.375rem'
                }}>
                  {analysis.details.map((detail, i) => (
                    <li key={i} style={{
                      fontSize: '0.8125rem',
                      color: COLORS.textSecondary,
                      lineHeight: 1.5
                    }}>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Health Check Section Status — shows which areas have data */}
            {sectionStatus && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: COLORS.bgPage,
                borderRadius: '0.5rem',
                border: `1px solid ${COLORS.borderLight}`
              }}>
                <h4 style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  margin: '0 0 0.125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem'
                }}>
                  <Database style={{ height: '0.875rem', width: '0.875rem', color: COLORS.slainteBlue }} />
                  Health Check Data ({sectionStatus.sectionsComplete}/{sectionStatus.sectionsTotal} sections)
                </h4>
                <p style={{
                  fontSize: '0.6875rem',
                  color: COLORS.textSecondary,
                  margin: '0 0 0.75rem',
                  lineHeight: 1.4
                }}>
                  {sectionStatus.meetsMinimum
                    ? 'Sections not yet completed will be noted in the report.'
                    : 'Upload PCRS statements and complete at least one Health Check section to generate this report.'}
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.375rem'
                }}>
                  {[
                    { key: 'pcrsData', label: 'PCRS Statements' },
                    { key: 'demographics', label: 'Patient Demographics' },
                    { key: 'practiceSupport', label: 'Practice Support' },
                    { key: 'leaveEntitlements', label: 'Leave Entitlements' },
                    { key: 'diseaseRegisters', label: 'Disease Registers' },
                    { key: 'cervicalScreening', label: 'Cervical Screening' }
                  ].map(({ key, label }) => {
                    const section = sectionStatus[key];
                    return (
                      <div key={key} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        fontSize: '0.75rem',
                        color: section.available ? COLORS.textPrimary : COLORS.textSecondary,
                        opacity: section.available ? 1 : 0.6
                      }}>
                        {section.available ? (
                          <CheckCircle style={{ height: '0.75rem', width: '0.75rem', color: COLORS.incomeColor, flexShrink: 0 }} />
                        ) : (
                          <X style={{ height: '0.75rem', width: '0.75rem', color: COLORS.textSecondary, flexShrink: 0 }} />
                        )}
                        {label}
                      </div>
                    );
                  })}
                </div>
                {sectionStatus.meetsMinimum && sectionStatus.sectionsComplete < sectionStatus.sectionsTotal && (
                  <p style={{
                    fontSize: '0.625rem',
                    color: COLORS.slainteBlue,
                    margin: '0.625rem 0 0',
                    lineHeight: 1.4
                  }}>
                    Complete your full GMS Health Check for comprehensive results.
                  </p>
                )}
              </div>
            )}

            {/* Data Inputs — optional operational details */}
            {hasDataInputs && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: COLORS.bgPage,
                borderRadius: '0.5rem',
                border: `1px solid ${COLORS.borderLight}`
              }}>
                <h4 style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  margin: '0 0 0.125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem'
                }}>
                  <Settings2 style={{ height: '0.875rem', width: '0.875rem', color: COLORS.slainteBlue }} />
                  Quick Details
                </h4>
                <p style={{
                  fontSize: '0.6875rem',
                  color: COLORS.textSecondary,
                  margin: '0 0 0.75rem',
                  lineHeight: 1.4
                }}>
                  These help Finn make more accurate calculations. Leave blank to skip.
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.625rem'
                }}>
                  {analysis.dataInputs.map(input => {
                    const isPrefilled = prefilledKeys.has(input.key);
                    return (
                      <div key={input.key}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          color: COLORS.textSecondary,
                          marginBottom: '0.25rem'
                        }}>
                          {input.label}
                          {isPrefilled && (
                            <CheckCircle style={{
                              height: '0.625rem',
                              width: '0.625rem',
                              color: COLORS.incomeColor
                            }} />
                          )}
                        </label>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: COLORS.white,
                          border: `1px solid ${COLORS.borderLight}`,
                          borderRadius: '0.375rem',
                          overflow: 'hidden'
                        }}>
                          <span style={{
                            padding: '0.375rem 0.5rem',
                            fontSize: '0.75rem',
                            color: COLORS.textSecondary,
                            fontWeight: 500,
                            backgroundColor: COLORS.bgPage,
                            borderRight: `1px solid ${COLORS.borderLight}`,
                            minWidth: '2rem',
                            textAlign: 'center'
                          }}>
                            {input.unit}
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder={input.placeholder}
                            value={inputValues[input.key] ?? ''}
                            onChange={(e) => handleInputChange(input.key, e.target.value)}
                            style={{
                              flex: 1,
                              padding: '0.375rem 0.5rem',
                              border: 'none',
                              outline: 'none',
                              fontSize: '0.8125rem',
                              color: COLORS.textPrimary,
                              width: '100%',
                              minWidth: 0
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Info pills row */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '1.75rem'
            }}>
              {/* Data sources */}
              {(analysis.dataSources || []).map(src => (
                <span
                  key={src}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.3125rem 0.625rem',
                    backgroundColor: COLORS.bgPage,
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    color: COLORS.textSecondary,
                    fontWeight: 500
                  }}
                >
                  <Database style={{ height: '0.75rem', width: '0.75rem' }} />
                  {DATA_SOURCE_LABELS[src] || src}
                </span>
              ))}

              {/* Model type */}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.3125rem 0.625rem',
                  backgroundColor: `${reportTypeInfo.color}10`,
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  color: reportTypeInfo.color,
                  fontWeight: 500
                }}
              >
                <Cpu style={{ height: '0.75rem', width: '0.75rem' }} />
                {reportTypeInfo.label}
              </span>

              {/* Estimated time */}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.3125rem 0.625rem',
                  backgroundColor: COLORS.bgPage,
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  color: COLORS.textSecondary,
                  fontWeight: 500
                }}
              >
                <Clock style={{ height: '0.75rem', width: '0.75rem' }} />
                30–60 seconds
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: COLORS.white,
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: COLORS.textSecondary,
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.borderLight}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!hasRequiredData}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: hasRequiredData ? COLORS.slainteBlue : COLORS.borderLight,
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  cursor: hasRequiredData ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (hasRequiredData) e.currentTarget.style.backgroundColor = COLORS.slainteBlueDark;
                }}
                onMouseLeave={(e) => {
                  if (hasRequiredData) e.currentTarget.style.backgroundColor = COLORS.slainteBlue;
                }}
              >
                Generate Report
              </button>
            </div>
          </div>
        )}

        {/* Submitted State — brief confirmation, auto-closes */}
        {status === 'submitted' && (
          <div style={{
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            textAlign: 'center'
          }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              backgroundColor: `${COLORS.incomeColor}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Send style={{ height: '1.25rem', width: '1.25rem', color: COLORS.incomeColor }} />
            </div>
            <div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: COLORS.textPrimary,
                margin: '0 0 0.5rem'
              }}>
                Report generation started
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.textSecondary,
                margin: 0,
                lineHeight: 1.5,
                maxWidth: '380px'
              }}>
                This usually takes 30–60 seconds. Your report will appear in <strong style={{ color: COLORS.textPrimary }}>Your Reports</strong> when it's ready, and Finn will notify you.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div style={{
            padding: '3rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            textAlign: 'center'
          }}>
            <div style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '50%',
              backgroundColor: `${COLORS.expenseColor}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertCircle style={{ height: '1.75rem', width: '1.75rem', color: COLORS.expenseColor }} />
            </div>
            <div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: COLORS.textPrimary,
                margin: '0 0 0.375rem'
              }}>
                Something went wrong
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.textSecondary,
                margin: 0,
                maxWidth: '360px'
              }}>
                {errorMessage}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: COLORS.white,
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: COLORS.textSecondary,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                onClick={() => { setStatus('preview'); setErrorMessage(''); }}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: COLORS.slainteBlue,
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPreviewModal;
