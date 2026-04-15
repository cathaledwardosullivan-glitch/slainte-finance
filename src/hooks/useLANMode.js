/**
 * useLANMode Hook
 * Detects if the app is running via LAN (mobile accessing desktop)
 * and provides API fetching capabilities
 */
import { useState, useEffect, useCallback } from 'react';
import { setDemoModeFlag, initDemoMode } from '../utils/demoMode';
import { restoreFromIDB } from '../utils/offlineStorage';

/**
 * Check if we're running in LAN mode (mobile accessing via IP)
 * vs Electron mode (desktop app) or development mode
 */
export function isLANMode() {
  // If Electron API is available, we're in desktop mode
  if (window.electronAPI?.isElectron) {
    return false;
  }

  // Check if accessing via LAN IP address
  const hostname = window.location.hostname;

  // LAN IP patterns
  const isLANIP =
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname);

  return isLANIP;
}

/**
 * Get the API base URL
 */
export function getAPIBaseURL() {
  // Use current origin if on LAN, otherwise localhost
  if (isLANMode()) {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return 'http://localhost:3001';
}

/**
 * Get the stored auth token
 */
export function getAuthToken() {
  return localStorage.getItem('partner_token');
}

/**
 * Store the auth token
 */
export function setAuthToken(token) {
  localStorage.setItem('partner_token', token);
}

/**
 * Clear the auth token
 */
export function clearAuthToken() {
  localStorage.removeItem('partner_token');
}

/**
 * Main hook for LAN mode data fetching
 */
export default function useLANMode() {
  const [isLAN, setIsLAN] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState(null);

  // Check LAN mode on mount
  useEffect(() => {
    // Clean up expired demo keys on startup
    initDemoMode();

    const lanMode = isLANMode();
    setIsLAN(lanMode);

    if (lanMode) {
      // Check if we have a valid token
      const token = getAuthToken();
      if (token) {
        // Verify token by making a test API call
        verifyToken(token);
      } else {
        // No token — check if the server is reachable so the user can log in.
        // Only fall back to offline demo mode if the server is unreachable
        // AND we have cached data from a previous session.
        checkServerOrOffline();
        return; // checkServerOrOffline will call setIsLoading(false)
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  // No token — check if server is reachable so user can log in,
  // otherwise fall back to offline demo mode if cached data exists.
  const checkServerOrOffline = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      await fetch(`${getAPIBaseURL()}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      // Server is reachable — show login screen so user can re-authenticate
      console.log('[LAN] No token, server reachable — showing login screen');
    } catch {
      // Server unreachable — use cached data if available
      if (hasCachedData()) {
        console.log('[LAN] No token, server unreachable, cached data found — entering offline demo mode');
        setIsOffline(true);
        setDemoModeFlag(true);
        setIsAuthenticated(true);
      } else {
        // localStorage is empty (Chromebook PWAs can clear it between sessions).
        // Try IndexedDB — it works over plain HTTP (unlike SW/Cache API) and is
        // more persistent than localStorage for installed web app shortcuts.
        const restored = await restoreFromIDB();
        if (restored) {
          console.log('[LAN] Restored data from IndexedDB — entering offline demo mode');
          setIsOffline(true);
          setDemoModeFlag(true);
          setIsAuthenticated(true);
        } else {
          console.log('[LAN] No token, no cached data, server unreachable');
          setIsOffline(true);
          setError('Unable to connect to desktop app. Make sure the desktop app is running.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Verify token is still valid (with timeout to avoid hanging on unreachable server)
  const verifyToken = async (token) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(`${getAPIBaseURL()}/api/health`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        setIsAuthenticated(true);
        setIsOffline(false);
        setDemoModeFlag(false);
      } else {
        clearAuthToken();
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('[LAN] Token verification failed (network error):', err);
      // Network error — server unreachable. Token exists so user was previously
      // authenticated. Trust the stored token and enter offline mode — the data
      // loading phase will handle missing/empty data gracefully.
      console.log('[LAN] Server unreachable, stored token found — entering offline mode');
      setIsOffline(true);
      setDemoModeFlag(true);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Login with password
  const login = useCallback(async (password) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (data.success && data.token) {
        setAuthToken(data.token);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        setError(data.error || 'Login failed');
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('[LAN] Login error:', err);
      setError('Unable to connect to desktop app');
      return { success: false, error: 'Connection failed' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    clearAuthToken();
    setIsAuthenticated(false);
  }, []);

  // Fetch data from API
  const fetchAPI = useCallback(async (endpoint) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${getAPIBaseURL()}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      clearAuthToken();
      setIsAuthenticated(false);
      throw new Error('Session expired');
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }, []);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    return fetchAPI('/api/dashboard');
  }, [fetchAPI]);

  // Fetch all transactions
  const fetchTransactions = useCallback(async () => {
    return fetchAPI('/api/transactions');
  }, [fetchAPI]);

  // Fetch all data (full sync)
  const fetchAllData = useCallback(async () => {
    return fetchAPI('/api/sync/data');
  }, [fetchAPI]);

  // Fetch saved reports
  const fetchReports = useCallback(async () => {
    return fetchAPI('/api/reports');
  }, [fetchAPI]);

  // Fetch GMS health check
  const fetchGMSHealthCheck = useCallback(async () => {
    return fetchAPI('/api/gms-health-check');
  }, [fetchAPI]);

  return {
    isLAN,
    isAuthenticated,
    isLoading,
    isOffline,
    error,
    login,
    logout,
    fetchAPI,
    fetchDashboard,
    fetchTransactions,
    fetchAllData,
    fetchReports,
    fetchGMSHealthCheck
  };
}

/**
 * Check if localStorage has enough cached data from a previous sync
 * to run the app in offline demo mode. Checks multiple data sources
 * since the user may have PCRS/GMS data but no bank transactions.
 */
function hasCachedData() {
  try {
    const checks = [
      'gp_finance_transactions',
      'gp_finance_category_mapping',
      'gp_finance_payment_analysis',
      'slainte_practice_profile'
    ];
    return checks.some(key => {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length > 0 : !!parsed;
    });
  } catch {
    return false;
  }
}
