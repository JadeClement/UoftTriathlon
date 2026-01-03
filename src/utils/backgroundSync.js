/**
 * Background Sync Utility
 * Handles queuing and syncing failed requests when offline
 */

const SYNC_QUEUE_KEY = 'sync-queue';
const MAX_QUEUE_SIZE = 100;

/**
 * Get sync queue from IndexedDB
 */
async function getSyncQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('UofTTriDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result || []);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

/**
 * Add request to sync queue
 */
export async function queueRequest(request, options = {}) {
  try {
    // Only queue POST, PUT, DELETE requests (mutations)
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      return false;
    }
    
    const url = new URL(request.url);
    
    // Don't queue auth requests (they'll fail anyway)
    if (url.pathname.includes('/auth/')) {
      return false;
    }
    
    // Don't queue workout signups - require online connection
    // These have capacity limits and timing constraints that need real-time server validation
    if (url.pathname.includes('/forum/workouts/') && url.pathname.includes('/signup')) {
      return false;
    }
    
    // Don't queue forum post creation - require online connection
    // Prevents duplicate posts and confusion
    if (url.pathname.includes('/forum/posts') && request.method === 'POST') {
      return false;
    }
    
    // Don't queue race signups - require online connection
    if (url.pathname.includes('/races/') && url.pathname.includes('/signup')) {
      return false;
    }
    
    const queue = await getSyncQueue();
    
    // Check queue size
    if (queue.length >= MAX_QUEUE_SIZE) {
      console.warn('⚠️ Sync queue is full, removing oldest entry');
      await removeOldestFromQueue();
    }
    
    // Clone request to get body
    const requestClone = request.clone();
    let body = null;
    
    if (request.body) {
      try {
        body = await request.text();
      } catch (e) {
        console.warn('Could not read request body:', e);
      }
    }
    
    const queueItem = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: body,
      timestamp: Date.now(),
      status: 'pending',
      retries: 0,
      maxRetries: options.maxRetries || 3,
      ...options
    };
    
    // Store in IndexedDB
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('UofTTriDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        const addRequest = store.add(queueItem);
        
        addRequest.onsuccess = () => {
          console.log('📦 Queued request for sync:', request.url);
          resolve(true);
        };
        addRequest.onerror = () => reject(addRequest.error);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
    });
  } catch (error) {
    console.error('Error queueing request:', error);
    return false;
  }
}

/**
 * Remove oldest item from queue
 */
async function removeOldestFromQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('UofTTriDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('timestamp');
      const getAllRequest = index.getAll();
      
      getAllRequest.onsuccess = () => {
        const items = getAllRequest.result;
        if (items.length > 0) {
          const oldest = items.sort((a, b) => a.timestamp - b.timestamp)[0];
          const deleteRequest = store.delete(oldest.id);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        } else {
          resolve();
        }
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

/**
 * Process sync queue
 */
export async function processSyncQueue() {
  if (!navigator.onLine) {
    console.log('📴 Offline, skipping sync queue processing');
    return { processed: 0, failed: 0 };
  }
  
  try {
    const queue = await getSyncQueue();
    const pendingItems = queue.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
      return { processed: 0, failed: 0 };
    }
    
    console.log(`🔄 Processing ${pendingItems.length} queued requests...`);
    
    let processed = 0;
    let failed = 0;
    
    for (const item of pendingItems) {
      try {
        const success = await syncQueueItem(item);
        if (success) {
          processed++;
          await markQueueItemAsComplete(item.id);
        } else {
          failed++;
          await incrementQueueItemRetries(item.id);
        }
      } catch (error) {
        console.error('Error processing queue item:', error);
        failed++;
        await incrementQueueItemRetries(item.id);
      }
    }
    
    console.log(`✅ Sync complete: ${processed} processed, ${failed} failed`);
    return { processed, failed };
  } catch (error) {
    console.error('Error processing sync queue:', error);
    return { processed: 0, failed: 0, error: error.message };
  }
}

/**
 * Sync a single queue item
 */
async function syncQueueItem(item) {
  try {
    const headers = new Headers(item.headers);
    
    // Reconstruct request
    const requestInit = {
      method: item.method,
      headers: headers,
      body: item.body || null
    };
    
    const response = await fetch(item.url, requestInit);
    
    if (response.ok) {
      return true;
    } else {
      console.warn(`Sync failed for ${item.url}: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`Error syncing ${item.url}:`, error);
    return false;
  }
}

/**
 * Mark queue item as complete
 */
async function markQueueItemAsComplete(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('UofTTriDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.status = 'completed';
          const putRequest = store.put(item);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

/**
 * Increment retry count for queue item
 */
async function incrementQueueItemRetries(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('UofTTriDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.retries++;
          if (item.retries >= item.maxRetries) {
            item.status = 'failed';
          }
          const putRequest = store.put(item);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

/**
 * Clear completed items from queue
 */
export async function clearCompletedSyncQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('UofTTriDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const index = store.index('status');
      const getAllRequest = index.getAll('completed');
      
      getAllRequest.onsuccess = () => {
        const completed = getAllRequest.result;
        const deletePromises = completed.map(item => store.delete(item.id));
        Promise.all(deletePromises).then(() => {
          console.log(`🗑️ Cleared ${completed.length} completed sync queue items`);
          resolve(completed.length);
        }).catch(reject);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

