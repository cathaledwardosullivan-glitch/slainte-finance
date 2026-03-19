/**
 * Demo Mode Utilities
 *
 * Manages a temporary client-side API key with a 7-day TTL for offline demos.
 * The key auto-deletes after expiry to prevent accidental production use.
 */

const DEMO_KEY_STORAGE = '_demo_api_key';
const DEMO_EXPIRY_STORAGE = '_demo_api_key_expires';
const DEMO_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check if the app is in offline demo mode.
 * True when: not Electron, hostname is a LAN IP (from cached PWA), but server is unreachable.
 * Also true when localStorage has the offline flag set by useLANMode.
 */
export function isDemoMode() {
  return localStorage.getItem('_demo_offline_mode') === 'true';
}

export function setDemoModeFlag(value) {
  if (value) {
    localStorage.setItem('_demo_offline_mode', 'true');
  } else {
    localStorage.removeItem('_demo_offline_mode');
  }
}

/**
 * Store a demo API key with 7-day expiry.
 */
export function setDemoApiKey(key) {
  const expires = Date.now() + DEMO_TTL_MS;
  localStorage.setItem(DEMO_KEY_STORAGE, key);
  localStorage.setItem(DEMO_EXPIRY_STORAGE, String(expires));
}

/**
 * Get the demo API key, or null if expired/missing.
 * Auto-cleans expired keys.
 */
export function getDemoApiKey() {
  const key = localStorage.getItem(DEMO_KEY_STORAGE);
  const expires = localStorage.getItem(DEMO_EXPIRY_STORAGE);

  if (!key || !expires) return null;

  if (Date.now() > Number(expires)) {
    clearDemoApiKey();
    return null;
  }

  return key;
}

/**
 * Get remaining time on the demo key in a human-readable format.
 */
export function getDemoKeyTimeRemaining() {
  const expires = localStorage.getItem(DEMO_EXPIRY_STORAGE);
  if (!expires) return null;

  const remaining = Number(expires) - Date.now();
  if (remaining <= 0) return null;

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

/**
 * Remove the demo API key and expiry.
 */
export function clearDemoApiKey() {
  localStorage.removeItem(DEMO_KEY_STORAGE);
  localStorage.removeItem(DEMO_EXPIRY_STORAGE);
}

/**
 * Clean up all demo mode state.
 */
export function clearDemoMode() {
  clearDemoApiKey();
  setDemoModeFlag(false);
}

/**
 * Run on app startup — auto-cleans expired keys.
 */
export function initDemoMode() {
  getDemoApiKey(); // triggers expiry check
}
