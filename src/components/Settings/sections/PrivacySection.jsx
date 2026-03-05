import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { Shield, ShieldOff, ChevronDown, ChevronUp, Trash2, FileText, Wifi, WifiOff, X, AlertTriangle } from 'lucide-react';
import COLORS from '../../../utils/colors';
import { FULL_TERMS } from '../../../data/termsAndConditions';
import { FULL_PRIVACY_POLICY } from '../../../data/privacyPolicy';

const PrivacySection = () => {
  const { localOnlyMode, setLocalOnlyMode } = useAppContext();
  const [showDataDetails, setShowDataDetails] = useState(false);
  const [showConfirmToggle, setShowConfirmToggle] = useState(false);
  const [chatCleared, setChatCleared] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [errorReporting, setErrorReporting] = useState(true);

  useEffect(() => {
    if (window.electronAPI?.getErrorReportingSetting) {
      window.electronAPI.getErrorReportingSetting().then(setErrorReporting);
    }
  }, []);

  const handleToggleErrorReporting = async (enabled) => {
    setErrorReporting(enabled);
    if (window.electronAPI?.setErrorReportingSetting) {
      await window.electronAPI.setErrorReportingSetting(enabled);
    }
  };

  const handleToggleLocalOnly = () => {
    if (!localOnlyMode) {
      // Enabling local only — show confirmation
      setShowConfirmToggle(true);
    } else {
      // Disabling local only — no confirmation needed
      setLocalOnlyMode(false);
      setShowConfirmToggle(false);
    }
  };

  const confirmEnableLocalOnly = () => {
    setLocalOnlyMode(true);
    setShowConfirmToggle(false);
  };

  const handleClearChatHistory = () => {
    if (window.confirm('Clear all Finn chat history? This cannot be undone.')) {
      localStorage.removeItem('ciaran_chats');
      localStorage.removeItem('ciaran_current_chat_id');
      setChatCleared(true);
      setTimeout(() => setChatCleared(false), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Local Only Mode Toggle */}
      <div style={{
        padding: '1.25rem',
        borderRadius: '0.5rem',
        border: `2px solid ${localOnlyMode ? COLORS.incomeColor : COLORS.slainteBlue}`,
        backgroundColor: localOnlyMode ? 'rgba(78, 205, 196, 0.05)' : 'rgba(74, 144, 226, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {localOnlyMode ? (
              <ShieldOff size={24} color={COLORS.incomeColor} />
            ) : (
              <Shield size={24} color={COLORS.slainteBlue} />
            )}
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Local Only Mode</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.darkGray }}>
                {localOnlyMode ? 'Active — no external connections' : 'Off — AI features enabled'}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleToggleLocalOnly}
            style={{
              width: '52px',
              height: '28px',
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: localOnlyMode ? COLORS.incomeColor : COLORS.lightGray,
              position: 'relative',
              transition: 'background-color 0.2s'
            }}
          >
            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: COLORS.white,
              position: 'absolute',
              top: '3px',
              left: localOnlyMode ? '27px' : '3px',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </button>
        </div>

        {/* Confirmation dialog when enabling */}
        {showConfirmToggle && (
          <div style={{
            marginTop: '0.75rem',
            padding: '1rem',
            borderRadius: '0.375rem',
            backgroundColor: 'rgba(255, 210, 60, 0.1)',
            border: `1px solid ${COLORS.highlightYellow}`
          }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Enabling Local Only Mode will disable:
            </p>
            <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem', fontSize: '0.85rem', color: COLORS.darkGray }}>
              <li>Finn chat and AI-generated reports</li>
              <li>AI-assisted transaction categorisation</li>
              <li>Website analysis during setup</li>
              <li>Automated PCRS statement downloads</li>
            </ul>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: COLORS.darkGray }}>
              All other features continue to work. You can re-enable AI features at any time.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={confirmEnableLocalOnly}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: '0.25rem',
                  border: 'none',
                  backgroundColor: COLORS.incomeColor,
                  color: COLORS.white,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Enable Local Only
              </button>
              <button
                onClick={() => setShowConfirmToggle(false)}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: '0.25rem',
                  border: `1px solid ${COLORS.lightGray}`,
                  backgroundColor: COLORS.white,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Status description */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.25rem',
          backgroundColor: localOnlyMode ? 'rgba(78, 205, 196, 0.1)' : 'rgba(74, 144, 226, 0.1)',
          marginTop: showConfirmToggle ? 0 : '0.5rem'
        }}>
          {localOnlyMode ? <WifiOff size={16} color={COLORS.incomeColor} /> : <Wifi size={16} color={COLORS.slainteBlue} />}
          <span style={{ fontSize: '0.85rem', color: localOnlyMode ? COLORS.incomeColor : COLORS.slainteBlue, fontWeight: 500 }}>
            {localOnlyMode
              ? 'No data leaves your device. PCRS downloads available manually from pcrs.ie.'
              : 'AI features active. Financial summaries sent securely to Anthropic.'
            }
          </span>
        </div>
      </div>

      {/* Error Reporting Toggle */}
      <div style={{
        padding: '1.25rem',
        borderRadius: '0.5rem',
        border: `1px solid ${COLORS.lightGray}`,
        backgroundColor: 'rgba(74, 144, 226, 0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={22} color={errorReporting ? COLORS.slainteBlue : COLORS.mediumGray} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Automatic Error Reports</h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: COLORS.darkGray }}>
                {errorReporting
                  ? 'Anonymous error reports help us improve the app'
                  : 'Error reporting is disabled'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleToggleErrorReporting(!errorReporting)}
            style={{
              width: '52px',
              height: '28px',
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: errorReporting ? COLORS.slainteBlue : COLORS.lightGray,
              position: 'relative',
              transition: 'background-color 0.2s'
            }}
          >
            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: COLORS.white,
              position: 'absolute',
              top: '3px',
              left: errorReporting ? '27px' : '3px',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </button>
        </div>
        <p style={{
          margin: '0.75rem 0 0',
          fontSize: '0.8rem',
          color: COLORS.mediumGray,
          lineHeight: 1.5
        }}>
          When enabled, crash reports and error details are sent automatically to help us fix issues faster.
          Reports include error type, app version, and your Practice ID only — no financial data, transactions, or personal information.
        </p>
      </div>

      {/* What Finn Knows — Expandable */}
      {!localOnlyMode && (
        <div style={{
          border: `1px solid ${COLORS.lightGray}`,
          borderRadius: '0.5rem',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setShowDataDetails(!showDataDetails)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            <span>What data is sent to Anthropic?</span>
            {showDataDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {showDataDetails && (
            <div style={{ padding: '0 1rem 1rem', fontSize: '0.85rem', color: COLORS.darkGray }}>
              <p style={{ margin: '0 0 0.75rem', fontWeight: 500 }}>When you use Finn or AI features:</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: `1px solid ${COLORS.lightGray}`, color: COLORS.slainteBlue }}>
                      Sent securely
                    </th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: `1px solid ${COLORS.lightGray}`, color: COLORS.incomeColor }}>
                      Never sent
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Your questions to Finn', 'Bank account numbers'],
                    ['Aggregated totals & categories', 'Patient data'],
                    ['Practice name & staff names', 'PCRS login credentials'],
                    ['GMS payment amounts', 'Sort codes or IBANs'],
                    ['Transaction descriptions (uncategorised)', 'Raw bank statement files'],
                    ['Monthly trends', 'Passwords or API keys']
                  ].map(([sent, never], i) => (
                    <tr key={i}>
                      <td style={{ padding: '0.3rem 0.5rem', borderBottom: `1px solid ${COLORS.veryLightGray || '#f0f0f0'}` }}>{sent}</td>
                      <td style={{ padding: '0.3rem 0.5rem', borderBottom: `1px solid ${COLORS.veryLightGray || '#f0f0f0'}` }}>{never}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', fontStyle: 'italic' }}>
                Your data is not used to train AI models, per Anthropic's API terms.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Data Management */}
      <div style={{
        border: `1px solid ${COLORS.lightGray}`,
        borderRadius: '0.5rem',
        padding: '1rem'
      }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 500 }}>Data Management</h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Clear Chat History */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Finn Chat History</span>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: COLORS.darkGray }}>
                Delete all conversations with Finn
              </p>
            </div>
            <button
              onClick={handleClearChatHistory}
              disabled={chatCleared}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.25rem',
                border: `1px solid ${chatCleared ? COLORS.incomeColor : COLORS.expenseColor}`,
                backgroundColor: 'transparent',
                color: chatCleared ? COLORS.incomeColor : COLORS.expenseColor,
                cursor: chatCleared ? 'default' : 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Trash2 size={14} />
              {chatCleared ? 'Cleared' : 'Clear'}
            </button>
          </div>

          {/* View Terms of Service */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Terms of Service</span>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: COLORS.darkGray }}>
                Review the full terms document
              </p>
            </div>
            <button
              onClick={() => setShowTerms(true)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.25rem',
                border: `1px solid ${COLORS.slainteBlue}`,
                backgroundColor: 'transparent',
                color: COLORS.slainteBlue,
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <FileText size={14} />
              View
            </button>
          </div>

          {/* View Privacy Policy */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Privacy Policy</span>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: COLORS.darkGray }}>
                Review how your data is handled
              </p>
            </div>
            <button
              onClick={() => setShowPrivacyPolicy(true)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.25rem',
                border: `1px solid ${COLORS.slainteBlue}`,
                backgroundColor: 'transparent',
                color: COLORS.slainteBlue,
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <FileText size={14} />
              View
            </button>
          </div>
        </div>
      </div>

      {/* Terms of Service Modal */}
      {showTerms && (
        <div
          onClick={() => setShowTerms(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: COLORS.white,
              borderRadius: '0.75rem',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: `1px solid ${COLORS.lightGray}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} color={COLORS.slainteBlue} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Terms of Service</h3>
              </div>
              <button
                onClick={() => setShowTerms(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  borderRadius: '0.25rem',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} color={COLORS.mediumGray} />
              </button>
            </div>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem',
              fontSize: '0.8125rem',
              lineHeight: 1.7,
              color: COLORS.darkGray,
              whiteSpace: 'pre-wrap',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {FULL_TERMS}
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyPolicy && (
        <div
          onClick={() => setShowPrivacyPolicy(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: COLORS.white,
              borderRadius: '0.75rem',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: `1px solid ${COLORS.lightGray}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={20} color={COLORS.slainteBlue} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Privacy Policy</h3>
              </div>
              <button
                onClick={() => setShowPrivacyPolicy(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  borderRadius: '0.25rem',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} color={COLORS.mediumGray} />
              </button>
            </div>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem',
              fontSize: '0.8125rem',
              lineHeight: 1.7,
              color: COLORS.darkGray,
              whiteSpace: 'pre-wrap',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {FULL_PRIVACY_POLICY}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacySection;
