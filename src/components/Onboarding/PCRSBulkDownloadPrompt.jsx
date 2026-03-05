import React, { useState, useEffect } from 'react';
import {
  User,
  MessageCircle,
  Download,
  ArrowRight,
  SkipForward,
  CheckCircle,
  Loader,
  Shield,
  Calendar,
  Clock,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import COLORS from '../../utils/colors';

// Instant text display (typing animation disabled)
const useTypingEffect = (text) => {
  return { displayedText: text || '', isComplete: true };
};

// Generate array of month strings (YYYYMM format) for the last N months
const generateMonthRange = (numMonths) => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < numMonths; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    months.push(`${year}${month}`);
  }
  return months;
};

// Format month string for display
const formatMonth = (monthStr) => {
  if (!monthStr || monthStr.length !== 6) return monthStr;
  const year = monthStr.substring(0, 4);
  const month = parseInt(monthStr.substring(4, 6), 10);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1]} ${year}`;
};

export default function PCRSBulkDownloadPrompt({ onComplete, onSkip }) {
  // PCRS state
  const [status, setStatus] = useState('idle'); // idle, checking, login-required, authenticated, downloading, complete, error
  const [panels, setPanels] = useState([]);
  const [selectedPanels, setSelectedPanels] = useState([]);
  const [downloadResults, setDownloadResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentAction, setCurrentAction] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);

  // Month selection
  const [quickSelect, setQuickSelect] = useState('24');
  const [selectedMonths, setSelectedMonths] = useState(generateMonthRange(24));

  // Animation states
  const [isReady, setIsReady] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Messages
  const greetingText = "One more thing! Let's download your PCRS payment history.";
  const messageText = "You've uploaded 24 months of bank statements. Now let's match that with your PCRS payment data for comprehensive GMS analysis.";

  const { displayedText: greeting, isComplete: greetingComplete } = useTypingEffect(showGreeting ? greetingText : '', 25);
  const { displayedText: message, isComplete: messageComplete } = useTypingEffect(showMessage ? messageText : '', 15);

  // Animation sequence
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => setShowGreeting(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  useEffect(() => {
    if (greetingComplete) {
      const timer = setTimeout(() => setShowMessage(true), 200);
      return () => clearTimeout(timer);
    }
  }, [greetingComplete]);

  useEffect(() => {
    if (messageComplete) {
      const timer = setTimeout(() => setShowControls(true), 300);
      return () => clearTimeout(timer);
    }
  }, [messageComplete]);

  // Check session on controls ready
  useEffect(() => {
    if (showControls && status === 'idle') {
      checkSession();
    }
  }, [showControls]);

  // Set up PCRS event listeners
  useEffect(() => {
    const handleStatus = (data) => {
      handleStatusUpdate(data);
    };

    const handleAuthChange = (data) => {
      if (data.authenticated) {
        setStatus('authenticated');
        fetchPanels();
      }
    };

    if (window.electronAPI?.pcrs) {
      window.electronAPI.pcrs.onStatus(handleStatus);
      window.electronAPI.pcrs.onAuthStateChanged(handleAuthChange);
    }

    return () => {
      if (window.electronAPI?.pcrs) {
        window.electronAPI.pcrs.removeStatusListener();
        window.electronAPI.pcrs.removeAuthListener();
      }
    };
  }, []);

  const handleStatusUpdate = (data) => {
    switch (data.status) {
      case 'session-restored':
        setStatus('authenticated');
        setCurrentAction('Session restored');
        fetchPanels();
        break;
      case 'login-success':
        setStatus('authenticated');
        setCurrentAction('Login successful');
        fetchPanels();
        break;
      case 'switching-panel':
        setCurrentAction(`Switching to: ${data.panel}`);
        break;
      case 'downloading':
        setCurrentAction(`Downloading: ${data.panel} - ${formatMonth(data.month)}`);
        break;
      case 'complete':
        setStatus('complete');
        setDownloadResults(data.results || []);
        break;
      case 'error':
        setStatus('error');
        setErrorMessage(data.error || 'An error occurred');
        break;
      default:
        break;
    }
  };

  const checkSession = async () => {
    if (!window.electronAPI?.pcrs) {
      setStatus('not-available');
      return;
    }

    setStatus('checking');
    setCurrentAction('Checking for existing session...');

    try {
      const sessionStatus = await window.electronAPI.pcrs.checkSession();
      setSessionInfo(sessionStatus);

      if (sessionStatus.valid) {
        const result = await window.electronAPI.pcrs.start({ forceNewSession: false });
        if (!result.needsLogin) {
          setStatus('authenticated');
          fetchPanels();
        } else {
          setStatus('login-required');
        }
      } else {
        setStatus('login-required');
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to check session');
    }
  };

  const startLogin = async () => {
    setStatus('login-required');
    setCurrentAction('Please log in to PCRS portal');

    try {
      await window.electronAPI.pcrs.start({ forceNewSession: true });
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Failed to start login');
    }
  };

  const fetchPanels = async () => {
    setCurrentAction('Fetching available panels...');

    try {
      const result = await window.electronAPI.pcrs.getPanels();
      if (result.success && result.panels.length > 0) {
        setPanels(result.panels);
        setSelectedPanels(result.panels.map(p => p.id));
      } else if (!result.success) {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to fetch panels');
      }
    } catch (error) {
      console.error('Failed to fetch panels:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to fetch panels');
    }
  };

  const togglePanel = (panelId) => {
    setSelectedPanels(prev =>
      prev.includes(panelId)
        ? prev.filter(id => id !== panelId)
        : [...prev, panelId]
    );
  };

  const handleQuickSelect = (option) => {
    setQuickSelect(option);
    const numMonths = parseInt(option, 10);
    setSelectedMonths(generateMonthRange(numMonths));
  };

  const getTimeEstimate = () => {
    const numFiles = selectedPanels.length * selectedMonths.length;
    const minSeconds = numFiles * 3;
    const maxSeconds = numFiles * 8;
    const minMinutes = Math.ceil(minSeconds / 60);
    const maxMinutes = Math.ceil(maxSeconds / 60);
    if (maxMinutes <= 1) return 'Less than a minute';
    if (minMinutes === maxMinutes) return `About ${minMinutes} minutes`;
    return `${minMinutes}-${maxMinutes} minutes`;
  };

  const startDownload = async () => {
    if (selectedPanels.length === 0) return;

    setStatus('downloading');
    setCurrentAction(`Starting download (${selectedMonths.length} months)...`);

    try {
      const panelsToDownload = panels.filter(p => selectedPanels.includes(p.id));
      const result = await window.electronAPI.pcrs.downloadStatements({
        panels: panelsToDownload,
        months: selectedMonths
      });

      if (result.success) {
        setDownloadResults(result.results);
        setStatus('complete');
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Download failed');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Download failed');
    }
  };

  const handleContinue = () => {
    if (onComplete) {
      onComplete({
        downloadedFiles: downloadResults.filter(r => r.success),
        skipped: false
      });
    }
  };

  const handleSkip = async () => {
    if (window.electronAPI?.pcrs) {
      await window.electronAPI.pcrs.close();
    }
    if (onSkip) {
      onSkip();
    }
  };

  if (!isReady) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Loader style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: COLORS.mediumGray }}>Preparing PCRS download...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // When BrowserView is showing for login
  if (status === 'login-required') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        minHeight: '400px'
      }}>
        <Shield style={{ width: '48px', height: '48px', color: COLORS.slainteBlue, marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.5rem' }}>
          Log in to PCRS Portal
        </h3>
        <p style={{ color: COLORS.mediumGray, textAlign: 'center', marginBottom: '1.5rem' }}>
          A login window has opened. Enter your PCRS credentials to continue.
          <br />
          Your login details are not stored by this app.
        </p>
        <button
          onClick={handleSkip}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: COLORS.expenseColor,
            color: COLORS.white,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Cancel & Skip
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      alignItems: 'flex-start',
      maxWidth: '1600px',
      margin: '0 auto',
      height: 'min(75vh, 700px)'
    }}>
      {/* Left side - Finn Chat Box */}
      <div style={{
        flex: '1 1 45%',
        minWidth: '400px',
        maxWidth: '550px',
        height: '100%',
        backgroundColor: COLORS.white,
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: `1px solid ${COLORS.lightGray}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Chat Header */}
        <div style={{
          backgroundColor: COLORS.slainteBlue,
          color: COLORS.white,
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            backgroundColor: COLORS.slainteBlueDark,
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User style={{ height: '1.25rem', width: '1.25rem' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>Finn</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Sláinte Guide</div>
          </div>
        </div>

        {/* Chat Messages Area */}
        <div style={{
          padding: '1.5rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          overflowY: 'auto'
        }}>
          {/* Greeting Message */}
          {showGreeting && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: COLORS.backgroundGray,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <MessageCircle style={{ width: '16px', height: '16px', color: COLORS.slainteBlue }} />
              </div>
              <div style={{
                backgroundColor: COLORS.backgroundGray,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: COLORS.darkGray
                }}>
                  {greeting}
                </div>
              </div>
            </div>
          )}

          {/* Explanation Message */}
          {showMessage && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: COLORS.backgroundGray,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{
                  fontSize: '0.9375rem',
                  color: COLORS.darkGray,
                  lineHeight: 1.5
                }}>
                  {message}
                </div>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {status === 'checking' && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.slainteBlue}10`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.slainteBlue}30`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: COLORS.darkGray,
                  fontSize: '0.9375rem'
                }}>
                  <Loader style={{ width: '18px', height: '18px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite' }} />
                  {currentAction || 'Checking connection...'}
                </div>
              </div>
            </div>
          )}

          {status === 'downloading' && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.slainteBlue}10`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.slainteBlue}30`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: COLORS.darkGray,
                  fontSize: '0.9375rem'
                }}>
                  <Loader style={{ width: '18px', height: '18px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite' }} />
                  {currentAction}
                </div>
              </div>
            </div>
          )}

          {status === 'complete' && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.incomeColor}15`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.incomeColor}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: COLORS.darkGray,
                  fontSize: '0.9375rem'
                }}>
                  <CheckCircle style={{ width: '18px', height: '18px', color: COLORS.incomeColor }} />
                  Downloaded {downloadResults.filter(r => r.success).length} statements successfully!
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: `${COLORS.expenseColor}15`,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                border: `1px solid ${COLORS.expenseColor}`
              }}>
                <div style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                  {errorMessage}
                </div>
              </div>
            </div>
          )}

          {status === 'not-available' && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', flexShrink: 0 }} />
              <div style={{
                backgroundColor: COLORS.backgroundGray,
                padding: '0.875rem 1rem',
                borderRadius: '12px',
                maxWidth: '85%'
              }}>
                <div style={{ fontSize: '0.875rem', color: COLORS.darkGray }}>
                  PCRS download is only available in the desktop app. You can access this feature later from Settings.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button at bottom */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${COLORS.lightGray}`,
          backgroundColor: COLORS.white
        }}>
          {status === 'complete' ? (
            <button
              onClick={handleContinue}
              style={{
                width: '100%',
                padding: '0.875rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: COLORS.white,
                backgroundColor: COLORS.slainteBlue,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              Continue
              <ArrowRight style={{ width: '18px', height: '18px' }} />
            </button>
          ) : (
            <button
              onClick={handleSkip}
              style={{
                width: '100%',
                padding: '0.875rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: COLORS.white,
                backgroundColor: COLORS.slainteBlue,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              Skip for Now
              <SkipForward style={{ width: '18px', height: '18px' }} />
            </button>
          )}
        </div>
      </div>

      {/* Right side - Controls */}
      <div style={{
        flex: '1 1 55%',
        minWidth: '450px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        opacity: showControls ? 1 : 0.3,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: showControls ? 'auto' : 'none',
        overflowY: 'auto'
      }}>
        {/* Main Card */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `3px solid ${COLORS.slainteBlue}`,
          borderRadius: '16px',
          padding: '1.5rem',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: `${COLORS.slainteBlue}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Download style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: COLORS.darkGray,
                marginBottom: '0.25rem'
              }}>
                PCRS Statement Download
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: COLORS.mediumGray,
                lineHeight: 1.5
              }}>
                Download your payment statements directly from the PCRS portal
              </p>
            </div>
          </div>

          {/* Authenticated state - show controls */}
          {status === 'authenticated' && (
            <>
              {/* Panel selection */}
              {panels.length > 1 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontWeight: 500, color: COLORS.darkGray, marginBottom: '0.5rem' }}>
                    Select Panels
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {panels.map(panel => (
                      <label
                        key={panel.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.75rem',
                          backgroundColor: COLORS.backgroundGray,
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPanels.includes(panel.id)}
                          onChange={() => togglePanel(panel.id)}
                          style={{ width: '16px', height: '16px', marginRight: '0.75rem' }}
                        />
                        <span style={{ color: COLORS.darkGray }}>
                          {panel.displayName || panel.fullName || `Panel ${panel.id}`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Month range selection */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 500, color: COLORS.darkGray, marginBottom: '0.5rem' }}>
                  <Calendar style={{ width: '14px', height: '14px', display: 'inline', marginRight: '0.5rem' }} />
                  Download Range
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[
                    { value: '6', label: '6 Months' },
                    { value: '12', label: '12 Months' },
                    { value: '24', label: '24 Months (Recommended)' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleQuickSelect(option.value)}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: quickSelect === option.value
                          ? `2px solid ${COLORS.slainteBlue}`
                          : `1px solid ${COLORS.lightGray}`,
                        backgroundColor: quickSelect === option.value
                          ? `${COLORS.slainteBlue}15`
                          : COLORS.white,
                        color: quickSelect === option.value
                          ? COLORS.slainteBlue
                          : COLORS.darkGray,
                        cursor: 'pointer',
                        fontWeight: quickSelect === option.value ? '600' : '400',
                        fontSize: '0.875rem'
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: `${COLORS.slainteBlue}10`,
                  borderRadius: '8px',
                  fontSize: '0.8125rem'
                }}>
                  <div style={{ color: COLORS.darkGray, marginBottom: '0.25rem' }}>
                    <strong>{selectedMonths.length}</strong> months
                    ({formatMonth(selectedMonths[selectedMonths.length - 1])} to {formatMonth(selectedMonths[0])})
                  </div>
                  <div style={{ color: COLORS.mediumGray, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock style={{ width: '12px', height: '12px' }} />
                    Estimated time: {getTimeEstimate()}
                  </div>
                </div>
              </div>

              {/* Download button */}
              <button
                onClick={startDownload}
                disabled={selectedPanels.length === 0}
                style={{
                  width: '100%',
                  padding: '1rem',
                  backgroundColor: selectedPanels.length === 0 ? COLORS.lightGray : COLORS.incomeColor,
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedPanels.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Download style={{ width: '18px', height: '18px' }} />
                Download {selectedMonths.length} Months
              </button>
            </>
          )}

          {/* Checking state */}
          {status === 'checking' && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
              <p style={{ color: COLORS.mediumGray }}>{currentAction || 'Connecting to PCRS...'}</p>
            </div>
          )}

          {/* Downloading state */}
          {status === 'downloading' && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
              <p style={{ color: COLORS.darkGray, fontWeight: 500, marginBottom: '0.5rem' }}>{currentAction}</p>
              <p style={{ color: COLORS.mediumGray, fontSize: '0.875rem' }}>This may take a few minutes...</p>
            </div>
          )}

          {/* Complete state */}
          {status === 'complete' && (
            <div>
              <div style={{
                backgroundColor: '#D1FAE5',
                border: '1px solid #10B981',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle style={{ width: '20px', height: '20px', color: '#059669', marginRight: '0.5rem' }} />
                  <span style={{ color: '#065F46', fontWeight: '500' }}>Download Complete</span>
                </div>
              </div>
              <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                {downloadResults.filter(r => r.success).length} of {downloadResults.length} statements downloaded successfully.
              </p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div>
              <div style={{
                backgroundColor: '#FEE2E2',
                border: '1px solid #DC2626',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <AlertCircle style={{ width: '20px', height: '20px', color: '#DC2626', marginRight: '0.5rem', marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontWeight: '500', color: '#991B1B', margin: 0 }}>Error</h4>
                    <p style={{ fontSize: '0.875rem', color: '#B91C1C', marginTop: '0.25rem', marginBottom: 0 }}>
                      {errorMessage}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={checkSession}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${COLORS.lightGray}`,
                  borderRadius: '8px',
                  backgroundColor: COLORS.white,
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Not available state */}
          {status === 'not-available' && (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              backgroundColor: COLORS.backgroundGray,
              borderRadius: '8px'
            }}>
              <Shield style={{ width: '32px', height: '32px', color: COLORS.mediumGray, margin: '0 auto 1rem' }} />
              <p style={{ color: COLORS.mediumGray }}>
                PCRS download requires the desktop app.
                <br />
                You can access this later from Settings.
              </p>
            </div>
          )}

          {/* Idle state */}
          {status === 'idle' && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
              <p style={{ color: COLORS.mediumGray }}>Initializing...</p>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div style={{
          backgroundColor: COLORS.white,
          border: `1px solid ${COLORS.lightGray}`,
          borderRadius: '12px',
          padding: '1rem'
        }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '0.5rem' }}>
            Why download PCRS statements?
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: COLORS.mediumGray, lineHeight: 1.6 }}>
            <li>Automatic GMS payment analysis and reconciliation</li>
            <li>Track capitation, fee items, and special items by panel</li>
            <li>Comprehensive Health Check metrics powered by real data</li>
            <li>Historical trends and year-over-year comparisons</li>
          </ul>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
