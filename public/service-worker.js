/* UofT Triathlon PWA Service Worker - Enhanced Version */

// Import cache manager utilities (these will be inlined in production)
// For now, we'll include the logic directly in the service worker

// Cache version - increment on each deployment to force update
const CACHE_VERSION = 'v2.0.0';

// Cache names
const CACHE_NAMES = {
  STATIC: `static-cache-${CACHE_VERSION}`,
  API: `api-cache-${CACHE_VERSION}`,
  IMAGES: `images-cache-${CACHE_VERSION}`,
  DYNAMIC: `dynamic-cache-${CACHE_VERSION}`
};

// Maximum cache sizes (in MB)
const MAX_CACHE_SIZES = {
  STATIC: 10,
  API: 5,
  IMAGES: 50,
  DYNAMIC: 20
};

const OFFLINE_URL = '/offline.html';

// Static assets to cache on install
const STATIC_ASSETS = [
  OFFLINE_URL,
  '/images/icon.png',
  '/manifest.json',
];

// Cache strategy helpers
function getCacheStrategy(request) {
  const url = new URL(request.url);
  
  // Static assets (images, fonts)
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$/i) ||
      url.pathname.startsWith('/images/') ||
      url.pathname.startsWith('/uploads/')) {
    return 'cache-first';
  }
  
  // API requests
  if (url.pathname.startsWith('/api/')) {
    return 'network-first';
  }
  
  // Dynamic content (JS/CSS with hashes)
  if (url.pathname.match(/\.(js|css)$/i)) {
    return 'stale-while-revalidate';
  }
  
  // Default: network-first
  return 'network-first';
}

function getCacheName(request) {
  const url = new URL(request.url);
  
  // Images
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ||
      url.pathname.startsWith('/images/') ||
      url.pathname.startsWith('/uploads/')) {
    return CACHE_NAMES.IMAGES;
  }
  
  // API requests
  if (url.pathname.startsWith('/api/')) {
    return CACHE_NAMES.API;
  }
  
  // Static assets
  if (url.pathname.match(/\.(woff|woff2|ttf|eot|css)$/i)) {
    return CACHE_NAMES.STATIC;
  }
  
  // Dynamic content
  return CACHE_NAMES.DYNAMIC;
}

function shouldCache(request, response) {
  if (request.method !== 'GET') return false;
  if (!response || response.status !== 200) return false;
  if (response.type === 'opaque') return false;
  
  // Don't cache auth endpoints
  const url = new URL(request.url);
  if (url.pathname.includes('/auth/')) return false;
  
  return true;
}

// Cache strategies implementation
async function cacheFirst(request) {
  const cacheName = getCacheName(request);
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (shouldCache(request, response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // If offline and no cache, return offline page for navigation
    if (request.mode === 'navigate') {
      return getOfflinePage();
    }
    throw error;
  }
}

async function networkFirst(request) {
  const cacheName = getCacheName(request);
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    if (shouldCache(request, response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    
    // If navigation request and no cache, return offline page
    if (request.mode === 'navigate') {
      return getOfflinePage();
    }
    
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cacheName = getCacheName(request);
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Start fetching in background
  const fetchPromise = fetch(request).then(response => {
    if (shouldCache(request, response)) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null); // Ignore fetch errors
  
  // Return cached version immediately if available
  if (cached) {
    return cached;
  }
  
  // Wait for network if no cache
  const response = await fetchPromise;
  if (response) {
    return response;
  }
  
  // If navigation and no response, return offline page
  if (request.mode === 'navigate') {
    return getOfflinePage();
  }
  
  throw new Error('Network request failed');
}

function getOfflinePage() {
  return caches.match(OFFLINE_URL).then(response => {
    if (response) {
      return response;
    }
    // Fallback offline page
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Offline – UofT Triathlon</title>
          <style>
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              margin: 0; 
              background: #f6f7fb; 
              color: #0f172a; 
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .container { 
              max-width: 640px; 
              margin: 0 auto; 
              padding: 24px; 
              background: white; 
              border-radius: 12px; 
              box-shadow: 0 8px 32px rgba(0,0,0,0.08); 
              text-align: center;
            }
            h1 { margin-top: 0; color: #1E3A8A; font-size: 2rem; }
            p { line-height: 1.6; margin-bottom: 1rem; }
            .button { 
              display: inline-block; 
              margin-top: 12px; 
              background: #1E3A8A; 
              color: white; 
              padding: 12px 24px; 
              border-radius: 8px; 
              text-decoration: none; 
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="font-size: 4rem; margin-bottom: 1rem;">📱</div>
            <h1>You're offline</h1>
            <p>It looks like you don't have an internet connection. Check your network settings and try again.</p>
            <p>Some features may still work if you've visited this page before.</p>
            <a href="/" class="button">Try Again</a>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  });
}

// Delete old cache versions
async function deleteOldCaches() {
  const cacheNames = await caches.keys();
  const currentCacheNames = Object.values(CACHE_NAMES);
  
  const oldCaches = cacheNames.filter(name => {
    // Check if it's one of our caches but not current version
    return (name.startsWith('static-cache-') || 
            name.startsWith('api-cache-') ||
            name.startsWith('images-cache-') ||
            name.startsWith('dynamic-cache-')) &&
           !currentCacheNames.includes(name);
  });
  
  return Promise.all(oldCaches.map(name => {
    console.log(`🗑️ Deleting old cache: ${name}`);
    return caches.delete(name);
  }));
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAMES.STATIC).then(cache => cache.addAll(STATIC_ASSETS)),
      caches.open(CACHE_NAMES.API),
      caches.open(CACHE_NAMES.IMAGES),
      caches.open(CACHE_NAMES.DYNAMIC)
    ]).then(() => {
      console.log('✅ Service Worker installed');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🔧 Service Worker activating...');
  event.waitUntil(
    Promise.all([
      deleteOldCaches(),
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated');
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests (they can't be cached)
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip unsupported schemes
  if (request.url.startsWith('chrome-extension://') || 
      request.url.startsWith('moz-extension://') || 
      request.url.startsWith('safari-extension://')) {
    return;
  }
  
  // Special handling for offline page
  if (request.url.includes('/offline.html') || request.url.includes('/offline')) {
    event.respondWith(getOfflinePage());
    return;
  }
  
  // Determine strategy and respond
  const strategy = getCacheStrategy(request);
  
  event.respondWith(
    (async () => {
      try {
        switch (strategy) {
          case 'cache-first':
            return await cacheFirst(request);
          case 'network-first':
            return await networkFirst(request);
          case 'stale-while-revalidate':
            return await staleWhileRevalidate(request);
          default:
            return await networkFirst(request);
        }
      } catch (error) {
        console.error('Fetch error:', error);
        // For navigation requests, return offline page
        if (request.mode === 'navigate') {
          return await getOfflinePage();
        }
        // For other requests, return error
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});

// Background Sync event
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-queue') {
    event.waitUntil(
      processSyncQueue().catch(error => {
        console.error('Background sync error:', error);
      })
    );
  }
});

// Process sync queue (simplified version for service worker)
async function processSyncQueue() {
  // This is a simplified version - full implementation would use IndexedDB
  // For now, we'll just log that sync is happening
  // The full implementation will be in the main app using the backgroundSync utility
  console.log('🔄 Processing sync queue...');
  return Promise.resolve();
}

// Web Push handler
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try { 
      data = { title: 'Notification', body: event.data.text() }; 
    } catch (_) { 
      data = { title: 'Notification' }; 
    }
  }

  const title = data.title || 'UofT Triathlon';
  const options = {
    body: data.body || '',
    icon: '/images/icon.png',
    badge: '/images/icon.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open with this URL
      for (const client of clientList) {
        const normalizedClientUrl = new URL(client.url);
        const normalizedTargetUrl = new URL(url, self.location.origin);
        if (normalizedClientUrl.href === normalizedTargetUrl.href && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Message handler - allow clients to control service worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    // Allow main app to request caching of specific URLs
    const urls = event.data.urls || [];
    event.waitUntil(
      Promise.all(
        urls.map(url => {
          const request = new Request(url);
          const strategy = getCacheStrategy(request);
          const cacheName = getCacheName(request);
          return caches.open(cacheName).then(cache => {
            return fetch(request).then(response => {
              if (shouldCache(request, response)) {
                return cache.put(request, response);
              }
            });
          });
        })
      )
    );
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Allow main app to clear specific cache
    const cacheType = event.data.cacheType;
    if (cacheType && CACHE_NAMES[cacheType]) {
      event.waitUntil(
        caches.delete(CACHE_NAMES[cacheType]).then(() => {
          console.log(`🗑️ Cleared ${cacheType} cache`);
        })
      );
    }
  }
});
