/* UofT Triathlon PWA Service Worker */

// Increment this version on each deployment to force service worker update
const CACHE_VERSION = 'v1.0.4';
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  OFFLINE_URL,
  '/images/icon.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Special handling for offline page - serve it directly from cache
  if (request.url.includes('/offline.html') || request.url.includes('/offline')) {
    event.respondWith(
      caches.match(OFFLINE_URL).then((response) => {
        if (response) {
          return response;
        }
        // If not in cache, return a basic offline page
        return new Response(`
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Offline – UofT Triathlon</title>
              <style>
                body { 
                  font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; 
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
                h1 { 
                  margin-top: 0; 
                  color: #1E3A8A; 
                  font-size: 2rem;
                }
                p { 
                  line-height: 1.6; 
                  margin-bottom: 1rem;
                }
                .hint { 
                  color: #475569; 
                  font-size: 14px; 
                  margin-top: 2rem;
                }
                .button { 
                  display: inline-block; 
                  margin-top: 12px; 
                  background: #1E3A8A; 
                  color: white; 
                  padding: 12px 24px; 
                  border-radius: 8px; 
                  text-decoration: none; 
                  font-weight: 500;
                  transition: background-color 0.2s;
                }
                .button:hover {
                  background: #1e40af;
                }
                .icon {
                  font-size: 4rem;
                  margin-bottom: 1rem;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon">📱</div>
                <h1>You're offline</h1>
                <p>It looks like you don't have an internet connection. Check your network settings and try again.</p>
                <p>Some features may still work if you've visited this page before.</p>
                <a href="/" class="button">Try Again</a>
                <div class="hint">
                  <p>This page is cached for offline use. When you're back online, refresh to get the latest content.</p>
                </div>
              </div>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      })
    );
    return;
  }

  // Skip unsupported request schemes (like chrome-extension://)
  if (request.url.startsWith('chrome-extension://') || 
      request.url.startsWith('moz-extension://') || 
      request.url.startsWith('safari-extension://')) {
    return;
  }

  // For all other requests, use network-first with cache fallback
  // Don't cache JS/CSS bundles aggressively - they have hashes and change on each build
  const shouldCache = !request.url.match(/\.(js|css)$/);
  
  event.respondWith(
    fetch(request).then((response) => {
      // Only cache non-JS/CSS files to avoid stale bundle issues
      if (response.status === 200 && shouldCache) {
        const responseClone = response.clone();
        caches.open(STATIC_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });
      }
      return response;
    }).catch(() => {
      // If network fails, try cache
      return caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        // If not in cache and it's a navigation request, return offline page
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_URL).then((offlineResponse) => {
            if (offlineResponse) {
              return offlineResponse;
            }
            // Fallback offline page
            return new Response(`
              <!DOCTYPE html>
              <html>
                <head><title>Offline</title></head>
                <body>
                  <h1>You're offline</h1>
                  <p>Please check your internet connection.</p>
                </body>
              </html>
            `, {
              headers: { 'Content-Type': 'text/html' }
            });
          });
        }
        // For non-navigation requests, return a basic error
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Web Push handler (optional; backend integration required to subscribe users)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try { data = { title: 'Notification', body: event.data.text() }; } catch (_) { data = { title: 'Notification' }; }
  }

  const title = data.title || 'UofT Triathlon';
  const options = {
    body: data.body || '',
    icon: '/images/icon.png',
    badge: '/images/icon.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const normalizedClientUrl = new URL(client.url);
        const normalizedTargetUrl = new URL(url, self.location.origin);
        if (normalizedClientUrl.href === normalizedTargetUrl.href && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Allow clients to tell SW to update immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});