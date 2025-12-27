# Service Worker Enhancements Documentation

## Overview

The service worker has been enhanced with comprehensive caching strategies, background sync capabilities, and better cache management. This document explains the improvements and how to use them.

## What's New

### 1. Multiple Cache Strategies

The service worker now uses different caching strategies based on request type:

- **Cache-First**: For static assets (images, fonts) that rarely change
- **Network-First**: For API requests that need fresh data
- **Stale-While-Revalidate**: For dynamic content (JS/CSS bundles) that have hashes

### 2. Separate Cache Stores

Four separate cache stores for better organization:
- `static-cache-v2.0.0`: Static assets (fonts, CSS)
- `api-cache-v2.0.0`: API responses
- `images-cache-v2.0.0`: Images and uploads
- `dynamic-cache-v2.0.0`: Dynamic content (JS bundles, HTML)

### 3. Background Sync

Failed requests (POST, PUT, DELETE) are automatically queued and synced when the connection is restored.

### 4. Automatic Cache Cleanup

Old cache versions are automatically deleted when a new service worker is activated.

## Usage

### In React Components

```javascript
import { useServiceWorker } from '../hooks/useServiceWorker';

function MyComponent() {
  const { 
    isOnline, 
    syncNow, 
    updateAvailable, 
    skipWaiting 
  } = useServiceWorker();

  return (
    <div>
      {!isOnline && <div>You're offline</div>}
      {updateAvailable && (
        <button onClick={skipWaiting}>
          Update Available - Click to Reload
        </button>
      )}
      <button onClick={syncNow}>Sync Now</button>
    </div>
  );
}
```

### Manual Cache Management

```javascript
import { requestCacheUrls, requestClearCache } from '../utils/serviceWorkerUtils';

// Cache specific URLs
await requestCacheUrls([
  '/api/forum/posts',
  '/api/workouts'
]);

// Clear a specific cache
await requestClearCache('API'); // 'STATIC', 'API', 'IMAGES', 'DYNAMIC'
```

### Background Sync

The background sync utility automatically queues failed requests. To manually process the queue:

```javascript
import { processSyncQueue } from '../utils/backgroundSync';

// Process queued requests
const result = await processSyncQueue();
console.log(`Processed: ${result.processed}, Failed: ${result.failed}`);
```

## Cache Strategies Explained

### Cache-First
1. Check cache
2. If found, return cached version
3. If not found, fetch from network and cache

**Used for**: Images, fonts, static assets

### Network-First
1. Try network first
2. If successful, cache and return
3. If network fails, return cached version
4. If no cache, return offline page (for navigation)

**Used for**: API requests, dynamic content

### Stale-While-Revalidate
1. Return cached version immediately (if available)
2. Fetch fresh version in background
3. Update cache with fresh version

**Used for**: JS/CSS bundles with hashes

## Configuration

### Cache Version

Update `CACHE_VERSION` in `public/service-worker.js` to force cache invalidation:

```javascript
const CACHE_VERSION = 'v2.0.1'; // Increment to force update
```

### Cache Sizes

Maximum cache sizes can be configured in `src/utils/cacheManager.js`:

```javascript
export const MAX_CACHE_SIZES = {
  STATIC: 10,    // 10MB
  API: 5,        // 5MB
  IMAGES: 50,    // 50MB
  DYNAMIC: 20    // 20MB
};
```

## Testing

### Development

Service worker is now enabled in development mode for testing. To test:

1. Start the app: `npm start`
2. Open DevTools → Application → Service Workers
3. Check "Update on reload" for easier testing
4. Test offline mode: DevTools → Network → Offline

### Production

1. Build the app: `npm run build`
2. Test the production build locally
3. Verify service worker registration in browser DevTools
4. Test offline functionality

## Troubleshooting

### Service Worker Not Updating

1. Check cache version in `service-worker.js`
2. Unregister old service worker in DevTools
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. Check browser console for errors

### Cache Not Clearing

1. Use `requestClearCache()` utility function
2. Or manually clear in DevTools → Application → Cache Storage
3. Unregister and re-register service worker

### Background Sync Not Working

1. Ensure IndexedDB is supported (modern browsers)
2. Check browser console for errors
3. Verify requests are being queued (check IndexedDB in DevTools)
4. Ensure device comes back online to trigger sync

## Best Practices

1. **Increment cache version** on each deployment
2. **Test offline functionality** before deploying
3. **Monitor cache sizes** to prevent storage issues
4. **Handle sync failures gracefully** in UI
5. **Show offline indicators** to users

## Next Steps

- [ ] Implement IndexedDB for offline data storage (Phase 1.2)
- [ ] Add UI components for offline/sync status
- [ ] Implement conflict resolution for synced data
- [ ] Add analytics for cache hit rates

