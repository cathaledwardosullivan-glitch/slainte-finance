import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../../context/AppContext';
import {
  Upload,
  Download,
  Shield,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import COLORS from '../../../utils/colors';

// Protected Clear All Data Button Component
function ClearAllDataButton({ onClear }) {
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClear = () => {
    if (confirmText === 'DELETE ALL DATA') {
      onClear();
      setConfirmText('');
      setShowConfirm(false);
    } else {
      alert('Please type "DELETE ALL DATA" exactly to confirm.');
    }
  };

  return (
    <div>
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            fontWeight: 500,
            backgroundColor: COLORS.expenseColor,
            color: COLORS.white,
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Clear All Data
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: COLORS.textPrimary }}>
              Type <strong>"DELETE ALL DATA"</strong> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: `1px solid ${COLORS.borderLight}`,
                borderRadius: '0.25rem'
              }}
              placeholder="DELETE ALL DATA"
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleClear}
              disabled={confirmText !== 'DELETE ALL DATA'}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.25rem',
                fontWeight: 500,
                backgroundColor: confirmText === 'DELETE ALL DATA' ? COLORS.expenseColor : COLORS.borderLight,
                color: COLORS.white,
                border: 'none',
                cursor: confirmText === 'DELETE ALL DATA' ? 'pointer' : 'not-allowed'
              }}
            >
              Confirm Delete
            </button>
            <button
              onClick={() => { setShowConfirm(false); setConfirmText(''); }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.25rem',
                border: `1px solid ${COLORS.borderLight}`,
                backgroundColor: COLORS.white,
                color: COLORS.textPrimary,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * BackupRestoreSection - Backup, Restore, and Danger Zone
 */
const BackupRestoreSection = () => {
  const {
    transactions,
    setTransactions,
    unidentifiedTransactions,
    setUnidentifiedTransactions,
    categoryMapping,
    setCategoryMapping,
    paymentAnalysisData,
    setPaymentAnalysisData,
    selectedYear,
    clearAllData
  } = useAppContext();

  // Backup & Restore state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState(null);
  const [backupList, setBackupList] = useState([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [securityPasswordSet, setSecurityPasswordSet] = useState(false);

  // Load auto-backup settings
  useEffect(() => {
    const loadBackupSettings = async () => {
      if (window.electronAPI?.getAutoBackupSettings) {
        try {
          const settings = await window.electronAPI.getAutoBackupSettings();
          setAutoBackupEnabled(settings.enabled || false);
          setLastBackupDate(settings.lastBackup);
        } catch (error) {
          console.error('Error loading backup settings:', error);
        }
      }
      if (window.electronAPI?.getMobileAccessStatus) {
        try {
          const status = await window.electronAPI.getMobileAccessStatus();
          setSecurityPasswordSet(status.isConfigured || false);
        } catch (error) {
          console.error('Error checking security password:', error);
        }
      }
      if (window.electronAPI?.listBackups) {
        try {
          const backups = await window.electronAPI.listBackups();
          setBackupList(backups || []);
        } catch (error) {
          console.error('Error loading backup list:', error);
        }
      }
    };
    loadBackupSettings();
  }, []);

  // Backup download handler
  const handleBackupDownload = () => {
    const dataToExport = {
      version: '2.1',
      appVersion: 'Slainte Finance V2',
      exportDate: new Date().toISOString(),
      transactions,
      unidentifiedTransactions,
      categoryMapping,
      paymentAnalysisData,
      settings: {
        selectedYear
      },
      practiceProfile: localStorage.getItem('slainte_practice_profile'),
      savedReports: JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]'),
      aiCorrections: localStorage.getItem('slainte_ai_corrections'),
      categoryPreferences: localStorage.getItem('gp_finance_category_preferences'),
      // v2.1: Added chat history and learned patterns
      chatHistory: localStorage.getItem('ciaran_chats'),
      currentChatId: localStorage.getItem('ciaran_current_chat_id'),
      learnedPatterns: localStorage.getItem('gp_finance_learned_patterns')
    };
    const jsonData = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `slainte-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Restore handler
  const handleRestore = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        if (!data.version || !data.exportDate) {
          alert('Invalid backup file format. Please select a valid Slainte Finance backup file.');
          return;
        }

        const backupDate = new Date(data.exportDate).toLocaleDateString();
        const transCount = (data.transactions || []).length;
        const unidentCount = (data.unidentifiedTransactions || []).length;
        const pcrsCount = (data.paymentAnalysisData || []).length;

        // Count chat conversations if present (v2.1+)
        let chatCount = 0;
        if (data.chatHistory) {
          try {
            const chats = JSON.parse(data.chatHistory);
            chatCount = Array.isArray(chats) ? chats.length : 0;
          } catch { chatCount = 0; }
        }

        if (window.confirm(
          `Restore backup from ${backupDate}?\n\n` +
          `This backup contains:\n` +
          `• ${transCount} categorised transactions\n` +
          `• ${unidentCount} unidentified transactions\n` +
          `• ${pcrsCount} PCRS payment records\n` +
          (chatCount > 0 ? `• ${chatCount} Finn chat conversations\n` : '') +
          (data.learnedPatterns ? `• Learned transaction patterns\n` : '') +
          `\nThis will REPLACE all current data. Continue?`
        )) {
          setTransactions(data.transactions || []);
          setUnidentifiedTransactions(data.unidentifiedTransactions || []);
          if (data.categoryMapping) setCategoryMapping(data.categoryMapping);
          if (data.paymentAnalysisData) setPaymentAnalysisData(data.paymentAnalysisData);

          if (data.practiceProfile) {
            localStorage.setItem('slainte_practice_profile', data.practiceProfile);
          }
          if (data.savedReports) {
            localStorage.setItem('gp_finance_saved_reports', JSON.stringify(data.savedReports));
          }
          if (data.aiCorrections) {
            localStorage.setItem('slainte_ai_corrections', data.aiCorrections);
          }
          if (data.categoryPreferences) {
            localStorage.setItem('gp_finance_category_preferences', data.categoryPreferences);
          }

          // v2.1: Restore chat history and learned patterns
          if (data.chatHistory) {
            localStorage.setItem('ciaran_chats', data.chatHistory);
          }
          if (data.currentChatId) {
            localStorage.setItem('ciaran_current_chat_id', data.currentChatId);
          }
          if (data.learnedPatterns) {
            localStorage.setItem('gp_finance_learned_patterns', data.learnedPatterns);
          }

          alert('Backup restored successfully! The page will now reload.');
          window.location.reload();
        }
      } catch (error) {
        console.error('Restore error:', error);
        alert('Error reading backup file. Please check the file is a valid JSON backup.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Create encrypted backup
  const handleCreateEncryptedBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const result = await window.electronAPI.createBackup();
      if (result.success) {
        setLastBackupDate(result.timestamp);
        const backups = await window.electronAPI.listBackups();
        setBackupList(backups || []);
        alert(`Encrypted backup created successfully!\n\nFile: ${result.filename}`);
      } else {
        alert('Backup failed: ' + result.error);
      }
    } catch (error) {
      alert('Backup failed: ' + error.message);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Restore from encrypted backup
  const handleRestoreEncrypted = async () => {
    if (!restoreTarget || !restorePassword) return;
    setIsRestoringBackup(true);
    try {
      const result = await window.electronAPI.restoreBackup(restoreTarget.filepath, restorePassword);
      if (result.success) {
        // Clear browser localStorage first to remove any corrupted/stale data,
        // then write the restored data fresh.
        localStorage.clear();
        if (result.storageEntries) {
          for (const [key, value] of Object.entries(result.storageEntries)) {
            localStorage.setItem(key, value);
          }
        }
        setRestoreTarget(null);
        setRestorePassword('');
        alert(`Backup restored successfully!\n\n• ${result.transactionCount || 0} transactions\n• ${result.unidentifiedCount || 0} unidentified\n• Backup date: ${result.backupDate ? new Date(result.backupDate).toLocaleDateString() : 'Unknown'}\n\nThe page will now reload.`);
        window.location.reload();
      } else {
        alert('Restore failed: ' + result.error);
      }
    } catch (error) {
      alert('Restore failed: ' + error.message);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  // Delete encrypted backup
  const handleDeleteBackup = async (backup) => {
    if (!window.confirm(`Delete backup from ${new Date(backup.created).toLocaleString()}?\n\nThis cannot be undone.`)) return;
    try {
      const result = await window.electronAPI.deleteBackup(backup.filepath);
      if (result.success) {
        const backups = await window.electronAPI.listBackups();
        setBackupList(backups || []);
      } else {
        alert('Delete failed: ' + result.error);
      }
    } catch (error) {
      alert('Delete failed: ' + error.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Manual Backup & Restore */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', color: COLORS.textPrimary, marginBottom: '1rem' }}>
          <Download style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem', color: COLORS.slainteBlue }} />
          Manual Backup & Restore
        </h3>

        <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '1.5rem' }}>
          Save your progress before app updates or restore from a previous backup
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Backup */}
          <div style={{ padding: '1rem', border: `2px solid ${COLORS.incomeColor}`, borderRadius: '0.5rem', backgroundColor: `${COLORS.incomeColor}10` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Download style={{ height: '1.25rem', width: '1.25rem', color: COLORS.incomeColor }} />
              <h4 style={{ fontWeight: 600, color: COLORS.incomeColor }}>Backup All Data</h4>
            </div>
            <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
              Creates a complete backup including all transactions, categories, identifiers, PCRS data, practice profile, Finn chat history, and settings.
            </p>
            <button
              onClick={handleBackupDownload}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
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
              <Download style={{ height: '1rem', width: '1rem' }} />
              Download Backup
            </button>
            <p style={{ fontSize: '0.75rem', marginTop: '0.75rem', textAlign: 'center', color: COLORS.textSecondary }}>
              {transactions.length} transactions, {unidentifiedTransactions.length} unidentified, {paymentAnalysisData.length} PCRS records
            </p>
          </div>

          {/* Restore */}
          <div style={{ padding: '1rem', border: `2px solid ${COLORS.slainteBlue}`, borderRadius: '0.5rem', backgroundColor: `${COLORS.slainteBlue}10` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Upload style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
              <h4 style={{ fontWeight: 600, color: COLORS.slainteBlue }}>Restore from Backup</h4>
            </div>
            <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
              Restore all data from a previous backup file. This will replace all current data.
            </p>
            <label
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: COLORS.white,
                backgroundColor: COLORS.slainteBlue,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <Upload style={{ height: '1rem', width: '1rem' }} />
              Select Backup File
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                style={{ display: 'none' }}
              />
            </label>
            <p style={{ fontSize: '0.75rem', marginTop: '0.75rem', textAlign: 'center', color: COLORS.textSecondary }}>
              Accepts .json backup files
            </p>
          </div>
        </div>

        {/* Warning note */}
        <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: COLORS.warningLight }}>
          <p style={{ fontSize: '0.75rem', color: COLORS.warningText }}>
            <strong>Tip:</strong> Create a backup before major app updates or when you've made significant progress categorising transactions.
          </p>
        </div>
      </div>

      {/* Auto-Backup Section - Electron Only */}
      {window.electronAPI?.isElectron && (
        <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', color: COLORS.chartViolet }}>
              <Shield style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem', color: COLORS.chartViolet }} />
              Encrypted Auto-Backup
            </h3>
            {securityPasswordSet ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <span style={{ fontSize: '0.875rem', color: COLORS.textPrimary }}>
                  {autoBackupEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <div
                  onClick={async () => {
                    const newValue = !autoBackupEnabled;
                    if (!newValue) {
                      const confirmed = window.confirm(
                        'Disabling auto-backup means your data will no longer be encrypted and backed up automatically when you close the app.\n\nAre you sure you want to disable this?'
                      );
                      if (!confirmed) return;
                    }
                    setAutoBackupEnabled(newValue);
                    if (window.electronAPI?.setAutoBackupSettings) {
                      await window.electronAPI.setAutoBackupSettings({ enabled: newValue });
                    }
                  }}
                  style={{
                    position: 'relative',
                    width: '3rem',
                    height: '1.5rem',
                    borderRadius: '9999px',
                    backgroundColor: autoBackupEnabled ? COLORS.chartViolet : COLORS.borderLight,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '0.25rem',
                      width: '1rem',
                      height: '1rem',
                      borderRadius: '9999px',
                      backgroundColor: COLORS.white,
                      left: autoBackupEnabled ? '1.75rem' : '0.25rem',
                      transition: 'left 0.2s'
                    }}
                  />
                </div>
              </label>
            ) : (
              <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.highlightYellow, color: COLORS.warningText }}>
                Set Security Password First
              </span>
            )}
          </div>

          <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
            When enabled, your data is automatically encrypted and backed up every time you close the app.
            Backups use your App Security Password for encryption (AES-256).
          </p>

          {lastBackupDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem', color: COLORS.textSecondary }}>
              <Clock style={{ height: '1rem', width: '1rem' }} />
              <span>Last backup: {new Date(lastBackupDate).toLocaleString()}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {securityPasswordSet && (
              <button
                onClick={handleCreateEncryptedBackup}
                disabled={isCreatingBackup}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  backgroundColor: COLORS.chartViolet,
                  border: 'none',
                  cursor: isCreatingBackup ? 'not-allowed' : 'pointer',
                  opacity: isCreatingBackup ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {isCreatingBackup ? (
                  <>
                    <RefreshCw style={{ height: '1rem', width: '1rem', animation: 'spin 1s linear infinite' }} />
                    Creating...
                  </>
                ) : (
                  <>
                    <Download style={{ height: '1rem', width: '1rem' }} />
                    Create Backup Now
                  </>
                )}
              </button>
            )}
          </div>

          {backupList.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${COLORS.accentPurple}40` }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.chartViolet }}>
                Recent Encrypted Backups ({backupList.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '12rem', overflowY: 'auto' }}>
                {backupList.slice(0, 7).map((backup, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: COLORS.bgPage }}>
                    <span style={{ color: COLORS.textPrimary }}>
                      {new Date(backup.created).toLocaleString()}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: COLORS.textSecondary }}>
                        {(backup.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <button
                        onClick={() => { setRestoreTarget(backup); setRestorePassword(''); }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: COLORS.white,
                          backgroundColor: COLORS.chartViolet,
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(backup)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: COLORS.expenseColor,
                          backgroundColor: 'transparent',
                          border: `1px solid ${COLORS.expenseColor}`,
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Restore password prompt */}
              {restoreTarget && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: `${COLORS.chartViolet}10`, border: `1px solid ${COLORS.chartViolet}40` }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.chartViolet, marginBottom: '0.5rem' }}>
                    Restore backup from {new Date(restoreTarget.created).toLocaleString()}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginBottom: '0.5rem' }}>
                    Enter your App Security Password to decrypt this backup. This will replace all current data.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="password"
                      value={restorePassword}
                      onChange={(e) => setRestorePassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && restorePassword) handleRestoreEncrypted(); }}
                      placeholder="Security password"
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        fontSize: '0.8rem',
                        border: `1px solid ${COLORS.borderLight}`,
                        borderRadius: '0.25rem'
                      }}
                    />
                    <button
                      onClick={handleRestoreEncrypted}
                      disabled={!restorePassword || isRestoringBackup}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: COLORS.white,
                        backgroundColor: restorePassword && !isRestoringBackup ? COLORS.chartViolet : COLORS.borderLight,
                        border: 'none',
                        cursor: restorePassword && !isRestoringBackup ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {isRestoringBackup ? 'Restoring...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => { setRestoreTarget(null); setRestorePassword(''); }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.8rem',
                        color: COLORS.textSecondary,
                        backgroundColor: 'transparent',
                        border: `1px solid ${COLORS.borderLight}`,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!securityPasswordSet && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: COLORS.warningLight }}>
              <p style={{ fontSize: '0.75rem', color: COLORS.warningText }}>
                <strong>Setup Required:</strong> To enable encrypted auto-backups, you need to set up an App Security Password during the initial setup process.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Restart Onboarding */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.textPrimary, marginBottom: '0.5rem' }}>
          Restart Onboarding
        </h3>
        <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
          Clear your practice profile and personalized categories to restart the onboarding wizard. Transaction data and PCRS records will be preserved.
        </p>
        <button
          onClick={() => {
            if (window.confirm('This will remove all personalized categories and restart onboarding. Transaction data will NOT be deleted. Continue?')) {
              localStorage.removeItem('slainte_practice_profile');
              localStorage.removeItem('slainte_onboarding_complete');
              window.location.reload();
            }
          }}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            fontWeight: 500,
            backgroundColor: COLORS.highlightYellow,
            color: COLORS.textPrimary,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <RefreshCw style={{ height: '1rem', width: '1rem' }} />
          Restart Onboarding
        </button>
      </div>

      {/* Danger Zone */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `2px solid ${COLORS.expenseColor}` }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.expenseColor, marginBottom: '0.5rem' }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
          <strong>Warning:</strong> This will permanently delete ALL data including transactions, categories, and settings. This cannot be undone.
        </p>
        <ClearAllDataButton onClear={clearAllData} />
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

export default BackupRestoreSection;
