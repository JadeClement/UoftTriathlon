/**
 * Service Worker Utilities
 * Helper functions for interacting with the service worker
 */

/**
 * Check if service worker is supported
 */
export function isServiceWorkerSupported() {
  return 'serviceWorker' in navigator;
}

/**
 * Get service worker registration
 */
export async function getServiceWorkerRegistration() {
  if (!isServiceWorkerSupported()) {
    return null;
  }
  
  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.error('Error getting service worker registration:', error);
    return null;
  }
}

/**
 * Request service worker to cache URLs
 */
export async function requestCacheUrls(urls) {
  const registration = await getServiceWorkerRegistration();
  if (registration && registration.active) {
    registration.active.postMessage({
      type: 'CACHE_URLS',
      urls: Array.isArray(urls) ? urls : [urls]
    });
  }
}

/**
 * Clear a specific cache
 */
export async function requestClearCache(cacheType) {
  const registration = await getServiceWorkerRegistration();
  if (registration && registration.active) {
    registration.active.postMessage({
      type: 'CLEAR_CACHE',
      cacheType: cacheType // 'STATIC', 'API', 'IMAGES', 'DYNAMIC'
    });
  }
}

/**
 * Check if app is online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Listen for online/offline events
 */
export function onOnlineStatusChange(callback) {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Unregister service worker (useful for development)
 */
export async function unregisterServiceWorker() {
  if (!isServiceWorkerSupported()) {
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const unregistered = await registration.unregister();
      console.log('Service worker unregistered:', unregistered);
      return unregistered;
    }
    return false;
  } catch (error) {
    console.error('Error unregistering service worker:', error);
    return false;
  }
}

