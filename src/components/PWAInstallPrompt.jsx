import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import COLORS from '../utils/colors';

/**
 * PWA Install Prompt Component
 * Shows a prompt to install the app on mobile/desktop
 */
export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone
      || document.referrer.includes('android-app://');

    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show prompt if not standalone and not recently dismissed
    if (!standalone && daysSinceDismissed > 7) {
      // For iOS, show after a delay
      if (iOS) {
        setTimeout(() => setShowPrompt(true), 3000);
      }

      // Listen for beforeinstallprompt event (Chrome, Edge, etc)
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => setShowPrompt(true), 3000);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response: ${outcome}`);

    // Clear the prompt
    setDeferredPrompt(null);
    setShowPrompt(false);

    // Track installation
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-installed', Date.now().toString());
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) {
    return null;
  }

  // iOS Install Instructions
  if (isIOS && !deferredPrompt) {
    return (
      <div
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 rounded-lg shadow-lg p-4 border"
        style={{
          backgroundColor: COLORS.white,
          borderColor: COLORS.slainteBlue,
          borderWidth: '2px'
        }}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded"
          style={{ color: COLORS.textSecondary }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 mb-3">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${COLORS.slainteBlue}20` }}
          >
            <Smartphone className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-1" style={{ color: COLORS.textPrimary }}>
              Install Sláinte Finance
            </h3>
            <p className="text-xs" style={{ color: COLORS.textSecondary }}>
              Add to your home screen for quick access
            </p>
          </div>
        </div>

        <div className="text-xs space-y-2" style={{ color: COLORS.textPrimary }}>
          <p className="font-medium">To install:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Tap the Share button <span className="inline-block">📤</span></li>
            <li>Scroll down and tap "Add to Home Screen"</li>
            <li>Tap "Add" in the top right</li>
          </ol>
        </div>
      </div>
    );
  }

  // Chrome/Edge Install Prompt
  return (
    <div
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 rounded-lg shadow-lg p-4 border"
      style={{
        backgroundColor: COLORS.white,
        borderColor: COLORS.slainteBlue,
        borderWidth: '2px'
      }}
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded"
        style={{ color: COLORS.textSecondary }}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 mb-4">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${COLORS.slainteBlue}20` }}
        >
          <Download className="h-5 w-5" style={{ color: COLORS.slainteBlue }} />
        </div>
        <div>
          <h3 className="font-semibold mb-1" style={{ color: COLORS.textPrimary }}>
            Install Sláinte Finance
          </h3>
          <p className="text-sm" style={{ color: COLORS.textSecondary }}>
            Install the app for offline access and a better experience
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleInstall}
          className="flex-1 py-2 px-4 rounded-lg font-medium text-white text-sm"
          style={{ backgroundColor: COLORS.slainteBlue }}
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            color: COLORS.textSecondary,
            border: `1px solid ${COLORS.borderLight}`
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
