/**
 * useLANMode Hook
 * Detects if the app is running via LAN (mobile accessing desktop)
 * and provides API fetching capabilities
 */
import { useState, useEffect, useCallback } from 'react';

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
  const [error, setError] = useState(null);

  // Check LAN mode on mount
  useEffect(() => {
    const lanMode = isLANMode();
    setIsLAN(lanMode);

    if (lanMode) {
      // Check if we have a valid token
      const token = getAuthToken();
      if (token) {
        // Verify token by making a test API call
        verifyToken(token);
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  // Verify token is still valid
  const verifyToken = async (token) => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/health`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        clearAuthToken();
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('[LAN] Token verification failed:', err);
      setError('Unable to connect to desktop app');
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
