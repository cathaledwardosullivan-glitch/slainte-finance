// Sláinte Finance Companion Service Worker
// Provides offline functionality and app-like experience for PWA companion

const CACHE_NAME = 'slainte-finance-v2.1.0';
const RUNTIME_CACHE = 'slainte-runtime-v2';
const API_CACHE = 'slainte-api-v1';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// API routes to cache for offline companion access (read-only endpoints)
const CACHEABLE_API_ROUTES = [
  '/api/sync/data',
  '/api/dashboard',
  '/api/reports',
  '/api/gms-health-check',
  '/api/transactions',
  '/api/categories',
  '/api/payment-analysis'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('[SW] Precaching assets');
        // Cache each asset individually so one failure doesn't block the entire install
        for (const asset of PRECACHE_ASSETS) {
          try {
            await cache.add(asset);
            console.log('[SW] Cached:', asset);
          } catch (err) {
            console.warn('[SW] Failed to cache:', asset, err.message);
          }
        }
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - clean up old caches and cache current assets
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => !currentCaches.includes(name))
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
    .then(() => {
      // Cache the current page's assets (JS, CSS) so offline works immediately
      return cacheCurrentPageAssets();
    })
    .then(() => self.clients.claim()) // Take control immediately
  );
});

/**
 * Fetch the current index.html and extract JS/CSS asset URLs to cache.
 * This ensures offline mode works from the very first visit.
 */
async function cacheCurrentPageAssets() {
  try {
    const response = await fetch('/index.html');
    if (!response.ok) return;
    const html = await response.text();

    // Extract asset URLs from <script src="..."> and <link href="...">
    const assetUrls = [];
    const scriptMatches = html.matchAll(/<script[^>]+src="([^"]+)"/g);
    for (const m of scriptMatches) assetUrls.push(m[1]);
    const linkMatches = html.matchAll(/<link[^>]+href="([^"]+\.css)"/g);
    for (const m of linkMatches) assetUrls.push(m[1]);

    if (assetUrls.length === 0) return;

    const cache = await caches.open(RUNTIME_CACHE);
    await Promise.all(
      assetUrls.map(async url => {
        try {
          const res = await fetch(url);
          if (res.ok) {
            await cache.put(new Request(url), res);
            console.log('[SW] Pre-cached asset:', url);
          }
        } catch (err) {
          console.warn('[SW] Failed to pre-cache asset:', url, err.message);
        }
      })
    );
  } catch (err) {
    console.warn('[SW] Asset pre-caching failed:', err.message);
  }
}

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API routes: network-first with cache fallback for read-only endpoints
  if (url.pathname.startsWith('/api/')) {
    const isCacheable = CACHEABLE_API_ROUTES.some(route => url.pathname === route);

    if (isCacheable && request.method === 'GET') {
      event.respondWith(
        fetch(request)
          .then(response => {
            // Cache successful responses
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(API_CACHE).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Offline: serve from API cache
            console.log('[SW] API offline fallback:', url.pathname);
            return caches.match(request);
          })
      );
      return;
    }

    // Non-cacheable API routes (chat, auth, POST) — always fetch, no cache
    return;
  }

  // Network-first strategy for HTML (always get fresh data)
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the new version — always cache as both the request URL and /index.html
          const responseClone = response.clone();
          const responseClone2 = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone);
            // Also cache as /index.html so SPA fallback always works
            cache.put(new Request('/index.html'), responseClone2);
          });
          return response;
        })
        .catch(() => {
          // Offline: try exact match first, then fall back to /index.html (SPA shell)
          return caches.match(request)
            .then(cached => cached || caches.match('/index.html'))
            .then(cached => cached || caches.match('/'));
        })
    );
    return;
  }

  // Cache-first strategy for assets (JS, CSS, images)
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached version and update in background
          fetch(request).then(response => {
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, response);
            });
          }).catch(() => {
            // Ignore fetch errors when updating cache
          });
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then(response => {
            // Cache the new resource
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
            return response;
          })
          .catch(error => {
            console.error('[SW] Fetch failed:', error);
            // Return offline page if available
            if (request.destination === 'document') {
              return caches.match('/offline.html').then(cached => {
                return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
              });
            }
            // Must return a valid Response for respondWith()
            return new Response('Network error', { status: 503, statusText: 'Service Unavailable' });
          });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

// Background sync for data refresh
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // This will be called when connection is restored
  console.log('[SW] Background sync triggered');

  // Notify clients that sync is available
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_AVAILABLE',
      timestamp: Date.now()
    });
  });
}

// Push notification support (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.url
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

console.log('[SW] Service worker loaded');
