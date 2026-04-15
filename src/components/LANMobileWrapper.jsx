/**
 * LANMobileWrapper Component
 * Handles authentication and data loading for devices
 * accessing the app via LAN (mobile phones and desktop companions)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Wifi, WifiOff, RefreshCw, AlertCircle, Euro, Stethoscope, Sparkles, Monitor } from 'lucide-react';
import useLANMode, { isLANMode } from '../hooks/useLANMode';
import { useAppContext } from '../context/AppContext';
import { FinnProvider } from '../context/FinnContext';
import COLORS from '../utils/colors';
import SlainteLogo from './SlainteLogo';
import MobileLayout from './MobileLayout';
import PWAInstallPrompt from './PWAInstallPrompt';
import BusinessOverview from './BusinessOverview';
import GMSHealthCheckV2 from './GMSHealthCheckV2';
import AdvancedInsightsV2 from './AdvancedInsightsV2';
import UnifiedFinnWidget from './UnifiedFinnWidget';
import FloatingFeedbackButton from './UnifiedFinnWidget/FloatingFeedbackButton';
import { TourProvider } from './Tour';
import { TasksProvider } from '../context/TasksContext';
import TasksWidget from './TasksWidget';
import { saveSyncToIDB } from '../utils/offlineStorage';

export default function LANMobileWrapper() {
  const {
    isLAN,
    isAuthenticated,
    isLoading: authLoading,
    isOffline,
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
  const [lastSynced, setLastSynced] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [currentView, setCurrentView] = useState('business-overview');

  // Use ref to prevent duplicate API calls
  const loadingStarted = useRef(false);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Track screen size for desktop vs mobile layout
  useEffect(() => {
    const checkSize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Auto-refresh data when app returns to foreground (stale > 5 min)
  useEffect(() => {
    if (!dataLoaded || !isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && lastSynced) {
        const staleMs = Date.now() - lastSynced;
        if (staleMs > 5 * 60 * 1000) { // 5 minutes
          console.log('[LAN] Data stale, auto-refreshing...');
          retryLoadData();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [dataLoaded, isAuthenticated, lastSynced]);

  // Load data when authenticated — from API (online) or localStorage (offline demo)
  useEffect(() => {
    // Only run once when authenticated and not already loading/loaded
    if (!isLAN || !isAuthenticated || dataLoaded || loadingStarted.current) {
      return;
    }

    // Mark that we've started loading to prevent duplicate calls
    loadingStarted.current = true;
    setDataLoading(true);
    setDataError(null);

    // Offline demo mode: load from localStorage cache instead of API
    if (isOffline) {
      console.log('[LAN] Offline demo mode — loading from localStorage cache');
      try {
        const loadCachedArray = (key, setter) => {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          try {
            let parsed = JSON.parse(raw);
            // Handle wrapped format { data, timestamp, version } from backup restore
            if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.data)) {
              parsed = parsed.data;
            }
            if (Array.isArray(parsed) && setter) setter(parsed);
          } catch { /* skip corrupt entries */ }
        };

        loadCachedArray('gp_finance_transactions', setTransactions);
        loadCachedArray('gp_finance_unidentified', setUnidentifiedTransactions);
        loadCachedArray('gp_finance_category_mapping', setCategoryMapping);
        loadCachedArray('gp_finance_payment_analysis', setPaymentAnalysisData);
        // These don't have context setters but are in localStorage for components to read
        // loadCached('gp_finance_saved_reports');
        // loadCached('slainte_practice_profile');

        console.log('[LAN] Offline data loaded from cache');
        setDataLoaded(true);
      } catch (err) {
        console.error('[LAN] Failed to load cached data:', err);
        setDataError('Failed to load cached data');
        loadingStarted.current = false;
      }
      setDataLoading(false);
      return;
    }

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

          // Persist to IndexedDB for offline resilience (survives localStorage clearing)
          saveSyncToIDB(data);

          setLastSynced(Date.now());
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
  }, [isLAN, isAuthenticated, isOffline, dataLoaded, fetchAllData, setTransactions, setUnidentifiedTransactions, setCategoryMapping, setPaymentAnalysisData]);

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

        // Persist to IndexedDB for offline resilience
        saveSyncToIDB(data);

        setLastSynced(Date.now());
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bgPage }}>
        <div className="text-center">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin" style={{ color: COLORS.slainteBlue }} />
          <p style={{ color: COLORS.textSecondary }}>Connecting to desktop...</p>
        </div>
      </div>
    );
  }

  // Show server-offline screen when server is unreachable and no cached data
  if (isOffline && !isAuthenticated) {
    return (
      <ServerOfflineScreen
        error={authError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLORS.bgPage }}>
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
                <label className="block text-sm font-medium mb-2" style={{ color: COLORS.textPrimary }}>
                  App Security Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: COLORS.textSecondary }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border"
                    style={{ borderColor: COLORS.borderLight }}
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

            <p className="text-xs text-center mt-4" style={{ color: COLORS.textSecondary }}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bgPage }}>
        <div className="text-center">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin" style={{ color: COLORS.slainteBlue }} />
          <p style={{ color: COLORS.textSecondary }}>Loading your financial data...</p>
        </div>
      </div>
    );
  }

  // Show data error with retry option
  if (dataError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLORS.bgPage }}>
        <div className="w-full max-w-sm text-center">
          <div className="rounded-lg shadow-lg p-6" style={{ backgroundColor: COLORS.white }}>
            <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: COLORS.expenseColor }} />
            <h2 className="text-lg font-bold mb-2" style={{ color: COLORS.textPrimary }}>
              Failed to Load Data
            </h2>
            <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
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

  // Data loaded - show the companion app wrapped in FinnProvider
  // Use desktop layout for large screens (Chromebooks, tablets in landscape, etc.)
  return (
    <FinnProvider>
      <PWAInstallPrompt />
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 px-3 py-1.5 text-center text-xs font-medium"
             style={{ backgroundColor: COLORS.highlightYellow, color: COLORS.textPrimary }}>
          Offline — showing cached data
        </div>
      )}
      {isDesktop ? (
        <TourProvider setCurrentView={setCurrentView} currentView={currentView}>
        <LANDesktopLayout
          currentView={currentView}
          setCurrentView={setCurrentView}
          lastSynced={lastSynced}
          onRefresh={retryLoadData}
          isOffline={isOffline || !isOnline}
        />
        </TourProvider>
      ) : (
        <MobileLayout isOffline={isOffline || !isOnline} mode="companion" lastSynced={lastSynced} onRefresh={retryLoadData} />
      )}
    </FinnProvider>
  );
}

/**
 * Desktop layout for LAN companion devices (Chromebooks, large tablets, etc.)
 * Read-only view of the practice data with full desktop navigation.
 */
function LANDesktopLayout({ currentView, setCurrentView, lastSynced, onRefresh, isOffline }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bgPage }}>
      <header className="shadow-sm" style={{ backgroundColor: COLORS.white, borderBottom: `1px solid ${COLORS.borderLight}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <SlainteLogo size="normal" showFinance={true} />
              <span className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
                Companion View
              </span>
            </div>
            <div className="flex items-center space-x-3">
              {lastSynced && (
                <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                  Synced {new Date(lastSynced).toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={onRefresh}
                className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                style={{ color: COLORS.slainteBlue }}
                title="Refresh data from desktop"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav style={{ backgroundColor: COLORS.white, borderBottom: `1px solid ${COLORS.borderLight}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 justify-center">
            {[
              { id: 'business-overview', label: 'Business Overview', icon: Euro },
              { id: 'gms-health-check', label: 'GMS Health Check', icon: Stethoscope },
              { id: 'advanced-insights', label: 'Advanced Insights', icon: Sparkles }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className="flex items-center space-x-2 py-4 border-b-2 transition-colors"
                style={{
                  color: currentView === item.id ? COLORS.slainteBlue : COLORS.textSecondary,
                  borderColor: currentView === item.id ? COLORS.slainteBlue : 'transparent'
                }}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {isOffline && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2">
          <div className="px-3 py-1.5 rounded text-center text-xs font-medium"
               style={{ backgroundColor: COLORS.highlightYellow, color: COLORS.textPrimary }}>
            Offline — showing cached data
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'business-overview' && <BusinessOverview setCurrentView={setCurrentView} />}
        {currentView === 'gms-health-check' && <GMSHealthCheckV2 />}
        {currentView === 'advanced-insights' && <AdvancedInsightsV2 setCurrentView={setCurrentView} />}
      </main>

      <UnifiedFinnWidget currentView={currentView} />
      <FloatingFeedbackButton />
      <TasksProvider>
        <TasksWidget />
      </TasksProvider>
    </div>
  );
}

/**
 * Server Offline Screen
 * Shown when the companion device can't reach the desktop server
 * and has no cached data to fall back on.
 * Auto-retries every 10 seconds so it connects as soon as the server starts.
 */
function ServerOfflineScreen({ error, onRetry }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState(10);

  // Auto-retry every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Try to reach the server
          setIsRetrying(true);
          fetch(`${window.location.origin}/api/health`, {
            signal: AbortSignal.timeout(5000)
          })
            .then(res => {
              if (res.ok) {
                // Server is back! Reload the page to go through normal auth flow
                window.location.reload();
              }
            })
            .catch(() => {
              // Still offline
              setRetryCount(c => c + 1);
            })
            .finally(() => setIsRetrying(false));
          return 10; // Reset countdown
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLORS.bgPage }}>
      <div className="w-full max-w-sm text-center">
        <div className="rounded-lg shadow-lg p-6" style={{ backgroundColor: COLORS.white }}>
          {/* Logo */}
          <div className="mb-6">
            <SlainteLogo size="normal" showFinance={true} />
          </div>

          {/* Offline icon */}
          <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center"
               style={{ backgroundColor: `${COLORS.highlightYellow}30` }}>
            <WifiOff className="h-8 w-8" style={{ color: COLORS.textSecondary }} />
          </div>

          <h2 className="text-lg font-bold mb-2" style={{ color: COLORS.textPrimary }}>
            Desktop App Not Running
          </h2>

          <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
            Open Slainte Finance on the desktop computer to connect this device.
          </p>

          {/* Connection hint */}
          <div className="mb-5 p-3 rounded-lg text-left" style={{ backgroundColor: COLORS.bgPage }}>
            <div className="flex items-start gap-2">
              <Monitor className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: COLORS.slainteBlue }} />
              <div className="text-xs" style={{ color: COLORS.textSecondary }}>
                <p className="font-medium mb-1" style={{ color: COLORS.textPrimary }}>To connect:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Open Slainte Finance on your desktop</li>
                  <li>Make sure both devices are on the same Wi-Fi</li>
                  <li>This page will connect automatically</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Auto-retry status */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {isRetrying ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" style={{ color: COLORS.slainteBlue }} />
                <span className="text-xs" style={{ color: COLORS.slainteBlue }}>Checking connection...</span>
              </>
            ) : (
              <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                Retrying in {countdown}s{retryCount > 0 ? ` (attempt ${retryCount + 1})` : ''}
              </span>
            )}
          </div>

          {/* Manual retry button */}
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="w-full py-3 rounded-lg font-semibold disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: COLORS.slainteBlue, color: COLORS.white }}
          >
            {isRetrying ? 'Connecting...' : 'Retry Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
