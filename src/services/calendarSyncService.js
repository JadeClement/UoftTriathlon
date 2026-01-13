/**
 * Calendar Sync Service
 * Handles automatic syncing of workouts to user's calendar based on preferences
 */

import { addWorkoutToCalendar } from './calendarService';
import { Capacitor } from '@capacitor/core';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
const isIOS = Capacitor.getPlatform() === 'ios';

/**
 * Get workouts that need to be synced to calendar
 */
async function getWorkoutsToSync() {
  if (!isIOS) {
    return [];
  }

  try {
    const token = localStorage.getItem('triathlonToken');
    if (!token) {
      return [];
    }

    const response = await fetch(`${API_BASE_URL}/users/calendar-workouts-to-sync`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.error('Failed to get workouts to sync:', response.status);
      return [];
    }

    const data = await response.json();
    return data.workouts || [];
  } catch (error) {
    console.error('Error getting workouts to sync:', error);
    return [];
  }
}

/**
 * Mark workouts as synced
 */
async function markWorkoutsAsSynced(workoutIds) {
  if (!isIOS || !workoutIds || workoutIds.length === 0) {
    return;
  }

  try {
    const token = localStorage.getItem('triathlonToken');
    if (!token) {
      return;
    }

    await fetch(`${API_BASE_URL}/users/calendar-mark-synced`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workoutIds })
    });
  } catch (error) {
    console.error('Error marking workouts as synced:', error);
  }
}

/**
 * Sync workouts to calendar
 * Adds matching workouts to user's calendar and marks them as synced
 */
export async function syncWorkoutsToCalendar() {
  if (!isIOS) {
    return { synced: 0, errors: 0 };
  }

  const workouts = await getWorkoutsToSync();
  
  if (workouts.length === 0) {
    return { synced: 0, errors: 0 };
  }

  const syncedIds = [];
  let errors = 0;

  for (const workout of workouts) {
    try {
      await addWorkoutToCalendar({
        id: workout.id,
        title: workout.title,
        workout_type: workout.workout_type,
        workout_date: workout.workout_date,
        workout_time: workout.workout_time,
        description: workout.content,
        capacity: workout.capacity
      });
      syncedIds.push(workout.id);
    } catch (error) {
      console.error(`Error syncing workout ${workout.id} to calendar:`, error);
      errors++;
    }
  }

  // Mark successfully synced workouts
  if (syncedIds.length > 0) {
    await markWorkoutsAsSynced(syncedIds);
  }

  return { synced: syncedIds.length, errors };
}

/**
 * Check and sync workouts periodically
 * Call this when app becomes active or on a timer
 */
let syncInterval = null;

export function startPeriodicSync(intervalMs = 5 * 60 * 1000) { // Default: every 5 minutes
  if (!isIOS || syncInterval) {
    return; // Already running or not iOS
  }

  // Sync immediately
  syncWorkoutsToCalendar().then(result => {
    if (result.synced > 0) {
      console.log(`✅ Synced ${result.synced} workout(s) to calendar`);
    }
  });

  // Then sync periodically
  syncInterval = setInterval(() => {
    syncWorkoutsToCalendar().then(result => {
      if (result.synced > 0) {
        console.log(`✅ Synced ${result.synced} workout(s) to calendar`);
      }
    });
  }, intervalMs);
}

export function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
