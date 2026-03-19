import React, { useState, useEffect } from 'react';
import { Download, Upload, RefreshCw, Cloud, AlertTriangle, Check, Smartphone, Monitor } from 'lucide-react';
import COLORS from '../utils/colors';
import {
  exportSyncData,
  exportToFile,
  generateExportFilename,
  importSyncData,
  mergeData,
  getSyncStatus
} from '../utils/syncUtils';

/**
 * Sync Manager Component
 * Handles data export/import and conflict resolution
 */
export default function SyncManager() {
  const [syncStatus, setSyncStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [conflicts, setConflicts] = useState(null);
  const [importData, setImportData] = useState(null);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = () => {
    const status = getSyncStatus();
    setSyncStatus(status);
  };

  const handleExport = () => {
    setIsExporting(true);

    try {
      const blob = exportToFile();
      const filename = generateExportFilename();
      const url = URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Update sync status
      loadSyncStatus();

      alert('✓ Data exported successfully!\n\nSave this file to your cloud storage folder (OneDrive, Dropbox, iCloud, etc.) to sync with other devices.');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        console.log('[Sync] Parsed import data:', {
          version: imported.version,
          deviceName: imported.deviceName,
          transactionCount: imported.transactions?.length || 0,
          reportCount: imported.savedReports?.length || 0
        });

        const result = importSyncData(imported);
        console.log('[Sync] Import result:', result);

        if (result.success) {
          alert('✓ Data imported successfully!');
          window.location.reload();
        } else if (result.conflicts && result.conflicts.length > 0) {
          // Show conflict resolution UI
          setConflicts(result.conflicts);
          setImportData({
            current: result.currentData,
            imported: result.importedData
          });
        } else {
          const errorDetails = result.error ? `\n\nError: ${result.error}` : '';
          alert('Import failed: ' + result.message + errorDetails);
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import: Invalid file format\n\nError: ' + error.message);
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = (error) => {
      console.error('File read error:', error);
      alert('Failed to read file. Please try again.');
      setIsImporting(false);
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = '';
  };

  const handleResolveConflict = (resolution) => {
    if (!importData) return;

    const result = mergeData(importData.current, importData.imported, resolution);

    if (result.success) {
      alert('✓ ' + result.message);
      setConflicts(null);
      setImportData(null);
      window.location.reload();
    } else {
      alert('Resolution failed: ' + result.message);
    }
  };

  // Conflict Resolution Modal
  if (conflicts && conflicts.length > 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
          style={{ backgroundColor: COLORS.white }}
        >
          <div className="flex items-start gap-3 mb-4">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${COLORS.highlightYellow}30` }}
            >
              <AlertTriangle className="h-6 w-6" style={{ color: COLORS.highlightYellow }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: COLORS.textPrimary }}>
                Data Sync Conflicts Detected
              </h2>
              <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
                The imported data differs from your current data. Choose how to resolve:
              </p>
            </div>
          </div>

          {/* Conflict Details */}
          <div className="space-y-3 mb-6">
            {conflicts.map((conflict, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: COLORS.bgPage,
                  borderColor: COLORS.borderLight
                }}
              >
                <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                  {conflict.message}
                </p>
                {conflict.current !== undefined && conflict.imported !== undefined && (
                  <div className="mt-2 text-xs space-y-1" style={{ color: COLORS.textSecondary }}>
                    <p>Current: {conflict.current}</p>
                    <p>Imported: {conflict.imported}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Resolution Options */}
          <div className="space-y-3">
            <button
              onClick={() => handleResolveConflict('merge')}
              className="w-full p-4 rounded-lg border-2 text-left hover:bg-blue-50 transition-colors"
              style={{ borderColor: COLORS.slainteBlue }}
            >
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
                <div>
                  <p className="font-semibold" style={{ color: COLORS.textPrimary }}>
                    Merge Data (Recommended)
                  </p>
                  <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                    Combine both datasets, keeping all transactions and newest reports
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleResolveConflict('useImported')}
              className="w-full p-4 rounded-lg border text-left hover:bg-gray-50 transition-colors"
              style={{ borderColor: COLORS.borderLight }}
            >
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5" style={{ color: COLORS.textSecondary }} />
                <div>
                  <p className="font-semibold" style={{ color: COLORS.textPrimary }}>
                    Use Imported Data
                  </p>
                  <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                    Replace current data with imported data
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setConflicts(null);
                setImportData(null);
              }}
              className="w-full p-4 rounded-lg border text-left hover:bg-gray-50 transition-colors"
              style={{ borderColor: COLORS.borderLight }}
            >
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5" style={{ color: COLORS.textSecondary }} />
                <div>
                  <p className="font-semibold" style={{ color: COLORS.textPrimary }}>
                    Keep Current Data
                  </p>
                  <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                    Cancel import and keep existing data
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Sync Manager UI
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.textPrimary }}>
          Data Sync
        </h2>
        <p style={{ color: COLORS.textSecondary }}>
          Sync your data between desktop and mobile using cloud storage
        </p>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div
          className="rounded-lg p-6 mb-6 border"
          style={{
            backgroundColor: COLORS.bgPage,
            borderColor: COLORS.borderLight
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Cloud className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
            <h3 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
              Sync Status
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: COLORS.textSecondary }}>
                Current Device
              </p>
              <div className="flex items-center gap-2">
                {syncStatus.deviceName === 'Desktop' ? (
                  <Monitor className="h-4 w-4" style={{ color: COLORS.textPrimary }} />
                ) : (
                  <Smartphone className="h-4 w-4" style={{ color: COLORS.textPrimary }} />
                )}
                <p className="font-semibold" style={{ color: COLORS.textPrimary }}>
                  {syncStatus.deviceName}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1" style={{ color: COLORS.textSecondary }}>
                Last Sync
              </p>
              <p className="font-semibold" style={{ color: COLORS.textPrimary }}>
                {syncStatus.lastSync
                  ? new Date(syncStatus.lastSync).toLocaleString('en-IE')
                  : 'Never'}
              </p>
              {syncStatus.lastSyncDevice && (
                <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                  from {syncStatus.lastSyncDevice}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div
        className="rounded-lg p-6 mb-6 border"
        style={{
          backgroundColor: COLORS.white,
          borderColor: COLORS.borderLight
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.textPrimary }}>
          How Cloud Sync Works
        </h3>
        <ol className="space-y-3">
          <li className="flex gap-3">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: COLORS.slainteBlue }}
            >
              1
            </span>
            <p style={{ color: COLORS.textPrimary }}>
              <strong>Export</strong> your data on your desktop
            </p>
          </li>
          <li className="flex gap-3">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: COLORS.slainteBlue }}
            >
              2
            </span>
            <p style={{ color: COLORS.textPrimary }}>
              <strong>Save</strong> the file to your cloud storage (OneDrive, Dropbox, iCloud, Google Drive)
            </p>
          </li>
          <li className="flex gap-3">
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: COLORS.slainteBlue }}
            >
              3
            </span>
            <p style={{ color: COLORS.textPrimary }}>
              <strong>Import</strong> the file on your mobile device from the same cloud folder
            </p>
          </li>
        </ol>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="p-6 rounded-lg border-2 hover:shadow-lg transition-all disabled:opacity-50"
          style={{
            borderColor: COLORS.incomeColor,
            backgroundColor: COLORS.white
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Download className="h-6 w-6" style={{ color: COLORS.incomeColor }} />
            <h3 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
              Export Data
            </h3>
          </div>
          <p className="text-sm" style={{ color: COLORS.textSecondary }}>
            Download a file to save to cloud storage
          </p>
        </button>

        <label className="p-6 rounded-lg border-2 hover:shadow-lg transition-all cursor-pointer">
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            disabled={isImporting}
            className="hidden"
          />
          <div className="flex items-center gap-3 mb-2">
            <Upload className="h-6 w-6" style={{ color: COLORS.slainteBlue }} />
            <h3 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
              Import Data
            </h3>
          </div>
          <p className="text-sm" style={{ color: COLORS.textSecondary }}>
            Load data from cloud storage
          </p>
        </label>
      </div>
    </div>
  );
}
