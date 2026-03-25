const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - Exposes secure APIs to renderer process
 * This creates a bridge between React app and Electron main process
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // Check if running in Electron
  isElectron: true,

  // Get internal authentication token for API calls
  getInternalToken: () => ipcRenderer.invoke('get-internal-token'),

  // Mobile Access Password management
  setMobilePassword: (password) => ipcRenderer.invoke('set-mobile-password', password),
  getMobileAccessStatus: () => ipcRenderer.invoke('get-mobile-access-status'),
  verifyPassword: (password) => ipcRenderer.invoke('verify-password', password),
  getLanIP: () => ipcRenderer.invoke('get-lan-ip'),

  // LocalStorage sync (for reading/writing from main process)
  getLocalStorage: (key) => ipcRenderer.invoke('get-localStorage', key),
  setLocalStorage: (key, value) => ipcRenderer.invoke('set-localStorage', key, value),

  // Claude API calls (direct from desktop, no proxy needed)
  callClaude: (message, context, options) => ipcRenderer.invoke('call-claude', message, context, options),
  // Raw Claude API call — full Anthropic request with tools/system/messages
  callClaudeRaw: (request) => ipcRenderer.invoke('call-claude-raw', request),

  // Auto-updater functions
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Auto-updater event listeners
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },
  onUpdateDownloading: (callback) => {
    ipcRenderer.on('update-downloading', () => callback());
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, error) => callback(error));
  },

  // Encrypted Backup System
  getAutoBackupSettings: () => ipcRenderer.invoke('get-auto-backup-settings'),
  setAutoBackupSettings: (settings) => ipcRenderer.invoke('set-auto-backup-settings', settings),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  createBackup: (password) => ipcRenderer.invoke('create-backup', password),
  restoreBackup: (filepath, password) => ipcRenderer.invoke('restore-backup', filepath, password),
  deleteBackup: (filepath) => ipcRenderer.invoke('delete-backup', filepath),
  getBackupsFolder: () => ipcRenderer.invoke('get-backups-folder'),

  // License Validation
  validateLicense: () => ipcRenderer.invoke('validate-license'),
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  onLicenseStatus: (callback) => {
    ipcRenderer.on('license-status', (event, status) => callback(status));
  },
  removeLicenseStatusListener: () => {
    ipcRenderer.removeAllListeners('license-status');
  },

  // PCRS Statement Automation
  pcrs: {
    start: (options) => ipcRenderer.invoke('pcrs:start', options),
    checkSession: () => ipcRenderer.invoke('pcrs:checkSession'),
    clearSession: () => ipcRenderer.invoke('pcrs:clearSession'),
    getPanels: () => ipcRenderer.invoke('pcrs:getPanels'),
    getStatements: (panelId) => ipcRenderer.invoke('pcrs:getStatements', panelId),
    downloadStatements: (options) => ipcRenderer.invoke('pcrs:downloadStatements', options),
    close: () => ipcRenderer.invoke('pcrs:close'),
    setBounds: (bounds) => ipcRenderer.invoke('pcrs:setBounds', bounds),
    getDownloadPath: () => ipcRenderer.invoke('pcrs:getDownloadPath'),
    getDownloadedFiles: () => ipcRenderer.invoke('pcrs:getDownloadedFiles'),
    readFile: (filename) => ipcRenderer.invoke('pcrs:readFile', filename),
    // Event listeners
    onStatus: (callback) => {
      ipcRenderer.on('pcrs:status', (event, data) => callback(data));
    },
    onAuthStateChanged: (callback) => {
      ipcRenderer.on('pcrs:authStateChanged', (event, data) => callback(data));
    },
    onLog: (callback) => {
      ipcRenderer.on('pcrs:log', (event, data) => callback(data));
    },
    removeStatusListener: () => {
      ipcRenderer.removeAllListeners('pcrs:status');
    },
    removeAuthListener: () => {
      ipcRenderer.removeAllListeners('pcrs:authStateChanged');
    },
    removeLogListener: () => {
      ipcRenderer.removeAllListeners('pcrs:log');
    }
  },

  // Webhooks — Feedback, Registration, Error Reports
  submitFeedback: (data) => ipcRenderer.invoke('submit-feedback', data),
  submitRegistration: (data) => ipcRenderer.invoke('submit-registration', data),
  submitErrorReport: (data) => ipcRenderer.invoke('submit-error-report', data),
  submitReportFeedback: (data) => ipcRenderer.invoke('submit-report-feedback', data),
  getErrorReportingSetting: () => ipcRenderer.invoke('get-error-reporting-setting'),
  setErrorReportingSetting: (enabled) => ipcRenderer.invoke('set-error-reporting-setting', enabled),

  // Background Transaction Processor
  backgroundProcessor: {
    getStagedResults: () => ipcRenderer.invoke('background:get-staged'),
    getStagedDetail: (id) => ipcRenderer.invoke('background:get-staged-detail', id),
    applyStaged: (id, txIds) => ipcRenderer.invoke('background:apply-staged', id, txIds),
    dismissStaged: (id) => ipcRenderer.invoke('background:dismiss-staged', id),
    removeFromStaged: (id, txIds) => ipcRenderer.invoke('background:remove-from-staged', id, txIds),
    rescoreStaged: (id) => ipcRenderer.invoke('background:rescore-staged', id),
    runCategoryAssignment: (stagedIdOrApplied) => ipcRenderer.invoke('background:run-category-assignment', stagedIdOrApplied),
    getInboxPath: () => ipcRenderer.invoke('background:get-inbox-path'),
    openInbox: () => ipcRenderer.invoke('background:open-inbox'),
    onResultsReady: (cb) => ipcRenderer.on('background:results-ready', (e, data) => cb(data)),
    onProcessingError: (cb) => ipcRenderer.on('background:processing-error', (e, data) => cb(data)),
    onProcessingProgress: (cb) => ipcRenderer.on('background:processing-progress', (e, data) => cb(data)),
    removeListeners: () => {
      ipcRenderer.removeAllListeners('background:results-ready');
      ipcRenderer.removeAllListeners('background:processing-error');
      ipcRenderer.removeAllListeners('background:processing-progress');
    },
  },

  // Platform info
  platform: process.platform,
  version: process.versions.electron
});

// Log that preload is loaded
console.log('[Preload] Electron API bridge initialized');
