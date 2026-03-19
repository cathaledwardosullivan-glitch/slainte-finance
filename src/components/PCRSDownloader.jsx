import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader, X, Shield, Clock, Users, PlayCircle, Calendar } from 'lucide-react';
import COLORS from '../utils/colors';
import { useFinnSafe } from '../context/FinnContext';

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

// Format month string for display (e.g., "202501" -> "Jan 2025")
const formatMonth = (monthStr) => {
  if (!monthStr || monthStr.length !== 6) return monthStr;
  const year = monthStr.substring(0, 4);
  const month = parseInt(monthStr.substring(4, 6), 10);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1]} ${year}`;
};

/**
 * PCRSDownloader Component
 * Modal for downloading PCRS statements using embedded BrowserView authentication
 */
export default function PCRSDownloader({
  isOpen,
  onClose,
  onStatementsDownloaded,
  defaultMode = 'latest',
  defaultQuickSelect = 'latest'  // 'latest', '6', '12', '24', 'all'
}) {
  const [status, setStatus] = useState('idle'); // idle, checking, login-required, authenticated, downloading, complete, error
  const [panels, setPanels] = useState([]);
  const [selectedPanels, setSelectedPanels] = useState([]);
  const [downloadResults, setDownloadResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentAction, setCurrentAction] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);

  // Initialize download mode and months based on default props
  const getInitialMode = () => defaultQuickSelect === 'latest' ? 'latest' : 'bulk';
  const getInitialMonths = () => {
    if (defaultQuickSelect === 'latest') return ['latest'];
    const numMonths = defaultQuickSelect === 'all' ? 36 : parseInt(defaultQuickSelect, 10);
    return generateMonthRange(numMonths);
  };

  // Download mode: 'latest' (single month) or 'bulk' (multiple months)
  const [downloadMode, setDownloadMode] = useState(getInitialMode);
  // Selected months for bulk download (YYYYMM format)
  const [selectedMonths, setSelectedMonths] = useState(getInitialMonths);
  // Quick select option: 'latest', '6', '12', '24', 'all'
  const [quickSelect, setQuickSelect] = useState(defaultQuickSelect);

  // Get Finn context for background downloads (may be null if outside FinnProvider)
  const finnContext = useFinnSafe();
  const startPCRSDownload = finnContext?.startPCRSDownload;
  const backgroundTask = finnContext?.backgroundTask;
  const TASK_TYPES = finnContext?.TASK_TYPES;
  const TASK_STATUS = finnContext?.TASK_STATUS;

  // Check if a PCRS download is already running in background
  const isBackgroundDownloadRunning = !!finnContext && backgroundTask?.type === TASK_TYPES?.PCRS_DOWNLOAD &&
    backgroundTask?.status === TASK_STATUS?.RUNNING;

  // Check if background download feature is available
  const backgroundDownloadAvailable = !!startPCRSDownload;

  useEffect(() => {
    if (!isOpen) return;

    // Check session on mount
    checkSession();

    // Set up event listeners
    const handleStatus = (data) => {
      handleStatusUpdate(data);
    };

    const handleAuthChange = (data) => {
      if (data.authenticated) {
        setStatus('authenticated');
        fetchPanels();
      }
    };

    // Forward main process logs to DevTools console
    const handleLog = (data) => {
      console.log(data.message);
    };

    if (window.electronAPI?.pcrs) {
      window.electronAPI.pcrs.onStatus(handleStatus);
      window.electronAPI.pcrs.onAuthStateChanged(handleAuthChange);
      window.electronAPI.pcrs.onLog(handleLog);
    }

    return () => {
      // Clean up listeners
      if (window.electronAPI?.pcrs) {
        window.electronAPI.pcrs.removeStatusListener();
        window.electronAPI.pcrs.removeAuthListener();
        window.electronAPI.pcrs.removeLogListener();
      }
    };
  }, [isOpen]);

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
        setCurrentAction(`Downloading: ${data.panel} - ${data.month}`);
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
      setStatus('error');
      setErrorMessage('PCRS automation is only available in the desktop app');
      return;
    }

    setStatus('checking');
    setCurrentAction('Checking for existing session...');

    try {
      const sessionStatus = await window.electronAPI.pcrs.checkSession();
      setSessionInfo(sessionStatus);

      if (sessionStatus.valid) {
        // Valid session exists, try to restore it
        const result = await window.electronAPI.pcrs.start({ forceNewSession: false });

        if (!result.needsLogin) {
          setStatus('authenticated');
          fetchPanels();
        } else {
          setStatus('login-required');
        }
      } else {
        // No valid session, show login
        await startLogin();
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

  // Handle quick select change for month range
  const handleQuickSelect = (option) => {
    setQuickSelect(option);
    if (option === 'latest') {
      setDownloadMode('latest');
      setSelectedMonths(['latest']);
    } else {
      setDownloadMode('bulk');
      const numMonths = option === 'all' ? 36 : parseInt(option, 10); // 'all' = 3 years
      setSelectedMonths(generateMonthRange(numMonths));
    }
  };

  // Estimate download time based on selections
  const getTimeEstimate = () => {
    if (downloadMode === 'latest') return null;
    const numFiles = selectedPanels.length * selectedMonths.length;
    const minSeconds = numFiles * 3; // Optimistic: 3 sec per file
    const maxSeconds = numFiles * 8; // Pessimistic: 8 sec per file
    const minMinutes = Math.ceil(minSeconds / 60);
    const maxMinutes = Math.ceil(maxSeconds / 60);
    if (maxMinutes <= 1) return 'Less than a minute';
    if (minMinutes === maxMinutes) return `About ${minMinutes} minutes`;
    return `${minMinutes}-${maxMinutes} minutes`;
  };

  const startDownload = async () => {
    if (selectedPanels.length === 0) return;

    setStatus('downloading');
    const monthCount = downloadMode === 'bulk' ? selectedMonths.length : 1;
    setCurrentAction(`Starting download (${monthCount} month${monthCount > 1 ? 's' : ''})...`);

    try {
      const panelsToDownload = panels.filter(p => selectedPanels.includes(p.id));
      const result = await window.electronAPI.pcrs.downloadStatements({
        panels: panelsToDownload,
        months: selectedMonths
      });

      if (result.success) {
        setDownloadResults(result.results);
        setStatus('complete');

        if (onStatementsDownloaded) {
          const successfulDownloads = result.results.filter(r => r.success);
          onStatementsDownloaded(successfulDownloads);
        }
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Download failed');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Download failed');
    }
  };

  // Start download in background and let Finn handle notifications
  const startBackgroundDownload = async () => {
    if (selectedPanels.length === 0) return;

    const panelsToDownload = panels.filter(p => selectedPanels.includes(p.id));

    // Start background download via FinnContext
    const started = await startPCRSDownload({
      panels: panelsToDownload,
      months: selectedMonths
    });

    if (started) {
      // Close the modal - Finn will handle the rest
      if (onClose) onClose();
    }
  };

  const handleClose = async () => {
    if (window.electronAPI?.pcrs) {
      await window.electronAPI.pcrs.close();
    }
    if (onClose) onClose();
  };

  const handleClearSession = async () => {
    if (window.electronAPI?.pcrs) {
      await window.electronAPI.pcrs.clearSession();
      setSessionInfo(null);
      await startLogin();
    }
  };

  if (!isOpen) return null;

  // When BrowserView is showing for login, render a simple control bar instead of modal
  if (status === 'login-required') {
    return (
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.white,
        borderTop: `2px solid ${COLORS.slainteBlue}`,
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 9999,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Shield style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: COLORS.textPrimary }}>
              Log in to PCRS Portal
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: COLORS.textSecondary }}>
              Enter your credentials above. Your login details are not stored by this app.
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: COLORS.expenseColor,
            color: COLORS.white,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <X style={{ width: '16px', height: '16px' }} />
          Cancel
        </button>
      </div>
    );
  }

  const renderContent = () => {
    switch (status) {
      case 'idle':
      case 'checking':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <Loader
              style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, marginBottom: '1rem' }}
              className="animate-spin"
            />
            <p style={{ color: COLORS.textSecondary }}>{currentAction || 'Initializing...'}</p>
          </div>
        );

      case 'authenticated':
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              backgroundColor: COLORS.successLighter,
              border: `1px solid ${COLORS.success}`,
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle style={{ width: '20px', height: '20px', color: COLORS.successDark, marginRight: '0.5rem' }} />
                <span style={{ color: COLORS.successText, fontWeight: '500' }}>Connected to PCRS</span>
              </div>
            </div>

            {panels.length > 1 && (
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontWeight: '500', color: COLORS.textPrimary, marginBottom: '0.5rem' }}>
                  <Users style={{ width: '16px', height: '16px', display: 'inline', marginRight: '0.5rem' }} />
                  Select Panels to Download
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {panels.map(panel => (
                    <label
                      key={panel.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem',
                        backgroundColor: COLORS.bgPage,
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
                      <span style={{ color: COLORS.textPrimary }}>
                        {panel.displayName || panel.fullName || `Panel ${panel.id}`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Month Range Selection */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontWeight: '500', color: COLORS.textPrimary, marginBottom: '0.5rem' }}>
                <Calendar style={{ width: '16px', height: '16px', display: 'inline', marginRight: '0.5rem' }} />
                Download Range
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {[
                  { value: 'latest', label: 'Latest Month' },
                  { value: '6', label: 'Last 6 Months' },
                  { value: '12', label: 'Last 12 Months' },
                  { value: '24', label: 'Last 24 Months' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleQuickSelect(option.value)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      border: quickSelect === option.value
                        ? `2px solid ${COLORS.slainteBlue}`
                        : `1px solid ${COLORS.borderLight}`,
                      backgroundColor: quickSelect === option.value
                        ? `${COLORS.slainteBlue}15`
                        : COLORS.white,
                      color: quickSelect === option.value
                        ? COLORS.slainteBlue
                        : COLORS.textPrimary,
                      cursor: 'pointer',
                      fontWeight: quickSelect === option.value ? '600' : '400',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {downloadMode === 'bulk' && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: `${COLORS.slainteBlue}10`,
                  borderRadius: '8px',
                  fontSize: '0.8125rem'
                }}>
                  <div style={{ color: COLORS.textPrimary, marginBottom: '0.25rem' }}>
                    <strong>{selectedMonths.length}</strong> months selected
                    ({formatMonth(selectedMonths[selectedMonths.length - 1])} to {formatMonth(selectedMonths[0])})
                  </div>
                  {getTimeEstimate() && (
                    <div style={{ color: COLORS.textSecondary, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock style={{ width: '12px', height: '12px' }} />
                      Estimated time: {getTimeEstimate()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Show message if background download is already running */}
            {backgroundDownloadAvailable && isBackgroundDownloadRunning && (
              <div style={{
                backgroundColor: COLORS.warningLight,
                border: `1px solid ${COLORS.warning}`,
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Loader style={{ width: '16px', height: '16px', color: COLORS.warningDark }} className="animate-spin" />
                <span style={{ color: COLORS.warningText, fontSize: '0.875rem' }}>
                  A background download is already in progress. Finn will notify you when it's done.
                </span>
              </div>
            )}

            {/* Download buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={startDownload}
                disabled={selectedPanels.length === 0 || isBackgroundDownloadRunning}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  backgroundColor: (selectedPanels.length === 0 || isBackgroundDownloadRunning) ? COLORS.borderLight : COLORS.slainteBlue,
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (selectedPanels.length === 0 || isBackgroundDownloadRunning) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '500'
                }}
              >
                <Download style={{ width: '18px', height: '18px', marginRight: '0.5rem' }} />
                {downloadMode === 'bulk'
                  ? `Download ${selectedMonths.length} Months`
                  : (backgroundDownloadAvailable ? 'Download Now' : 'Download Latest')}
              </button>
              {backgroundDownloadAvailable && (
                <button
                  onClick={startBackgroundDownload}
                  disabled={selectedPanels.length === 0 || isBackgroundDownloadRunning}
                  title="Download in background - Finn will notify you when done"
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    backgroundColor: (selectedPanels.length === 0 || isBackgroundDownloadRunning) ? COLORS.borderLight : COLORS.incomeColor,
                    color: COLORS.white,
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (selectedPanels.length === 0 || isBackgroundDownloadRunning) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '500'
                  }}
                >
                  <PlayCircle style={{ width: '18px', height: '18px', marginRight: '0.5rem' }} />
                  Download in Background
                </button>
              )}
            </div>
            {backgroundDownloadAvailable && (
              <p style={{
                fontSize: '0.75rem',
                color: COLORS.textSecondary,
                marginTop: '0.5rem',
                textAlign: 'center'
              }}>
                Use "Download in Background" to continue using the app while statements download.
              </p>
            )}
          </div>
        );

      case 'downloading':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <Loader
              style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, marginBottom: '1rem' }}
              className="animate-spin"
            />
            <p style={{ color: COLORS.textPrimary, fontWeight: '500' }}>{currentAction}</p>
          </div>
        );

      case 'complete':
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              backgroundColor: COLORS.successLighter,
              border: `1px solid ${COLORS.success}`,
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle style={{ width: '20px', height: '20px', color: COLORS.successDark, marginRight: '0.5rem' }} />
                <span style={{ color: COLORS.successText, fontWeight: '500' }}>Download Complete</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {downloadResults.map((result, index) => (
                <div
                  key={index}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: result.success ? COLORS.successLighter : COLORS.errorLight
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: result.success ? COLORS.successText : COLORS.errorText }}>
                      {result.panelName}
                    </span>
                    {result.success ? (
                      <CheckCircle style={{ width: '16px', height: '16px', color: COLORS.successDark }} />
                    ) : (
                      <AlertCircle style={{ width: '16px', height: '16px', color: COLORS.error }} />
                    )}
                  </div>
                  {result.filename && (
                    <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginTop: '0.25rem', marginBottom: 0 }}>
                      {result.filename}
                    </p>
                  )}
                  {result.error && (
                    <p style={{ fontSize: '0.875rem', color: COLORS.error, marginTop: '0.25rem', marginBottom: 0 }}>
                      {result.error}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleClose}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                backgroundColor: COLORS.slainteBlue,
                color: COLORS.white,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Done
            </button>
          </div>
        );

      case 'error':
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              backgroundColor: COLORS.errorLight,
              border: `1px solid ${COLORS.error}`,
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <AlertCircle style={{ width: '20px', height: '20px', color: COLORS.error, marginRight: '0.5rem', marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontWeight: '500', color: COLORS.errorText, margin: 0 }}>Error</h4>
                  <p style={{ fontSize: '0.875rem', color: COLORS.errorDark, marginTop: '0.25rem', marginBottom: 0 }}>
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={startLogin}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: '8px',
                  backgroundColor: COLORS.white,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <RefreshCw style={{ width: '16px', height: '16px', marginRight: '0.5rem' }} />
                Try Again
              </button>
              <button
                onClick={handleClose}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  backgroundColor: COLORS.textSecondary,
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: COLORS.overlayDark,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }} onClick={handleClose}>
      <div
        style={{
          backgroundColor: COLORS.white,
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          borderBottom: `1px solid ${COLORS.borderLight}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Download style={{ width: '20px', height: '20px', color: COLORS.slainteBlue, marginRight: '0.5rem' }} />
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: COLORS.textPrimary, margin: 0 }}>
              Download PCRS Statements
            </h2>
          </div>
          <button
            onClick={handleClose}
            style={{
              padding: '0.25rem',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer'
            }}
          >
            <X style={{ width: '20px', height: '20px', color: COLORS.textSecondary }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>
          {renderContent()}
        </div>

        {/* Session info footer (when authenticated) */}
        {sessionInfo?.valid && status === 'authenticated' && (
          <div style={{
            padding: '0.75rem 1.5rem',
            borderTop: `1px solid ${COLORS.borderLight}`,
            backgroundColor: COLORS.bgPage,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: COLORS.textSecondary }}>
              <Clock style={{ width: '14px', height: '14px', marginRight: '0.25rem' }} />
              Session expires in {sessionInfo.remainingHours} hours
            </div>
            <button
              onClick={handleClearSession}
              style={{
                fontSize: '0.75rem',
                color: COLORS.slainteBlue,
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
