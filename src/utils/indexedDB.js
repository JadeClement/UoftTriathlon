/**
 * IndexedDB Wrapper
 * Provides a simple, promise-based interface for IndexedDB operations
 */

const DB_NAME = 'UofTTriDB';
const DB_VERSION = 1;

// Object store names
const STORES = {
  USERS: 'users',
  FORUM_POSTS: 'forumPosts',
  WORKOUT_SIGNUPS: 'workoutSignups',
  WORKOUT_WAITLISTS: 'workoutWaitlists',
  RACES: 'races',
  RACE_SIGNUPS: 'raceSignups',
  SYNC_QUEUE: 'syncQueue',
  CACHE_METADATA: 'cacheMetadata'
};

let dbInstance = null;

/**
 * Initialize the database
 */
export async function initDB() {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('❌ IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('✅ IndexedDB opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Users store
      if (!db.objectStoreNames.contains(STORES.USERS)) {
        const userStore = db.createObjectStore(STORES.USERS, { keyPath: 'id' });
        userStore.createIndex('email', 'email', { unique: false });
        userStore.createIndex('role', 'role', { unique: false });
      }

      // Forum posts store
      if (!db.objectStoreNames.contains(STORES.FORUM_POSTS)) {
        const postStore = db.createObjectStore(STORES.FORUM_POSTS, { keyPath: 'id' });
        postStore.createIndex('type', 'type', { unique: false });
        postStore.createIndex('workout_type', 'workout_type', { unique: false });
        postStore.createIndex('workout_date', 'workout_date', { unique: false });
        postStore.createIndex('created_at', 'created_at', { unique: false });
        postStore.createIndex('user_id', 'user_id', { unique: false });
      }

      // Workout signups store
      if (!db.objectStoreNames.contains(STORES.WORKOUT_SIGNUPS)) {
        const signupStore = db.createObjectStore(STORES.WORKOUT_SIGNUPS, { keyPath: 'id' });
        signupStore.createIndex('post_id', 'post_id', { unique: false });
        signupStore.createIndex('user_id', 'user_id', { unique: false });
        signupStore.createIndex('signup_time', 'signup_time', { unique: false });
      }

      // Workout waitlists store
      if (!db.objectStoreNames.contains(STORES.WORKOUT_WAITLISTS)) {
        const waitlistStore = db.createObjectStore(STORES.WORKOUT_WAITLISTS, { keyPath: 'id' });
        waitlistStore.createIndex('post_id', 'post_id', { unique: false });
        waitlistStore.createIndex('user_id', 'user_id', { unique: false });
        waitlistStore.createIndex('joined_at', 'joined_at', { unique: false });
      }

      // Races store
      if (!db.objectStoreNames.contains(STORES.RACES)) {
        const raceStore = db.createObjectStore(STORES.RACES, { keyPath: 'id' });
        raceStore.createIndex('date', 'date', { unique: false });
        raceStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Race signups store
      if (!db.objectStoreNames.contains(STORES.RACE_SIGNUPS)) {
        const raceSignupStore = db.createObjectStore(STORES.RACE_SIGNUPS, { keyPath: 'id' });
        raceSignupStore.createIndex('race_id', 'race_id', { unique: false });
        raceSignupStore.createIndex('user_id', 'user_id', { unique: false });
      }

      // Sync queue store (already created by backgroundSync, but ensure it exists)
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncStore.createIndex('status', 'status', { unique: false });
      }

      // Cache metadata store (tracks when data was last synced)
      if (!db.objectStoreNames.contains(STORES.CACHE_METADATA)) {
        const metadataStore = db.createObjectStore(STORES.CACHE_METADATA, { keyPath: 'key' });
        metadataStore.createIndex('lastSync', 'lastSync', { unique: false });
      }

      console.log('✅ IndexedDB stores created');
    };
  });
}

/**
 * Get database instance
 */
async function getDB() {
  if (!dbInstance) {
    await initDB();
  }
  return dbInstance;
}

/**
 * Generic function to add/update data in a store
 */
export async function put(storeName, data) {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic function to add multiple items
 */
export async function putAll(storeName, items) {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return Promise.all(
    items.map(item => 
      new Promise((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
    )
  );
}

/**
 * Generic function to get data by key
 */
export async function get(storeName, key) {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic function to get all data from a store
 */
export async function getAll(storeName) {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic function to delete data by key
 */
export async function remove(storeName, key) {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic function to clear all data from a store
 */
export async function clear(storeName) {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Query data using an index
 */
export async function query(storeName, indexName, range) {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  const index = store.index(indexName);
  
  return new Promise((resolve, reject) => {
    const request = range ? index.getAll(range) : index.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Count items in a store
 */
export async function count(storeName) {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Convenience functions for specific stores

// Forum Posts
export const forumPosts = {
  put: (post) => put(STORES.FORUM_POSTS, post),
  putAll: (posts) => putAll(STORES.FORUM_POSTS, posts),
  get: (id) => get(STORES.FORUM_POSTS, id),
  getAll: () => getAll(STORES.FORUM_POSTS),
  remove: (id) => remove(STORES.FORUM_POSTS, id),
  clear: () => clear(STORES.FORUM_POSTS),
  queryByType: (type) => query(STORES.FORUM_POSTS, 'type', type),
  queryByWorkoutType: (workoutType) => query(STORES.FORUM_POSTS, 'workout_type', workoutType),
  count: () => count(STORES.FORUM_POSTS)
};

// Workout Signups
export const workoutSignups = {
  put: (signup) => put(STORES.WORKOUT_SIGNUPS, signup),
  putAll: (signups) => putAll(STORES.WORKOUT_SIGNUPS, signups),
  get: (id) => get(STORES.WORKOUT_SIGNUPS, id),
  getAll: () => getAll(STORES.WORKOUT_SIGNUPS),
  remove: (id) => remove(STORES.WORKOUT_SIGNUPS, id),
  clear: () => clear(STORES.WORKOUT_SIGNUPS),
  queryByPostId: (postId) => query(STORES.WORKOUT_SIGNUPS, 'post_id', postId),
  queryByUserId: (userId) => query(STORES.WORKOUT_SIGNUPS, 'user_id', userId),
  count: () => count(STORES.WORKOUT_SIGNUPS)
};

// Workout Waitlists
export const workoutWaitlists = {
  put: (waitlist) => put(STORES.WORKOUT_WAITLISTS, waitlist),
  putAll: (waitlists) => putAll(STORES.WORKOUT_WAITLISTS, waitlists),
  get: (id) => get(STORES.WORKOUT_WAITLISTS, id),
  getAll: () => getAll(STORES.WORKOUT_WAITLISTS),
  remove: (id) => remove(STORES.WORKOUT_WAITLISTS, id),
  clear: () => clear(STORES.WORKOUT_WAITLISTS),
  queryByPostId: (postId) => query(STORES.WORKOUT_WAITLISTS, 'post_id', postId),
  queryByUserId: (userId) => query(STORES.WORKOUT_WAITLISTS, 'user_id', userId),
  count: () => count(STORES.WORKOUT_WAITLISTS)
};

// Users
export const users = {
  put: (user) => put(STORES.USERS, user),
  putAll: (usersList) => putAll(STORES.USERS, usersList),
  get: (id) => get(STORES.USERS, id),
  getAll: () => getAll(STORES.USERS),
  remove: (id) => remove(STORES.USERS, id),
  clear: () => clear(STORES.USERS),
  queryByEmail: (email) => query(STORES.USERS, 'email', email),
  queryByRole: (role) => query(STORES.USERS, 'role', role),
  count: () => count(STORES.USERS)
};

// Races
export const races = {
  put: (race) => put(STORES.RACES, race),
  putAll: (racesList) => putAll(STORES.RACES, racesList),
  get: (id) => get(STORES.RACES, id),
  getAll: () => getAll(STORES.RACES),
  remove: (id) => remove(STORES.RACES, id),
  clear: () => clear(STORES.RACES),
  queryByDate: (date) => query(STORES.RACES, 'date', date),
  count: () => count(STORES.RACES)
};

// Race Signups
export const raceSignups = {
  put: (signup) => put(STORES.RACE_SIGNUPS, signup),
  putAll: (signups) => putAll(STORES.RACE_SIGNUPS, signups),
  get: (id) => get(STORES.RACE_SIGNUPS, id),
  getAll: () => getAll(STORES.RACE_SIGNUPS),
  remove: (id) => remove(STORES.RACE_SIGNUPS, id),
  clear: () => clear(STORES.RACE_SIGNUPS),
  queryByRaceId: (raceId) => query(STORES.RACE_SIGNUPS, 'race_id', raceId),
  queryByUserId: (userId) => query(STORES.RACE_SIGNUPS, 'user_id', userId),
  count: () => count(STORES.RACE_SIGNUPS)
};

// Cache Metadata
export const cacheMetadata = {
  put: (key, value) => put(STORES.CACHE_METADATA, { key, ...value }),
  get: (key) => get(STORES.CACHE_METADATA, key),
  updateLastSync: async (key) => {
    const existing = await get(STORES.CACHE_METADATA, key);
    return put(STORES.CACHE_METADATA, {
      key,
      lastSync: new Date().toISOString(),
      ...(existing || {})
    });
  },
  getLastSync: async (key) => {
    const metadata = await get(STORES.CACHE_METADATA, key);
    return metadata?.lastSync || null;
  }
};

// Export store names for use in other modules
export { STORES };

