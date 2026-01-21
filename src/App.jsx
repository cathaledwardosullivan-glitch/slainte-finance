import React, { useState, useEffect, useCallback } from 'react';
import { Activity, DollarSign } from 'lucide-react';

// Import the AppProvider to make the context available
import { AppProvider, useAppContext } from './context/AppContext';

// Import FinnProvider for the unified Finn widget
import { FinnProvider } from './context/FinnContext';

// Import TasksProvider for the tasks widget
import { TasksProvider } from './context/TasksContext';

// Import color constants
import COLORS from './utils/colors';

// Import components
import { FloatingFinancialChat } from './components/FloatingFinancialChat';
import UnifiedFinnWidget from './components/UnifiedFinnWidget';
import TasksWidget from './components/TasksWidget';
import SlainteLogo from './components/SlainteLogo';
import ModuleSelector from './components/ModuleSelector';
import UnifiedOnboarding from './components/UnifiedOnboarding';
import FinancesOverview from './components/FinancesOverview';
import GMSOverview from './components/GMSOverview';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWAUpdateNotification from './components/PWAUpdateNotification';
import LoginScreen from './components/LoginScreen';
import LicenseLockout from './components/LicenseLockout';
import SettingsModal from './components/Settings';
import SettingsButton from './components/Settings/SettingsButton';

/**
 * Legacy view mapping - redirects old view IDs to new consolidated tabs
 * This ensures existing setCurrentView calls throughout the codebase
 * continue to work with the new 2-tab navigation structure
 */
const mapLegacyView = (viewId) => {
  const legacyMapping = {
    // Financial views -> Finances Overview
    'dashboard': 'finances-overview',
    'export': 'finances-overview',
    'transactions': 'finances-overview',
    'chat': 'finances-overview',
    // GMS views -> GMS Overview
    'gms-panel': 'gms-overview',
    'gms-health-check': 'gms-overview',
    'interactive-health-check': 'gms-overview',
    // Admin -> Opens Settings modal (handled separately)
    'admin': 'finances-overview', // Default to finances, settings modal opens via callback
    // Upload -> Finances Overview (upload is in Settings now)
    'upload': 'finances-overview'
  };
  return legacyMapping[viewId] || viewId;
};

// Import Tour components
import { TourProvider, TourOverlay } from './components/Tour';

// Import Mobile Layout with LAN support
import LANMobileWrapper from './components/LANMobileWrapper';
import { isLANMode } from './hooks/useLANMode';

// This is the main layout component, now with mobile responsiveness.
function AppLayout() {
    const [currentView, setCurrentViewInternal] = useState('finances-overview');
    const [isMobile, setIsMobile] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Feature flag for unified Finn widget
    // Default to true (new Finn) unless explicitly set to 'false'
    const [useUnifiedFinn, setUseUnifiedFinn] = useState(() => {
        return localStorage.getItem('USE_UNIFIED_FINN') !== 'false';
    });

    // Wrapper for setCurrentView that handles legacy view mapping
    const setCurrentView = useCallback((viewId) => {
        // Special handling for 'admin' - open settings modal instead
        if (viewId === 'admin') {
            setShowSettings(true);
            return;
        }
        // Map legacy views to new consolidated tabs
        const mappedView = mapLegacyView(viewId);
        setCurrentViewInternal(mappedView);
    }, []);

    // Get data from context - only destructure what exists
    const contextData = useAppContext();
    const {
        isLoading,
        transactions = [],
        unidentifiedTransactions = [],
        paymentAnalysisData = [],
        showSensitiveData = true,
        selectedYear = new Date().getFullYear(),
        categoryMapping = []
    } = contextData;

    // Safely get other functions/data
    const categorizeTransaction = contextData.categorizeTransaction || (() => { });
    const summaries = contextData.summaries || {
        income: 0,
        expenses: 0,
        netProfit: 0,
        monthlyTrends: []
    };

    // Check if first-run onboarding needed
    useEffect(() => {
        // Skip onboarding check in LAN mode - setup is done on desktop
        if (isLANMode()) {
            return;
        }

        // Check new unified profile system
        const profileData = localStorage.getItem('slainte_practice_profile');
        let setupComplete = false;

        if (profileData) {
            try {
                const profile = JSON.parse(profileData);
                setupComplete = profile?.metadata?.setupComplete === true;
            } catch (err) {
                console.error('Error parsing profile:', err);
            }
        }

        // Also check for personalized categories as fallback
        const hasPersonalizedCategories = categoryMapping.some(c => c.personalization === 'Personalized');

        // Show onboarding if:
        // 1. Profile setup not complete AND
        // 2. No personalized categories exist
        if (!setupComplete && !hasPersonalizedCategories) {
            setShowOnboarding(true);
        }
    }, [categoryMapping]);

    // Mobile detection
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768); // Mobile if under 768px
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Handle onboarding completion
    const handleOnboardingComplete = (result) => {
        console.log('Onboarding completed:', result);
        setShowOnboarding(false);

        // Reload to apply new categories and profile
        window.location.reload();
    };

    // Handle onboarding skip
    const handleOnboardingSkip = () => {
        // Just close onboarding, don't reload
        setShowOnboarding(false);
    };

    // Show onboarding if needed
    if (showOnboarding) {
        return (
            <UnifiedOnboarding
                onComplete={handleOnboardingComplete}
                onSkip={handleOnboardingSkip}
            />
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.backgroundGray }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: COLORS.slainteBlue }}></div>
                    <p style={{ color: COLORS.mediumGray }}>Loading your financial data...</p>
                </div>
            </div>
        );
    }

    // Mobile layout - uses LANMobileWrapper for LAN mode support
    if (isMobile) {
        return <LANMobileWrapper />;
    }

    // Desktop layout (your existing layout)
    return (
        <TourProvider setCurrentView={setCurrentView} currentView={currentView}>
        <div className="min-h-screen" style={{ backgroundColor: COLORS.backgroundGray }}>
            <header className="shadow-sm" style={{ backgroundColor: COLORS.white, borderBottom: `1px solid ${COLORS.lightGray}` }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center space-x-4">
                            <SlainteLogo size="normal" showFinance={true} />
                            <span className="text-sm font-medium" style={{ color: COLORS.mediumGray }}>
                                Putting Ai at the Heart of Healthcare
                            </span>
                        </div>
                        <ModuleSelector />
                    </div>
                </div>
            </header>

            <nav style={{ backgroundColor: COLORS.white, borderBottom: `1px solid ${COLORS.lightGray}` }} data-tour-id="nav-tabs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex space-x-8 justify-center">
                            {[
                                { id: 'finances-overview', label: 'Finances Overview', icon: DollarSign },
                                { id: 'gms-overview', label: 'GMS Overview', icon: Activity }
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setCurrentView(item.id)}
                                    className="flex items-center space-x-2 py-4 border-b-2 transition-colors"
                                    style={{
                                        color: currentView === item.id ? COLORS.slainteBlue : COLORS.mediumGray,
                                        borderColor: currentView === item.id ? COLORS.slainteBlue : 'transparent'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (currentView !== item.id) {
                                            e.currentTarget.style.borderColor = COLORS.lightGray;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (currentView !== item.id) {
                                            e.currentTarget.style.borderColor = 'transparent';
                                        }
                                    }}
                                >
                                    <item.icon className="h-5 w-5" />
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            ))}
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {currentView === 'finances-overview' && <FinancesOverview setCurrentView={setCurrentView} />}
                {currentView === 'gms-overview' && <GMSOverview setCurrentView={setCurrentView} />}
            </main>

            {/* Chat Widget - Conditionally render unified Finn or legacy Cara */}
            {useUnifiedFinn ? (
              <FinnProvider>
                <UnifiedFinnWidget currentView={currentView} />
              </FinnProvider>
            ) : (
              <FloatingFinancialChat currentView={currentView} />
            )}

            {/* Tasks Widget - Right side */}
            <TasksProvider>
              <TasksWidget />
            </TasksProvider>

            {/* Settings Button & Modal */}
            <SettingsButton onClick={() => setShowSettings(true)} />
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

            {/* PWA Components */}
            <PWAInstallPrompt />
            <PWAUpdateNotification />

            {/* Footer */}
            <footer className="mt-12" style={{ backgroundColor: COLORS.white, borderTop: `1px solid ${COLORS.lightGray}` }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm" style={{ color: COLORS.mediumGray }}>
                            <SlainteLogo size="small" showFinance={false} />
                            <span>© 2025 Slainte. All rights reserved.</span>
                        </div>
                        <div className="text-sm" style={{ color: COLORS.mediumGray }}>
                            Putting Ai at the Heart of Healthcare
                        </div>
                    </div>
                </div>
            </footer>
        </div>

        {/* Tour Overlay - renders when tour is active */}
        <TourOverlay />
        </TourProvider>
    );
}

// The root component now wraps the AppLayout with the provider and handles login.
export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isLicenseLocked, setIsLicenseLocked] = useState(false);
    const [licenseCheckComplete, setLicenseCheckComplete] = useState(false);

    // Check license status on mount (before authentication)
    useEffect(() => {
        const checkLicenseStatus = async () => {
            // Skip license check in non-Electron environments
            if (!window.electronAPI?.isElectron) {
                setLicenseCheckComplete(true);
                return;
            }

            try {
                const status = await window.electronAPI.getLicenseStatus();
                if (status.locked) {
                    setIsLicenseLocked(true);
                }
            } catch (error) {
                console.error('[License] Error checking license status:', error);
                // Don't lock out on error
            }
            setLicenseCheckComplete(true);
        };

        checkLicenseStatus();

        // Listen for real-time license status updates
        if (window.electronAPI?.onLicenseStatus) {
            window.electronAPI.onLicenseStatus((status) => {
                if (status.locked) {
                    setIsLicenseLocked(true);
                }
            });
        }

        return () => {
            if (window.electronAPI?.removeLicenseStatusListener) {
                window.electronAPI.removeLicenseStatusListener();
            }
        };
    }, []);

    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = async () => {
        // Skip login in LAN mode - mobile users authenticate via the API server
        if (isLANMode()) {
            setIsAuthenticated(true);
            setIsCheckingAuth(false);
            return;
        }

        // Check if running in Electron with password configured
        const isElectron = window.electronAPI?.isElectron;
        if (!isElectron) {
            // Not in Electron, skip login
            setIsAuthenticated(true);
            setIsCheckingAuth(false);
            return;
        }

        try {
            // CRITICAL: First check if API key is configured
            // If no API key exists, user MUST go through onboarding first
            // This takes priority over any password check
            const apiKey = await window.electronAPI.getLocalStorage('claude_api_key');

            if (!apiKey) {
                // No API key configured - skip login and let onboarding run
                // Onboarding will set up API key first, then password
                console.log('[Auth] No API key found - skipping login for onboarding');
                setIsAuthenticated(true);
                setIsCheckingAuth(false);
                return;
            }

            // ALSO check if the practice profile setup is complete
            // Even if there's an API key, if onboarding wasn't completed, skip login
            const profileData = await window.electronAPI.getLocalStorage('slainte_practice_profile');
            let setupComplete = false;

            if (profileData) {
                try {
                    const profile = JSON.parse(profileData);
                    setupComplete = profile?.metadata?.setupComplete === true;
                } catch (err) {
                    console.error('[Auth] Error parsing profile:', err);
                }
            }

            if (!setupComplete) {
                // Setup not complete - skip login and let onboarding run
                console.log('[Auth] Setup not complete - skipping login for onboarding');
                setIsAuthenticated(true);
                setIsCheckingAuth(false);
                return;
            }

            // Additional check: Verify there's actual user data
            // This prevents lockout from stale credentials on fresh installs
            const transactionsData = await window.electronAPI.getLocalStorage('gp_finance_transactions');
            let hasTransactions = false;
            try {
                const transactions = transactionsData ? JSON.parse(transactionsData) : [];
                hasTransactions = Array.isArray(transactions) && transactions.length > 0;
            } catch (err) {
                console.error('[Auth] Error parsing transactions:', err);
            }

            if (!hasTransactions) {
                // No transaction data - likely a fresh install with stale credentials
                console.log('[Auth] No transaction data found - skipping login (likely fresh install)');
                setIsAuthenticated(true);
                setIsCheckingAuth(false);
                return;
            }

            // Check if password is configured
            const status = await window.electronAPI.getMobileAccessStatus();

            if (!status.isConfigured) {
                // No password set yet, allow access (will be set during onboarding)
                setIsAuthenticated(true);
                setIsCheckingAuth(false);
                return;
            }

            // Password is configured - check for valid session
            const sessionToken = localStorage.getItem('app_session_token');
            const sessionExpiry = localStorage.getItem('app_session_expiry');

            if (sessionToken && sessionExpiry) {
                const expiryTime = parseInt(sessionExpiry, 10);
                if (Date.now() < expiryTime) {
                    // Valid session exists
                    setIsAuthenticated(true);
                    setIsCheckingAuth(false);
                    return;
                } else {
                    // Session expired, clear it
                    localStorage.removeItem('app_session_token');
                    localStorage.removeItem('app_session_expiry');
                }
            }

            // No valid session - require login
            setIsAuthenticated(false);
            setIsCheckingAuth(false);
        } catch (error) {
            console.error('Error checking authentication:', error);
            // Check if this is an IPC handler error (main process issue)
            if (error.message?.includes('No handler registered')) {
                console.warn('IPC handlers not ready - this may happen during dev hot reload. Allowing access.');
            }
            // On error, allow access to prevent lockout
            setIsAuthenticated(true);
            setIsCheckingAuth(false);
        }
    };

    const handleLogin = () => {
        setIsAuthenticated(true);
    };

    // Show lockout screen FIRST if license is locked (highest priority)
    if (isLicenseLocked) {
        return <LicenseLockout />;
    }

    // Show loading while checking auth or license
    if (isCheckingAuth || !licenseCheckComplete) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.backgroundGray }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: COLORS.slainteBlue }}></div>
                    <p style={{ color: COLORS.mediumGray }}>Loading...</p>
                </div>
            </div>
        );
    }

    // Show login screen if not authenticated
    if (!isAuthenticated) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    return (
        <AppProvider>
            <AppLayout />
        </AppProvider>
    );
}