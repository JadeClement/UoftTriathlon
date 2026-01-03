/**
 * Data Synchronization Service
 * Handles syncing data between IndexedDB (local) and the API (server)
 */

import { 
  forumPosts, 
  workoutSignups, 
  workoutWaitlists, 
  races, 
  raceSignups,
  cacheMetadata,
  initDB
} from '../utils/indexedDB';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

// Cache duration (in milliseconds)
const CACHE_DURATION = {
  FORUM_POSTS: 5 * 60 * 1000,      // 5 minutes
  WORKOUT_SIGNUPS: 2 * 60 * 1000,  // 2 minutes
  WORKOUT_WAITLISTS: 2 * 60 * 1000, // 2 minutes
  RACES: 10 * 60 * 1000,           // 10 minutes
  RACE_SIGNUPS: 5 * 60 * 1000      // 5 minutes
};

/**
 * Get authentication token
 */
function getToken() {
  return localStorage.getItem('triathlonToken');
}

/**
 * Check if data is stale (needs refresh)
 */
async function isStale(cacheKey, maxAge) {
  const lastSync = await cacheMetadata.getLastSync(cacheKey);
  if (!lastSync) return true;
  
  const age = Date.now() - new Date(lastSync).getTime();
  return age > maxAge;
}

/**
 * Fetch forum posts from API
 */
async function fetchForumPostsFromAPI(params = {}) {
  const token = getToken();
  if (!token) throw new Error('No authentication token');

  const queryParams = new URLSearchParams();
  if (params.type) queryParams.set('type', params.type);
  if (params.time) queryParams.set('time', params.time);
  if (params.workout_type) queryParams.set('workout_type', params.workout_type);
  if (params.page) queryParams.set('page', params.page);
  if (params.limit) queryParams.set('limit', params.limit);
  if (params.search) queryParams.set('search', params.search);

  const response = await fetch(`${API_BASE_URL}/forum/posts?${queryParams.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch forum posts: ${response.status}`);
  }

  return response.json();
}

/**
 * Sync forum posts (offline-first)
 */
export async function syncForumPosts(params = {}) {
  try {
    await initDB();
    
    // Check if we're online
    const isOnline = navigator.onLine;
    
    // Check if cached data is stale
    const cacheKey = `forumPosts_${JSON.stringify(params)}`;
    const stale = await isStale(cacheKey, CACHE_DURATION.FORUM_POSTS);
    
    // If offline or data is fresh, return cached data
    if (!isOnline || !stale) {
      const cached = await forumPosts.getAll();
      if (cached.length > 0) {
        console.log('📦 Returning cached forum posts');
        return { posts: cached, fromCache: true };
      }
    }
    
    // If offline and no cache, return empty
    if (!isOnline) {
      console.log('📴 Offline and no cache available');
      return { posts: [], fromCache: true, offline: true };
    }
    
    // Fetch from API
    console.log('🌐 Fetching forum posts from API');
    const data = await fetchForumPostsFromAPI(params);
    const posts = data.posts || [];
    
    // Update cache
    if (posts.length > 0) {
      await forumPosts.putAll(posts);
      await cacheMetadata.updateLastSync(cacheKey);
      console.log(`✅ Cached ${posts.length} forum posts`);
    }
    
    return { posts, fromCache: false };
  } catch (error) {
    console.error('Error syncing forum posts:', error);
    
    // Return cached data as fallback
    const cached = await forumPosts.getAll();
    return { 
      posts: cached, 
      fromCache: true, 
      error: error.message 
    };
  }
}

/**
 * Fetch workout details from API
 */
async function fetchWorkoutFromAPI(workoutId) {
  const token = getToken();
  if (!token) throw new Error('No authentication token');

  const response = await fetch(`${API_BASE_URL}/forum/workouts/${workoutId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workout: ${response.status}`);
  }

  return response.json();
}

/**
 * Sync workout details (offline-first)
 */
export async function syncWorkout(workoutId) {
  try {
    await initDB();
    
    const isOnline = navigator.onLine;
    
    // Try to get from cache first
    const cached = await forumPosts.get(workoutId);
    
    // Check if cached data is stale
    const cacheKey = `workout_${workoutId}`;
    const stale = await isStale(cacheKey, CACHE_DURATION.FORUM_POSTS);
    
    // If we have cached data and (offline or not stale), return it
    if (cached && (!isOnline || !stale)) {
      // Also get signups and waitlist from cache
      const signups = await workoutSignups.queryByPostId(workoutId);
      const waitlist = await workoutWaitlists.queryByPostId(workoutId);
      
      return {
        workout: cached,
        signups,
        waitlist,
        fromCache: true
      };
    }
    
    // If offline and no cache, return null
    if (!isOnline && !cached) {
      return { workout: null, signups: [], waitlist: [], fromCache: true, offline: true };
    }
    
    // Fetch from API
    console.log(`🌐 Fetching workout ${workoutId} from API`);
    const data = await fetchWorkoutFromAPI(workoutId);
    
    // Update cache
    if (data.workout) {
      await forumPosts.put(data.workout);
      await cacheMetadata.updateLastSync(cacheKey);
    }
    
    if (data.signups && data.signups.length > 0) {
      await workoutSignups.putAll(data.signups);
    }
    
    if (data.waitlist && data.waitlist.length > 0) {
      await workoutWaitlists.putAll(data.waitlist);
    }
    
    return {
      workout: data.workout,
      signups: data.signups || [],
      waitlist: data.waitlist || [],
      fromCache: false
    };
  } catch (error) {
    console.error('Error syncing workout:', error);
    
    // Return cached data as fallback
    const cached = await forumPosts.get(workoutId);
    const signups = cached ? await workoutSignups.queryByPostId(workoutId) : [];
    const waitlist = cached ? await workoutWaitlists.queryByPostId(workoutId) : [];
    
    return {
      workout: cached,
      signups,
      waitlist,
      fromCache: true,
      error: error.message
    };
  }
}

/**
 * Fetch races from API
 */
async function fetchRacesFromAPI() {
  const token = getToken();
  if (!token) throw new Error('No authentication token');

  const response = await fetch(`${API_BASE_URL}/races`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch races: ${response.status}`);
  }

  return response.json();
}

/**
 * Sync races (offline-first)
 */
export async function syncRaces() {
  try {
    await initDB();
    
    const isOnline = navigator.onLine;
    const cacheKey = 'races';
    const stale = await isStale(cacheKey, CACHE_DURATION.RACES);
    
    // If offline or data is fresh, return cached data
    if (!isOnline || !stale) {
      const cached = await races.getAll();
      if (cached.length > 0) {
        console.log('📦 Returning cached races');
        return { races: cached, fromCache: true };
      }
    }
    
    // If offline and no cache, return empty
    if (!isOnline) {
      return { races: [], fromCache: true, offline: true };
    }
    
    // Fetch from API
    console.log('🌐 Fetching races from API');
    const data = await fetchRacesFromAPI();
    const racesList = data.races || [];
    
    // Update cache
    if (racesList.length > 0) {
      await races.putAll(racesList);
      await cacheMetadata.updateLastSync(cacheKey);
      console.log(`✅ Cached ${racesList.length} races`);
    }
    
    return { races: racesList, fromCache: false };
  } catch (error) {
    console.error('Error syncing races:', error);
    
    // Return cached data as fallback
    const cached = await races.getAll();
    return { 
      races: cached, 
      fromCache: true, 
      error: error.message 
    };
  }
}

/**
 * Clear all cached data
 */
export async function clearCache() {
  try {
    await initDB();
    
    await Promise.all([
      forumPosts.clear(),
      workoutSignups.clear(),
      workoutWaitlists.clear(),
      races.clear(),
      raceSignups.clear()
    ]);
    
    console.log('🗑️ Cache cleared');
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    await initDB();
    
    const [forumCount, signupCount, waitlistCount, raceCount] = await Promise.all([
      forumPosts.count(),
      workoutSignups.count(),
      workoutWaitlists.count(),
      races.count()
    ]);
    
    return {
      forumPosts: forumCount,
      workoutSignups: signupCount,
      workoutWaitlists: waitlistCount,
      races: raceCount
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
}

