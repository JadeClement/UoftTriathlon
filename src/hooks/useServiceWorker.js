/**
 * React Hook for Service Worker Management
 * Provides utilities to interact with the service worker from React components
 */

import { useState, useEffect } from 'react';
import { processSyncQueue, clearCompletedSyncQueue } from '../utils/backgroundSync';

export function useServiceWorker() {
  const [registration, setRegistration] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Get service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        setRegistration(reg);
      });

      // Listen for updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(true);
      });
    }

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Process sync queue when coming back online
      processSyncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Manually trigger sync queue processing
   */
  const syncNow = async () => {
    if (!isOnline) {
      return { error: 'Device is offline' };
    }
    return await processSyncQueue();
  };

  /**
   * Clear completed items from sync queue
   */
  const clearCompleted = async () => {
    return await clearCompletedSyncQueue();
  };

  /**
   * Request service worker to cache specific URLs
   */
  const cacheUrls = (urls) => {
    if (registration && registration.active) {
      registration.active.postMessage({
        type: 'CACHE_URLS',
        urls: Array.isArray(urls) ? urls : [urls]
      });
    }
  };

  /**
   * Clear a specific cache
   */
  const clearCache = (cacheType) => {
    if (registration && registration.active) {
      registration.active.postMessage({
        type: 'CLEAR_CACHE',
        cacheType: cacheType // 'STATIC', 'API', 'IMAGES', 'DYNAMIC'
      });
    }
  };

  /**
   * Update service worker
   */
  const updateServiceWorker = () => {
    if (registration) {
      registration.update();
    }
  };

  /**
   * Skip waiting and reload (for updates)
   */
  const skipWaiting = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  return {
    registration,
    updateAvailable,
    isOnline,
    syncNow,
    clearCompleted,
    cacheUrls,
    clearCache,
    updateServiceWorker,
    skipWaiting
  };
}

