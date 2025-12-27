/**
 * Cache Manager Utility
 * Provides utilities for managing service worker caches
 */

// Cache names and versions
export const CACHE_NAMES = {
  STATIC: 'static-cache',
  API: 'api-cache',
  IMAGES: 'images-cache',
  DYNAMIC: 'dynamic-cache'
};

// Cache version - increment on each deployment
export const CACHE_VERSION = 'v2.0.0';

// Maximum cache sizes (in MB)
export const MAX_CACHE_SIZES = {
  STATIC: 10,    // 10MB
  API: 5,        // 5MB
  IMAGES: 50,    // 50MB
  DYNAMIC: 20    // 20MB
};

/**
 * Get full cache name with version
 */
export function getCacheName(type) {
  return `${CACHE_NAMES[type]}-${CACHE_VERSION}`;
}

/**
 * Get all cache names (including old versions)
 */
export async function getAllCacheNames() {
  return caches.keys();
}

/**
 * Delete old cache versions
 */
export async function deleteOldCaches() {
  const cacheNames = await getAllCacheNames();
  const currentCacheNames = Object.values(CACHE_NAMES).map(name => 
    `${name}-${CACHE_VERSION}`
  );
  
  const oldCaches = cacheNames.filter(name => {
    // Check if it's one of our caches but not the current version
    return Object.values(CACHE_NAMES).some(cacheName => 
      name.startsWith(cacheName) && !currentCacheNames.includes(name)
    );
  });
  
  return Promise.all(oldCaches.map(name => {
    console.log(`🗑️ Deleting old cache: ${name}`);
    return caches.delete(name);
  }));
}

/**
 * Calculate approximate cache size
 */
export async function getCacheSize(cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let totalSize = 0;
    
    for (const key of keys) {
      const response = await cache.match(key);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
    
    return totalSize / (1024 * 1024); // Return size in MB
  } catch (error) {
    console.error(`Error calculating cache size for ${cacheName}:`, error);
    return 0;
  }
}

/**
 * Clean cache if it exceeds maximum size
 */
export async function cleanCacheIfNeeded(cacheName, maxSizeMB) {
  const currentSize = await getCacheSize(cacheName);
  
  if (currentSize <= maxSizeMB) {
    return { cleaned: false, size: currentSize };
  }
  
  console.log(`🧹 Cache ${cacheName} is ${currentSize.toFixed(2)}MB, cleaning...`);
  
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  // Sort by timestamp if available, or use FIFO
  // For now, we'll use a simple approach: delete oldest 25% of entries
  const entriesToDelete = Math.floor(keys.length * 0.25);
  
  for (let i = 0; i < entriesToDelete; i++) {
    await cache.delete(keys[i]);
  }
  
  const newSize = await getCacheSize(cacheName);
  console.log(`✅ Cache cleaned. New size: ${newSize.toFixed(2)}MB`);
  
  return { cleaned: true, oldSize: currentSize, newSize };
}

/**
 * Determine cache strategy based on request type
 */
export function getCacheStrategy(request) {
  const url = new URL(request.url);
  
  // Static assets (images, fonts, CSS that don't change)
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$/i)) {
    return 'cache-first';
  }
  
  // API requests
  if (url.pathname.startsWith('/api/')) {
    // API responses should use network-first with cache fallback
    return 'network-first';
  }
  
  // Dynamic content (HTML, JS bundles with hashes)
  if (url.pathname.match(/\.(js|css|html)$/i)) {
    // These have hashes, so use stale-while-revalidate
    return 'stale-while-revalidate';
  }
  
  // Default: network-first
  return 'network-first';
}

/**
 * Get appropriate cache name for request type
 */
export function getCacheForRequest(request) {
  const url = new URL(request.url);
  
  // Images
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || 
      url.pathname.startsWith('/images/') ||
      url.pathname.startsWith('/uploads/')) {
    return getCacheName('IMAGES');
  }
  
  // API requests
  if (url.pathname.startsWith('/api/')) {
    return getCacheName('API');
  }
  
  // Static assets
  if (url.pathname.match(/\.(woff|woff2|ttf|eot|css)$/i)) {
    return getCacheName('STATIC');
  }
  
  // Dynamic content
  return getCacheName('DYNAMIC');
}

/**
 * Check if request should be cached
 */
export function shouldCache(request, response) {
  // Don't cache non-GET requests
  if (request.method !== 'GET') {
    return false;
  }
  
  // Don't cache non-successful responses
  if (!response || response.status !== 200) {
    return false;
  }
  
  // Don't cache opaque responses (CORS)
  if (response.type === 'opaque') {
    return false;
  }
  
  // Don't cache API auth endpoints
  const url = new URL(request.url);
  if (url.pathname.includes('/auth/')) {
    return false;
  }
  
  return true;
}

/**
 * Initialize all caches
 */
export async function initializeCaches() {
  const cacheNames = [
    getCacheName('STATIC'),
    getCacheName('API'),
    getCacheName('IMAGES'),
    getCacheName('DYNAMIC')
  ];
  
  await Promise.all(
    cacheNames.map(name => caches.open(name))
  );
  
  console.log('✅ All caches initialized');
}

