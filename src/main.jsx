import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register service worker for PWA functionality
// Skip in Electron (file:// protocol doesn't support service workers)
const isElectron = window.electronAPI?.isElectron || window.location.protocol === 'file:';
if ('serviceWorker' in navigator && !isElectron) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[PWA] Service Worker registered successfully:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              console.log('[PWA] New version available. Refresh to update.');
              // Notify user via custom event
              window.dispatchEvent(new CustomEvent('sw-update-available'));
            }
          });
        });
      })
      .catch(error => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
  });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_AVAILABLE') {
      // Notify app that background sync is available
      window.dispatchEvent(new CustomEvent('sync-available', {
        detail: { timestamp: event.data.timestamp }
      }));
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
