/**
 * React Hook for Offline Data
 * Provides easy access to cached data with automatic syncing
 */

import { useState, useEffect, useCallback } from 'react';
import { syncForumPosts, syncWorkout, syncRaces } from '../services/dataSync';

/**
 * Hook for forum posts with offline support
 */
export function useForumPosts(params = {}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const enabled = params.enabled !== false; // default: enabled unless explicitly false

  const loadPosts = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await syncForumPosts(params);
      
      setPosts(result.posts || []);
      setFromCache(result.fromCache || false);
      setIsOffline(result.offline || false);
      
      // If we got cached data and we're online, sync in background
      if (result.fromCache && navigator.onLine) {
        syncForumPosts(params).then(updated => {
          if (updated.posts && updated.posts.length > 0) {
            setPosts(updated.posts);
            setFromCache(false);
          }
        }).catch(err => {
          console.warn('Background sync failed:', err);
        });
      }
    } catch (err) {
      console.error('Error loading forum posts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    loadPosts();
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOffline(false);
      // Auto-sync when coming back online
      loadPosts();
    };
    const handleOffline = () => setIsOffline(true);
    
    if (enabled) {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    }
    
    return () => {
      if (enabled) {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      }
    };
  }, [enabled, loadPosts]);

  const refresh = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      return Promise.resolve();
    }
    return loadPosts();
  }, [enabled, loadPosts]);

  return {
    posts,
    loading,
    error,
    fromCache,
    isOffline,
    refresh
  };
}

/**
 * Hook for workout details with offline support
 */
export function useWorkout(workoutId) {
  const [workout, setWorkout] = useState(null);
  const [signups, setSignups] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const loadWorkout = useCallback(async () => {
    if (!workoutId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await syncWorkout(workoutId);
      
      setWorkout(result.workout);
      setSignups(result.signups || []);
      setWaitlist(result.waitlist || []);
      setFromCache(result.fromCache || false);
      setIsOffline(result.offline || false);
      
      // If we got cached data and we're online, sync in background
      if (result.fromCache && navigator.onLine) {
        syncWorkout(workoutId).then(updated => {
          if (updated.workout) {
            setWorkout(updated.workout);
            setSignups(updated.signups || []);
            setWaitlist(updated.waitlist || []);
            setFromCache(false);
          }
        }).catch(err => {
          console.warn('Background sync failed:', err);
        });
      }
    } catch (err) {
      console.error('Error loading workout:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    loadWorkout();
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOffline(false);
      // Auto-sync when coming back online
      loadWorkout();
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadWorkout]);

  const refresh = useCallback(() => {
    return loadWorkout();
  }, [loadWorkout]);

  return {
    workout,
    signups,
    waitlist,
    loading,
    error,
    fromCache,
    isOffline,
    refresh
  };
}

/**
 * Hook for races with offline support
 */
export function useRaces() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const loadRaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await syncRaces();
      
      setRaces(result.races || []);
      setFromCache(result.fromCache || false);
      setIsOffline(result.offline || false);
      
      // If we got cached data and we're online, sync in background
      if (result.fromCache && navigator.onLine) {
        syncRaces().then(updated => {
          if (updated.races && updated.races.length > 0) {
            setRaces(updated.races);
            setFromCache(false);
          }
        }).catch(err => {
          console.warn('Background sync failed:', err);
        });
      }
    } catch (err) {
      console.error('Error loading races:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRaces();
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOffline(false);
      // Auto-sync when coming back online
      loadRaces();
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadRaces]);

  const refresh = useCallback(() => {
    return loadRaces();
  }, [loadRaces]);

  return {
    races,
    loading,
    error,
    fromCache,
    isOffline,
    refresh
  };
}

/**
 * Hook to check online status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

