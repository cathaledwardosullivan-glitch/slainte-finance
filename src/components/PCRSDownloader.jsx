import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader, X, Shield, Clock, Users } from 'lucide-react';
import COLORS from '../utils/colors';

/**
 * PCRSDownloader Component
 * Modal for downloading PCRS statements using embedded BrowserView authentication
 */
export default function PCRSDownloader({ isOpen, onClose, onStatementsDownloaded }) {
  const [status, setStatus] = useState('idle'); // idle, checking, login-required, authenticated, downloading, complete, error
  const [panels, setPanels] = useState([]);
  const [selectedPanels, setSelectedPanels] = useState([]);
  const [downloadResults, setDownloadResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentAction, setCurrentAction] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);

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

    if (window.electronAPI?.pcrs) {
      window.electronAPI.pcrs.onStatus(handleStatus);
      window.electronAPI.pcrs.onAuthStateChanged(handleAuthChange);
    }

    return () => {
      // Clean up listeners
      if (window.electronAPI?.pcrs) {
        window.electronAPI.pcrs.removeStatusListener();
        window.electronAPI.pcrs.removeAuthListener();
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

  const startDownload = async () => {
    if (selectedPanels.length === 0) return;

    setStatus('downloading');
    setCurrentAction('Starting download...');

    try {
      const panelsToDownload = panels.filter(p => selectedPanels.includes(p.id));
      const result = await window.electronAPI.pcrs.downloadStatements({
        panels: panelsToDownload,
        months: ['latest']
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
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: COLORS.darkGray }}>
              Log in to PCRS Portal
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: COLORS.mediumGray }}>
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
            <p style={{ color: COLORS.mediumGray }}>{currentAction || 'Initializing...'}</p>
          </div>
        );

      case 'authenticated':
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              backgroundColor: '#D1FAE5',
              border: '1px solid #10B981',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle style={{ width: '20px', height: '20px', color: '#059669', marginRight: '0.5rem' }} />
                <span style={{ color: '#065F46', fontWeight: '500' }}>Connected to PCRS</span>
              </div>
            </div>

            {panels.length > 1 && (
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontWeight: '500', color: COLORS.darkGray, marginBottom: '0.5rem' }}>
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

            <button
              onClick={startDownload}
              disabled={selectedPanels.length === 0}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: selectedPanels.length === 0 ? COLORS.lightGray : COLORS.slainteBlue,
                color: COLORS.white,
                border: 'none',
                borderRadius: '8px',
                cursor: selectedPanels.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '500'
              }}
            >
              <Download style={{ width: '20px', height: '20px', marginRight: '0.5rem' }} />
              Download Latest Statements
            </button>
          </div>
        );

      case 'downloading':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <Loader
              style={{ width: '32px', height: '32px', color: COLORS.slainteBlue, marginBottom: '1rem' }}
              className="animate-spin"
            />
            <p style={{ color: COLORS.darkGray, fontWeight: '500' }}>{currentAction}</p>
          </div>
        );

      case 'complete':
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {downloadResults.map((result, index) => (
                <div
                  key={index}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: result.success ? '#D1FAE5' : '#FEE2E2'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: result.success ? '#065F46' : '#991B1B' }}>
                      {result.panelName}
                    </span>
                    {result.success ? (
                      <CheckCircle style={{ width: '16px', height: '16px', color: '#059669' }} />
                    ) : (
                      <AlertCircle style={{ width: '16px', height: '16px', color: '#DC2626' }} />
                    )}
                  </div>
                  {result.filename && (
                    <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray, marginTop: '0.25rem', marginBottom: 0 }}>
                      {result.filename}
                    </p>
                  )}
                  {result.error && (
                    <p style={{ fontSize: '0.875rem', color: '#DC2626', marginTop: '0.25rem', marginBottom: 0 }}>
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

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={startLogin}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  border: `1px solid ${COLORS.lightGray}`,
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
                  backgroundColor: COLORS.mediumGray,
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          borderBottom: `1px solid ${COLORS.lightGray}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Download style={{ width: '20px', height: '20px', color: COLORS.slainteBlue, marginRight: '0.5rem' }} />
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: COLORS.darkGray, margin: 0 }}>
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
            <X style={{ width: '20px', height: '20px', color: COLORS.mediumGray }} />
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
            borderTop: `1px solid ${COLORS.lightGray}`,
            backgroundColor: COLORS.backgroundGray,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: COLORS.mediumGray }}>
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
