/**
 * offlineStorage.js
 * IndexedDB-based persistence for companion view offline fallback.
 *
 * IndexedDB works over plain HTTP (unlike Service Workers / Cache API),
 * making it reliable for LAN companion devices like Chromebooks that
 * "install" the page as a shortcut app.
 */

const DB_NAME = 'slainte-companion';
const DB_VERSION = 1;
const STORE_NAME = 'sync-data';
const SYNC_KEY = 'last-sync';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save sync data to IndexedDB after a successful server sync.
 * @param {Object} data - The response.data from /api/sync/data
 */
export async function saveSyncToIDB(data) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, SYNC_KEY);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    console.log('[IDB] Sync data saved');
  } catch (err) {
    console.warn('[IDB] Failed to save sync data:', err);
  }
}

/**
 * Load sync data from IndexedDB and restore it into localStorage.
 * Returns true if data was restored, false otherwise.
 */
export async function restoreFromIDB() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(SYNC_KEY);
    const data = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();

    if (!data) return false;

    // Check there's actually something useful in the data
    const hasContent = (
      (Array.isArray(data.transactions) && data.transactions.length > 0) ||
      (Array.isArray(data.categoryMapping) && data.categoryMapping.length > 0) ||
      (Array.isArray(data.paymentAnalysisData) && data.paymentAnalysisData.length > 0) ||
      (data.practiceProfile != null)
    );
    if (!hasContent) return false;

    console.log('[IDB] Restoring sync data to localStorage:', {
      transactions: data.transactions?.length || 0,
      unidentified: data.unidentifiedTransactions?.length || 0,
      categories: data.categoryMapping?.length || 0
    });

    // Write each field back into localStorage
    const restore = (key, value) => {
      if (value != null) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    };
    restore('gp_finance_transactions', data.transactions);
    restore('gp_finance_unidentified', data.unidentifiedTransactions);
    restore('gp_finance_category_mapping', data.categoryMapping);
    restore('gp_finance_payment_analysis', data.paymentAnalysisData);
    restore('gp_finance_saved_reports', data.savedReports);
    restore('gp_finance_learned_identifiers', data.learnedIdentifiers);
    restore('slainte_practice_profile', data.practiceProfile);
    restore('gp_finance_settings', data.settings);

    return true;
  } catch (err) {
    console.warn('[IDB] Failed to restore sync data:', err);
    return false;
  }
}
