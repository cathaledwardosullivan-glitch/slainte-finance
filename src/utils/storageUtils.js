// Storage utility functions for persistent data
const STORAGE_KEYS = {
  TRANSACTIONS: 'gp_finance_transactions',
  UNIDENTIFIED_TRANSACTIONS: 'gp_finance_unidentified',
  LEARNED_IDENTIFIERS: 'gp_finance_learned_patterns',
  CATEGORY_MAPPING: 'gp_finance_category_mapping',
  PAYMENT_ANALYSIS: 'gp_finance_payment_analysis',
  SAVED_REPORTS: 'gp_finance_saved_reports',
  SETTINGS: 'gp_finance_settings'
};

// Sync to Electron's main process storage (for API access)
const syncToElectron = async (key, data) => {
  if (window.electronAPI?.isElectron) {
    try {
      await window.electronAPI.setLocalStorage(key, JSON.stringify(data));
    } catch (err) {
      console.error(`[Storage] Failed to sync ${key} to Electron:`, err);
    }
  }
};

// Save data to localStorage with error handling
const saveToStorage = (key, data) => {
  try {
    const serialized = JSON.stringify({
      data,
      timestamp: new Date().toISOString(),
      version: '1.0'
    });
    localStorage.setItem(key, serialized);

    // Also sync to Electron's file storage for API access
    syncToElectron(key, data);

    return true;
  } catch (error) {
    console.error('Error saving to storage:', error);

    // Handle quota exceeded error
    if (error.name === 'QuotaExceededError') {
      alert(`⚠️ Storage Limit Reached!\n\nYour browser's storage is full. You have two options:\n\n1. Export your data (Admin Settings → Export & Backup)\n2. Delete older transactions\n3. Clear some unidentified transactions\n\nWould you like to go to Admin Settings to backup your data?`);

      // Calculate storage usage
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }
      console.log(`Total localStorage usage: ${(totalSize / 1024).toFixed(2)} KB`);
    }

    return false;
  }
};

// Load data from localStorage with error handling
const loadFromStorage = (key, defaultValue = null) => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    
    const parsed = JSON.parse(stored);
    return parsed.data || defaultValue;
  } catch (error) {
    console.error('Error loading from storage:', error);
    return defaultValue;
  }
};

// Transaction persistence
export const saveTransactions = (transactions) => {
  return saveToStorage(STORAGE_KEYS.TRANSACTIONS, transactions);
};

export const loadTransactions = () => {
  return loadFromStorage(STORAGE_KEYS.TRANSACTIONS, []);
};

// Unidentified transactions persistence
export const saveUnidentifiedTransactions = (transactions) => {
  return saveToStorage(STORAGE_KEYS.UNIDENTIFIED_TRANSACTIONS, transactions);
};

export const loadUnidentifiedTransactions = () => {
  return loadFromStorage(STORAGE_KEYS.UNIDENTIFIED_TRANSACTIONS, []);
};

// Learned patterns persistence (Map needs special handling)
export const saveLearnedIdentifiers = (learnedMap) => {
  const arrayData = Array.from(learnedMap.entries());
  return saveToStorage(STORAGE_KEYS.LEARNED_IDENTIFIERS, arrayData);
};

export const loadLearnedIdentifiers = () => {
  const arrayData = loadFromStorage(STORAGE_KEYS.LEARNED_IDENTIFIERS, []);
  return new Map(arrayData);
};

// Category mapping persistence
export const saveCategoryMapping = (mapping) => {
  return saveToStorage(STORAGE_KEYS.CATEGORY_MAPPING, mapping);
};

export const loadCategoryMapping = () => {
  const mapping = loadFromStorage(STORAGE_KEYS.CATEGORY_MAPPING, null);
  if (!mapping) return null;

  // Deduplicate by code (keep first occurrence)
  const seen = new Set();
  const deduplicated = mapping.filter(category => {
    if (seen.has(category.code)) {
      console.warn(`⚠️ Removed duplicate category with code: ${category.code}`);
      return false;
    }
    seen.add(category.code);
    return true;
  });

  // If duplicates were found, save the cleaned version
  if (deduplicated.length < mapping.length) {
    console.log(`✓ Deduplication removed ${mapping.length - deduplicated.length} duplicate categories`);
    saveCategoryMapping(deduplicated);
  }

  return deduplicated;
};

// Settings persistence
export const saveSettings = (settings) => {
  return saveToStorage(STORAGE_KEYS.SETTINGS, settings);
};

export const loadSettings = () => {
  return loadFromStorage(STORAGE_KEYS.SETTINGS, {
    selectedYear: new Date().getFullYear(),
    showSensitiveData: true
  });
};

// Utility functions
export const getStorageInfo = () => {
  const info = {};
  Object.values(STORAGE_KEYS).forEach(key => {
    const data = localStorage.getItem(key);
    info[key] = {
      exists: !!data,
      size: data ? data.length : 0,
      sizeKB: data ? Math.round(data.length / 1024 * 10) / 10 : 0
    };
  });
  
  const totalSize = Object.values(info).reduce((sum, item) => sum + item.size, 0);
  info.total = {
    sizeKB: Math.round(totalSize / 1024 * 10) / 10,
    sizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
  };
  
  return info;
};

export const clearAllStorage = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Error clearing storage:', error);
    return false;
  }
};

export const exportAllData = () => {
  const allData = {
    transactions: loadTransactions(),
    unidentifiedTransactions: loadUnidentifiedTransactions(),
    learnedIdentifiers: Array.from(loadLearnedIdentifiers().entries()),
    categoryMapping: loadCategoryMapping(),
    settings: loadSettings(),
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
  
  return allData;
};

export const importAllData = (data) => {
  try {
    if (data.transactions) saveTransactions(data.transactions);
    if (data.unidentifiedTransactions) saveUnidentifiedTransactions(data.unidentifiedTransactions);
    if (data.learnedIdentifiers) saveLearnedIdentifiers(new Map(data.learnedIdentifiers));
    if (data.categoryMapping) saveCategoryMapping(data.categoryMapping);
    if (data.settings) saveSettings(data.settings);
    
    return true;
  } catch (error) {
    console.error('Error importing data:', error);
    return false;
  }
};