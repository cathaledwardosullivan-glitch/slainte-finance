import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import COLORS from '../utils/colors';

/**
 * PWA Update Notification
 * Shows a banner when a new version is available
 */
export default function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      setShowUpdate(true);
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = () => {
    // Tell service worker to skip waiting
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }

    // Reload the page to get the new version
    window.location.reload();
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div
      className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 rounded-lg shadow-lg p-4 border"
      style={{
        backgroundColor: COLORS.white,
        borderColor: COLORS.incomeColor,
        borderWidth: '2px'
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center animate-spin-slow"
          style={{ backgroundColor: `${COLORS.incomeColor}20` }}
        >
          <RefreshCw className="h-5 w-5" style={{ color: COLORS.incomeColor }} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1" style={{ color: COLORS.textPrimary }}>
            Update Available
          </h3>
          <p className="text-sm mb-3" style={{ color: COLORS.textSecondary }}>
            A new version of Sláinte Finance is available
          </p>
          <button
            onClick={handleUpdate}
            className="w-full py-2 px-4 rounded-lg font-medium text-white text-sm"
            style={{ backgroundColor: COLORS.incomeColor }}
          >
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
}
