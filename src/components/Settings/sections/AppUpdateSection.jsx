import React, { useState, useEffect } from 'react';
import {
  Download,
  CheckCircle
} from 'lucide-react';
import COLORS from '../../../utils/colors';

/**
 * AppUpdateSection - App version and update management
 */
const AppUpdateSection = () => {
  // App Updates state
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState('idle');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Load app version and setup update listeners
  useEffect(() => {
    // Get app version
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(version => {
        setAppVersion(version);
      });
    }

    // Setup update event listeners
    if (window.electronAPI?.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateStatus('available');
        setUpdateInfo(info);
      });
    }

    if (window.electronAPI?.onUpdateDownloading) {
      window.electronAPI.onUpdateDownloading(() => {
        setUpdateStatus('downloading');
      });
    }

    if (window.electronAPI?.onUpdateProgress) {
      window.electronAPI.onUpdateProgress((progress) => {
        setDownloadProgress(progress.percent);
      });
    }

    if (window.electronAPI?.onUpdateDownloaded) {
      window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateStatus('ready');
        setUpdateInfo(info);
      });
    }

    if (window.electronAPI?.onUpdateError) {
      window.electronAPI.onUpdateError((error) => {
        setUpdateStatus('error');
        console.error('Update error:', error);
      });
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (window.electronAPI?.checkForUpdates) {
      setUpdateStatus('checking');
      try {
        await window.electronAPI.checkForUpdates();
      } catch (error) {
        setUpdateStatus('error');
        console.error('Check for updates error:', error);
      }
    }
  };

  const handleInstallUpdate = () => {
    if (window.electronAPI?.installUpdate) {
      window.electronAPI.installUpdate();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* App Updates Section */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.lightGray}` }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', color: COLORS.darkGray, marginBottom: '1rem' }}>
          <Download style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem', color: COLORS.slainteBlue }} />
          App Update
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Current Version */}
          <div style={{ padding: '1rem', border: `1px solid ${COLORS.lightGray}`, borderRadius: '0.5rem', backgroundColor: COLORS.backgroundGray }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Current Version</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 600, color: COLORS.darkGray }}>
                  {appVersion || 'Loading...'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>Status</p>
                <p style={{
                  fontWeight: 500,
                  color: updateStatus === 'ready' ? COLORS.incomeColor :
                         updateStatus === 'available' ? COLORS.highlightYellow :
                         updateStatus === 'error' ? COLORS.expenseColor :
                         COLORS.darkGray
                }}>
                  {updateStatus === 'idle' && 'Up to date'}
                  {updateStatus === 'checking' && 'Checking...'}
                  {updateStatus === 'available' && `v${updateInfo?.version} available`}
                  {updateStatus === 'downloading' && `Downloading... ${downloadProgress.toFixed(0)}%`}
                  {updateStatus === 'ready' && 'Ready to install'}
                  {updateStatus === 'error' && 'Update check failed'}
                </p>
              </div>
            </div>

            {/* Download Progress Bar */}
            {updateStatus === 'downloading' && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ height: '0.5rem', backgroundColor: '#E5E7EB', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${downloadProgress}%`,
                      height: '100%',
                      backgroundColor: COLORS.slainteBlue,
                      transition: 'width 0.3s'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Update Actions */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {(updateStatus === 'idle' || updateStatus === 'error') && (
              <button
                onClick={handleCheckForUpdates}
                disabled={updateStatus === 'checking'}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  borderRadius: '0.25rem',
                  fontWeight: 500,
                  color: COLORS.white,
                  backgroundColor: COLORS.slainteBlue,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Download style={{ height: '1rem', width: '1rem' }} />
                Check for Updates
              </button>
            )}

            {updateStatus === 'checking' && (
              <button
                disabled
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  borderRadius: '0.25rem',
                  fontWeight: 500,
                  color: COLORS.white,
                  backgroundColor: COLORS.slainteBlue,
                  border: 'none',
                  opacity: 0.7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <div style={{
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '9999px',
                  animation: 'spin 1s linear infinite'
                }} />
                Checking...
              </button>
            )}

            {updateStatus === 'ready' && (
              <button
                onClick={handleInstallUpdate}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  borderRadius: '0.25rem',
                  fontWeight: 500,
                  color: COLORS.white,
                  backgroundColor: COLORS.incomeColor,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <CheckCircle style={{ height: '1rem', width: '1rem' }} />
                Restart & Install Update
              </button>
            )}
          </div>

          {/* Update Note */}
          <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
            Updates are downloaded automatically when available. Your data is preserved during updates.
          </p>
        </div>
      </div>

      {/* CSS Animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AppUpdateSection;
