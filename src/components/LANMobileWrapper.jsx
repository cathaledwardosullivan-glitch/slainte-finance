/**
 * LANMobileWrapper Component
 * Handles authentication and data loading for mobile devices
 * accessing the app via LAN
 */
import React, { useState, useEffect, useRef } from 'react';
import { Lock, Wifi, RefreshCw, AlertCircle } from 'lucide-react';
import useLANMode, { isLANMode } from '../hooks/useLANMode';
import { useAppContext } from '../context/AppContext';
import COLORS from '../utils/colors';
import SlainteLogo from './SlainteLogo';
import MobileLayout from './MobileLayout';

export default function LANMobileWrapper() {
  const {
    isLAN,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    login,
    fetchAllData
  } = useLANMode();

  const {
    setTransactions,
    setUnidentifiedTransactions,
    setCategoryMapping,
    setPaymentAnalysisData
  } = useAppContext();

  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState(null);

  // Use ref to prevent duplicate API calls
  const loadingStarted = useRef(false);

  // Load data from API when authenticated (must be before any conditional returns)
  useEffect(() => {
    // Only run once when authenticated and not already loading/loaded
    if (!isLAN || !isAuthenticated || dataLoaded || loadingStarted.current) {
      return;
    }

    // Mark that we've started loading to prevent duplicate calls
    loadingStarted.current = true;
    setDataLoading(true);
    setDataError(null);

    const loadData = async () => {
      try {
        console.log('[LAN] Fetching data from desktop...');
        const response = await fetchAllData();
        console.log('[LAN] API Response:', response);

        if (response && response.success && response.data) {
          const data = response.data;

          // Store in localStorage for offline access and to update context
          if (data.transactions) {
            localStorage.setItem('gp_finance_transactions', JSON.stringify(data.transactions));
            setTransactions(data.transactions);
          }

          if (data.unidentifiedTransactions) {
            localStorage.setItem('gp_finance_unidentified', JSON.stringify(data.unidentifiedTransactions));
            setUnidentifiedTransactions(data.unidentifiedTransactions);
          }

          if (data.categoryMapping) {
            localStorage.setItem('gp_finance_category_mapping', JSON.stringify(data.categoryMapping));
            setCategoryMapping(data.categoryMapping);
          }

          if (data.paymentAnalysisData) {
            localStorage.setItem('gp_finance_payment_analysis', JSON.stringify(data.paymentAnalysisData));
            setPaymentAnalysisData(data.paymentAnalysisData);
          }

          if (data.savedReports) {
            localStorage.setItem('gp_finance_saved_reports', JSON.stringify(data.savedReports));
          }

          if (data.learnedIdentifiers) {
            localStorage.setItem('gp_finance_learned_identifiers', JSON.stringify(data.learnedIdentifiers));
          }

          if (data.practiceProfile) {
            localStorage.setItem('slainte_practice_profile', JSON.stringify(data.practiceProfile));
          }

          if (data.settings) {
            localStorage.setItem('gp_finance_settings', JSON.stringify(data.settings));
          }

          console.log('[LAN] Data loaded successfully:', {
            transactions: data.transactions?.length || 0,
            unidentified: data.unidentifiedTransactions?.length || 0,
            reports: data.savedReports?.length || 0
          });

          setDataLoaded(true);
          setDataLoading(false);
        } else {
          throw new Error(response?.error || 'Invalid response from server');
        }
      } catch (err) {
        console.error('[LAN] Failed to load data:', err);
        setDataError(err.message || 'Failed to load data from desktop');
        setDataLoading(false);
        // Reset the ref so retry can work
        loadingStarted.current = false;
      }
    };

    loadData();
  }, [isLAN, isAuthenticated, dataLoaded, fetchAllData, setTransactions, setUnidentifiedTransactions, setCategoryMapping, setPaymentAnalysisData]);

  // Function for manual retry
  const retryLoadData = async () => {
    setDataError(null);
    setDataLoading(true);

    try {
      const response = await fetchAllData();

      if (response && response.success && response.data) {
        const data = response.data;

        if (data.transactions) {
          localStorage.setItem('gp_finance_transactions', JSON.stringify(data.transactions));
          setTransactions(data.transactions);
        }
        if (data.unidentifiedTransactions) {
          localStorage.setItem('gp_finance_unidentified', JSON.stringify(data.unidentifiedTransactions));
          setUnidentifiedTransactions(data.unidentifiedTransactions);
        }
        if (data.categoryMapping) {
          localStorage.setItem('gp_finance_category_mapping', JSON.stringify(data.categoryMapping));
          setCategoryMapping(data.categoryMapping);
        }
        if (data.paymentAnalysisData) {
          localStorage.setItem('gp_finance_payment_analysis', JSON.stringify(data.paymentAnalysisData));
          setPaymentAnalysisData(data.paymentAnalysisData);
        }
        if (data.savedReports) {
          localStorage.setItem('gp_finance_saved_reports', JSON.stringify(data.savedReports));
        }
        if (data.learnedIdentifiers) {
          localStorage.setItem('gp_finance_learned_identifiers', JSON.stringify(data.learnedIdentifiers));
        }
        if (data.practiceProfile) {
          localStorage.setItem('slainte_practice_profile', JSON.stringify(data.practiceProfile));
        }
        if (data.settings) {
          localStorage.setItem('gp_finance_settings', JSON.stringify(data.settings));
        }

        setDataLoaded(true);
      } else {
        throw new Error(response?.error || 'Invalid response from server');
      }
    } catch (err) {
      console.error('[LAN] Retry failed:', err);
      setDataError(err.message || 'Failed to load data from desktop');
    } finally {
      setDataLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    const result = await login(password);

    if (!result.success) {
      setLoginError(result.error || 'Login failed');
    }

    setIsLoggingIn(false);
  };

  // If not LAN mode, just render MobileLayout normally (after all hooks)
  if (!isLAN) {
    return <MobileLayout />;
  }

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.backgroundGray }}>
        <div className="text-center">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin" style={{ color: COLORS.slainteBlue }} />
          <p style={{ color: COLORS.mediumGray }}>Connecting to desktop...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLORS.backgroundGray }}>
        <div className="w-full max-w-sm">
          <div className="rounded-lg shadow-lg p-6" style={{ backgroundColor: COLORS.white }}>
            {/* Logo */}
            <div className="text-center mb-6">
              <SlainteLogo size="normal" showFinance={true} />
            </div>

            {/* Connection indicator */}
            <div className="flex items-center justify-center gap-2 mb-6 p-3 rounded-lg" style={{ backgroundColor: `${COLORS.incomeColor}15` }}>
              <Wifi className="h-5 w-5" style={{ color: COLORS.incomeColor }} />
              <span className="text-sm font-medium" style={{ color: COLORS.incomeColor }}>
                Connected via LAN
              </span>
            </div>

            {/* Error message */}
            {(authError || loginError) && (
              <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: `${COLORS.expenseColor}15` }}>
                <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: COLORS.expenseColor }} />
                <p className="text-sm" style={{ color: COLORS.expenseColor }}>
                  {authError || loginError}
                </p>
              </div>
            )}

            {/* Login form */}
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.darkGray }}>
                  App Security Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: COLORS.mediumGray }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border"
                    style={{ borderColor: COLORS.lightGray }}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || !password}
                className="w-full py-3 rounded-lg font-semibold disabled:opacity-50"
                style={{ backgroundColor: COLORS.slainteBlue, color: COLORS.white }}
              >
                {isLoggingIn ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-xs text-center mt-4" style={{ color: COLORS.mediumGray }}>
              Enter the App Security Password set during desktop setup
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show data loading screen
  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.backgroundGray }}>
        <div className="text-center">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin" style={{ color: COLORS.slainteBlue }} />
          <p style={{ color: COLORS.mediumGray }}>Loading your financial data...</p>
        </div>
      </div>
    );
  }

  // Show data error with retry option
  if (dataError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLORS.backgroundGray }}>
        <div className="w-full max-w-sm text-center">
          <div className="rounded-lg shadow-lg p-6" style={{ backgroundColor: COLORS.white }}>
            <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: COLORS.expenseColor }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: COLORS.darkGray }}>
              Failed to Load Data
            </h2>
            <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
              {dataError}
            </p>
            <button
              onClick={retryLoadData}
              className="w-full py-3 rounded-lg font-semibold"
              style={{ backgroundColor: COLORS.slainteBlue, color: COLORS.white }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Data loaded - show the mobile app
  return <MobileLayout />;
}
