/**
 * Sync Utilities for Data Export/Import
 * Handles cloud folder sync, conflict detection, and data merge
 */

// Generate a unique device ID for conflict resolution
export function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

// Get device name (desktop or mobile)
export function getDeviceName() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return isMobile ? 'Mobile' : 'Desktop';
}

/**
 * Export full app state to sync format
 * @returns {Object} Sync data package
 */
export function exportSyncData() {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();

  // Helper to safely parse JSON with fallback
  // The app wraps data in {data: ..., timestamp: ..., version: ...} format
  const safeParse = (key, fallback) => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return fallback;
      const parsed = JSON.parse(stored);

      // Check if this is wrapped data (has .data property)
      if (parsed && typeof parsed === 'object' && 'data' in parsed) {
        return parsed.data || fallback;
      }

      // Otherwise return as-is (for non-wrapped items like reports)
      return parsed || fallback;
    } catch (error) {
      console.error(`[Sync] Error parsing ${key}:`, error);
      return fallback;
    }
  };

  // Get all data safely using correct storage keys
  const transactions = safeParse('gp_finance_transactions', []);
  const unidentifiedTransactions = safeParse('gp_finance_unidentified', []);
  const categoryMapping = safeParse('gp_finance_categories', []); // Correct key!
  const paymentAnalysisData = safeParse('gp_finance_payment_analysis', []);
  const savedReports = safeParse('gp_finance_saved_reports', []);
  const learnedIdentifiers = safeParse('gp_finance_learned_patterns', []); // Correct key!
  const practiceProfile = safeParse('practiceProfile', {});
  const slaintePracticeProfile = safeParse('slainte_practice_profile', {}); // Unified onboarding profile
  const settings = safeParse('gp_finance_settings', {});

  const syncData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    deviceId,
    deviceName,

    // Core data
    transactions: Array.isArray(transactions) ? transactions : [],
    unidentifiedTransactions: Array.isArray(unidentifiedTransactions) ? unidentifiedTransactions : [],
    categoryMapping: Array.isArray(categoryMapping) ? categoryMapping : [],
    paymentAnalysisData: Array.isArray(paymentAnalysisData) ? paymentAnalysisData : [],

    // Reports and learned data
    savedReports: Array.isArray(savedReports) ? savedReports : [],
    learnedIdentifiers: Array.isArray(learnedIdentifiers) ? learnedIdentifiers : [],

    // Practice profiles
    practiceProfile: practiceProfile || {},
    slaintePracticeProfile: slaintePracticeProfile || {},

    // Settings
    settings: settings || {},

    // Metadata for sync
    syncMetadata: {
      lastModified: getLastModifiedTimestamp(),
      recordCounts: {
        transactions: Array.isArray(transactions) ? transactions.length : 0,
        reports: Array.isArray(savedReports) ? savedReports.length : 0
      }
    }
  };

  return syncData;
}

/**
 * Get the most recent modification timestamp from all data
 */
function getLastModifiedTimestamp() {
  const timestamps = [];

  try {
    // Check transaction dates
    const transactionsData = localStorage.getItem('gp_finance_transactions');
    if (transactionsData) {
      const transactions = JSON.parse(transactionsData);
      if (Array.isArray(transactions)) {
        transactions.forEach(tx => {
          if (tx.importedAt) timestamps.push(new Date(tx.importedAt).getTime());
        });
      }
    }

    // Check report dates
    const reportsData = localStorage.getItem('gp_finance_saved_reports');
    if (reportsData) {
      const reports = JSON.parse(reportsData);
      if (Array.isArray(reports)) {
        reports.forEach(report => {
          if (report.generatedDate) timestamps.push(new Date(report.generatedDate).getTime());
        });
      }
    }

    // Check practice profile
    const profileData = localStorage.getItem('practiceProfile');
    if (profileData) {
      const profile = JSON.parse(profileData);
      if (profile && profile.lastUpdated) {
        timestamps.push(new Date(profile.lastUpdated).getTime());
      }
    }
  } catch (error) {
    console.error('[Sync] Error reading timestamps:', error);
  }

  return timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
}

/**
 * Export data as JSON file for download
 * @returns {Blob} JSON blob ready for download
 */
export function exportToFile() {
  const syncData = exportSyncData();
  const jsonString = JSON.stringify(syncData, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
}

/**
 * Generate filename for export
 */
export function generateExportFilename() {
  const profile = JSON.parse(localStorage.getItem('practiceProfile') || '{}');
  const practiceName = profile.practiceDetails?.practiceName || 'Practice';
  const date = new Date().toISOString().split('T')[0];
  const deviceName = getDeviceName();

  return `slainte-finance-${practiceName.replace(/\s+/g, '-')}-${deviceName}-${date}.json`;
}

/**
 * Import and merge sync data
 * @param {Object} importedData - Imported sync data
 * @returns {Object} Result with status and conflicts
 */
export function importSyncData(importedData) {
  try {
    console.log('[Sync] Validating import data...', {
      hasVersion: !!importedData.version,
      hasExportedAt: !!importedData.exportedAt,
      hasTransactions: !!importedData.transactions,
      version: importedData.version,
      exportedAt: importedData.exportedAt
    });

    // Validate imported data
    if (!importedData.version || !importedData.exportedAt) {
      throw new Error(`Invalid sync data format - missing ${!importedData.version ? 'version' : 'exportedAt'}`);
    }

    const currentData = exportSyncData();
    const conflicts = detectConflicts(currentData, importedData);

    console.log('[Sync] Conflicts detected:', conflicts.length);

    // If no conflicts or user wants to overwrite, import directly
    if (conflicts.length === 0) {
      console.log('[Sync] No conflicts, applying import...');
      applyImport(importedData);
      return {
        success: true,
        conflicts: [],
        message: 'Data imported successfully'
      };
    }

    // Return conflicts for user resolution
    console.log('[Sync] Returning conflicts for user resolution');
    return {
      success: false,
      conflicts,
      currentData,
      importedData,
      message: 'Conflicts detected - user action required'
    };

  } catch (error) {
    console.error('[Sync] Import failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to import data'
    };
  }
}

/**
 * Detect conflicts between current and imported data
 */
function detectConflicts(currentData, importedData) {
  const conflicts = [];

  // Check if both have been modified since last sync
  const currentTime = new Date(currentData.exportedAt).getTime();
  const importedTime = new Date(importedData.exportedAt).getTime();

  // Check transaction count differences
  const currentTxCount = currentData.transactions.length;
  const importedTxCount = importedData.transactions.length;

  if (currentTxCount !== importedTxCount) {
    conflicts.push({
      type: 'transactions',
      current: currentTxCount,
      imported: importedTxCount,
      message: `Transaction count differs: ${currentTxCount} vs ${importedTxCount}`
    });
  }

  // Check report count differences
  const currentReportCount = currentData.savedReports.length;
  const importedReportCount = importedData.savedReports.length;

  if (currentReportCount !== importedReportCount) {
    conflicts.push({
      type: 'reports',
      current: currentReportCount,
      imported: importedReportCount,
      message: `Report count differs: ${currentReportCount} vs ${importedReportCount}`
    });
  }

  // Check if imported data is older
  if (importedTime < currentTime) {
    conflicts.push({
      type: 'timestamp',
      current: currentData.exportedAt,
      imported: importedData.exportedAt,
      message: 'Imported data is older than current data'
    });
  }

  // Check device conflict (same device shouldn't have different data)
  if (currentData.deviceId === importedData.deviceId && conflicts.length > 0) {
    conflicts.push({
      type: 'device',
      message: 'Data conflict from same device detected'
    });
  }

  return conflicts;
}

/**
 * Apply imported data to localStorage
 * Uses the app's wrapper format: {data: ..., timestamp: ..., version: ...}
 */
function applyImport(importedData) {
  const timestamp = new Date().toISOString();

  // Helper to create wrapped storage format
  const wrapData = (data) => ({
    data,
    timestamp,
    version: '1.0'
  });

  // Save imported data to localStorage with correct keys and wrapper format
  localStorage.setItem('gp_finance_transactions', JSON.stringify(wrapData(importedData.transactions || [])));
  localStorage.setItem('gp_finance_unidentified', JSON.stringify(wrapData(importedData.unidentifiedTransactions || [])));
  localStorage.setItem('gp_finance_categories', JSON.stringify(wrapData(importedData.categoryMapping || []))); // Correct key!
  localStorage.setItem('gp_finance_payment_analysis', JSON.stringify(importedData.paymentAnalysisData || [])); // Not wrapped
  localStorage.setItem('gp_finance_saved_reports', JSON.stringify(importedData.savedReports || [])); // Not wrapped
  localStorage.setItem('gp_finance_learned_patterns', JSON.stringify(wrapData(importedData.learnedIdentifiers || []))); // Correct key!

  if (importedData.practiceProfile && Object.keys(importedData.practiceProfile).length > 0) {
    localStorage.setItem('practiceProfile', JSON.stringify(importedData.practiceProfile));
  }

  if (importedData.slaintePracticeProfile && Object.keys(importedData.slaintePracticeProfile).length > 0) {
    localStorage.setItem('slainte_practice_profile', JSON.stringify(importedData.slaintePracticeProfile));
  }

  if (importedData.settings && Object.keys(importedData.settings).length > 0) {
    localStorage.setItem('gp_finance_settings', JSON.stringify(wrapData(importedData.settings)));
  }

  // Update last sync timestamp
  localStorage.setItem('last_sync_timestamp', timestamp);
  localStorage.setItem('last_sync_device', importedData.deviceName);
}

/**
 * Merge strategy: Keep both datasets and merge intelligently
 */
export function mergeData(currentData, importedData, resolution = 'merge') {
  if (resolution === 'keepCurrent') {
    return { success: true, message: 'Kept current data' };
  }

  if (resolution === 'useImported') {
    applyImport(importedData);
    return { success: true, message: 'Imported data applied' };
  }

  if (resolution === 'merge') {
    // Merge transactions (union by ID)
    const currentTxIds = new Set(currentData.transactions.map(tx => tx.id));
    const mergedTransactions = [...currentData.transactions];

    importedData.transactions.forEach(tx => {
      if (!currentTxIds.has(tx.id)) {
        mergedTransactions.push(tx);
      }
    });

    // Merge reports (union by ID, keep latest)
    const reportMap = new Map();
    currentData.savedReports.forEach(report => {
      reportMap.set(report.id, report);
    });
    importedData.savedReports.forEach(report => {
      const existing = reportMap.get(report.id);
      if (!existing || new Date(report.generatedDate) > new Date(existing.generatedDate)) {
        reportMap.set(report.id, report);
      }
    });

    // Apply merged data
    const mergedData = {
      ...importedData,
      transactions: mergedTransactions,
      savedReports: Array.from(reportMap.values())
    };

    applyImport(mergedData);
    return { success: true, message: 'Data merged successfully' };
  }

  return { success: false, message: 'Invalid resolution strategy' };
}

/**
 * Get sync status information
 */
export function getSyncStatus() {
  const lastSync = localStorage.getItem('last_sync_timestamp');
  const lastDevice = localStorage.getItem('last_sync_device');
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();

  return {
    deviceId,
    deviceName,
    lastSync: lastSync ? new Date(lastSync) : null,
    lastSyncDevice: lastDevice,
    hasLocalData: localStorage.getItem('gp_finance_transactions') !== null
  };
}

/**
 * Clear all sync-related data
 */
export function clearSyncData() {
  localStorage.removeItem('last_sync_timestamp');
  localStorage.removeItem('last_sync_device');
  localStorage.removeItem('device_id');
}
