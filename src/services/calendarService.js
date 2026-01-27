/**
 * Calendar Service
 * Handles adding workouts to the iOS calendar using EventKit
 */

import { Capacitor } from '@capacitor/core';
import { combineDateTime } from '../utils/dateUtils';

/**
 * Add a workout to the user's calendar
 * @param {Object} workout - Workout object with:
 *   - id: Workout ID
 *   - title: Workout title
 *   - workout_type: Type of workout (Swim, Run, Track, etc.)
 *   - workout_date: Date of the workout (YYYY-MM-DD) - in EST/EDT
 *   - workout_time: Time of the workout (HH:MM) - in EST/EDT
 *   - description: Workout description/content
 *   - capacity: Workout capacity (optional)
 * @returns {Promise<{success: boolean, eventId?: string}>}
 */
export async function addWorkoutToCalendar(workout) {
  const isIOS = Capacitor.getPlatform() === 'ios';
  
  if (!isIOS) {
    throw new Error('Calendar service is only available on iOS');
  }

  // Parse date and time - combineDateTime handles EST/EDT to UTC conversion
  const workoutDateTime = combineDateTime(workout.workout_date, workout.workout_time);
  
  if (!workoutDateTime) {
    throw new Error('Invalid workout date or time');
  }

  // Calculate end time (default to 1 hour duration, or adjust based on workout type)
  const endDateTime = new Date(workoutDateTime);
  const durationHours = getWorkoutDuration(workout.workout_type);
  endDateTime.setHours(endDateTime.getHours() + durationHours);

  // Format event details
  const eventTitle = workout.title || `${workout.workout_type} Workout`;
  const eventDescription = buildEventDescription(workout);

  console.log('📅 Adding workout to calendar:', {
    title: eventTitle,
    type: workout.workout_type,
    startDate: workoutDateTime.toISOString(),
    endDate: endDateTime.toISOString(),
    description: eventDescription
  });

  // Call the native iOS plugin
  try {
    // Get the plugin from Capacitor
    const plugin = Capacitor.getPlugin('Calendar');
    
    if (!plugin) {
      // Plugin not registered yet - show helpful error message
      throw new Error('Calendar plugin not registered. Please add CalendarPlugin.swift to your Xcode project. See IOS_CALENDAR_PLUGIN_SETUP.md for instructions.');
    }

    // Check if addEvent method exists
    if (typeof plugin.addEvent !== 'function') {
      throw new Error('Calendar plugin addEvent method not available. Make sure CalendarPlugin.swift is properly registered.');
    }

    const result = await plugin.addEvent({
      title: eventTitle,
      startDate: workoutDateTime.toISOString(),
      endDate: endDateTime.toISOString(),
      notes: eventDescription
    });

    console.log('✅ Calendar event added successfully:', result);
    return { success: true, eventId: result?.eventId || '' };
  } catch (error) {
    console.error('❌ Error adding event to calendar:', error);
    // Re-throw with helpful message
    throw error;
  }
}

/**
 * Check if a workout event exists in the calendar
 * @param {Object} workout - Workout object
 * @returns {Promise<boolean>}
 */
export async function hasWorkoutInCalendar(workout) {
  const isIOS = Capacitor.getPlatform() === 'ios';
  
  if (!isIOS) {
    return false;
  }

  const workoutDateTime = combineDateTime(workout.workout_date, workout.workout_time);
  
  if (!workoutDateTime) {
    return false;
  }

  // Plugin not registered yet - return false gracefully
  // This prevents errors when the plugin hasn't been added to Xcode
  try {
    const plugin = Capacitor.getPlugin('Calendar');
    
    if (!plugin || typeof plugin.hasEvent !== 'function') {
      // Plugin not available - this is fine, just return false
      return false;
    }

    const result = await plugin.hasEvent({
      title: workout.title || `${workout.workout_type} Workout`,
      startDate: workoutDateTime.toISOString()
    });

    return result?.hasEvent || false;
  } catch (error) {
    // Silently fail - plugin might not be registered yet
    // This is expected until CalendarPlugin.swift is added to Xcode
    return false;
  }
}

/**
 * Get workout duration in hours based on workout type
 * @param {string} workoutType - Type of workout
 * @returns {number} Duration in hours
 */
function getWorkoutDuration(workoutType) {
  const durations = {
    'Swim': 1.5,
    'Run': 1,
    'Track': 1,
    'Bike': 2,
    'Spin': 1,
    'Brick': 2.5,
    'Strength': 1
  };
  
  return durations[workoutType] || 1; // Default to 1 hour
}

/**
 * Build event description from workout data
 * @param {Object} workout - Workout object
 * @returns {string} Event description
 */
function buildEventDescription(workout) {
  let description = '';
  
  if (workout.description) {
    description += workout.description + '\n\n';
  }
  
  if (workout.workout_type) {
    description += `Type: ${workout.workout_type}\n`;
  }
  
  if (workout.capacity) {
    description += `Capacity: ${workout.capacity}\n`;
  }
  
  description += '\nAdded from UofT Triathlon Club App';
  
  return description.trim();
}
