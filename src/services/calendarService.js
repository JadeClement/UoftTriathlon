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
  console.log('📅 addWorkoutToCalendar called with workout:', workout);
  const isIOS = Capacitor.getPlatform() === 'ios';
  console.log('📅 Platform check - isIOS:', isIOS);
  
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
    // Log all available plugins for debugging
    console.log('📅 All available plugins:', window.Capacitor?.Plugins ? Object.keys(window.Capacitor.Plugins) : 'none');
    console.log('📅 Full Capacitor.Plugins object:', window.Capacitor?.Plugins);
    
    // Get the plugin from Capacitor - try multiple methods and names
    // The plugin might be registered as "Calendar" or "CalendarPlugin"
    let plugin;
    
    // Method 1: Try accessing directly via Plugins object (most reliable)
    // Try both "Calendar" and "CalendarPlugin" names
    plugin = window.Capacitor?.Plugins?.Calendar || window.Capacitor?.Plugins?.CalendarPlugin;
    
    // Method 2: Try Capacitor.getPlugin with both names
    if (!plugin || (typeof plugin === 'object' && Object.keys(plugin).length === 0)) {
      try {
        plugin = Capacitor.getPlugin('Calendar') || Capacitor.getPlugin('CalendarPlugin');
        console.log('📅 Plugin from Capacitor.getPlugin:', plugin);
      } catch (e) {
        console.warn('Capacitor.getPlugin failed, trying alternative method:', e);
      }
    }
    
    // Method 3: Try accessing via Capacitor global
    if ((!plugin || (typeof plugin === 'object' && Object.keys(plugin).length === 0)) && window.Capacitor?.getPlugin) {
      try {
        plugin = window.Capacitor.getPlugin('Calendar') || window.Capacitor.getPlugin('CalendarPlugin');
        console.log('📅 Plugin from window.Capacitor.getPlugin:', plugin);
      } catch (e) {
        console.warn('window.Capacitor.getPlugin failed:', e);
      }
    }
    
    // Check if plugin is valid (not empty object)
    if (!plugin || (typeof plugin === 'object' && Object.keys(plugin).length === 0)) {
      // Plugin not registered yet - show helpful error message
      console.error('📅 Calendar plugin not found. Available plugins:', window.Capacitor?.Plugins ? Object.keys(window.Capacitor.Plugins) : 'none');
      throw new Error('Calendar plugin not registered. Please rebuild the app in Xcode after adding CalendarPlugin.swift. See IOS_CALENDAR_PLUGIN_SETUP.md for instructions.');
    }
    
    console.log('📅 Using plugin:', plugin);
    console.log('📅 Plugin methods:', Object.getOwnPropertyNames(plugin));

    // Check if addEvent method exists
    console.log('📅 Checking for addEvent method, plugin methods:', Object.getOwnPropertyNames(plugin));
    if (typeof plugin.addEvent !== 'function') {
      console.error('📅 Plugin exists but addEvent is not a function. Plugin:', plugin);
      throw new Error('Calendar plugin addEvent method not available. Make sure CalendarPlugin.swift is properly registered and the app is rebuilt in Xcode.');
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
    if (error.message && error.message.includes('plugin')) {
      throw error; // Already has helpful message
    }
    throw new Error(`Failed to add event to calendar: ${error.message || 'Unknown error'}`);
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
    // Try accessing directly via Plugins object first (try both names)
    let plugin = window.Capacitor?.Plugins?.Calendar || window.Capacitor?.Plugins?.CalendarPlugin;
    
    // Fallback to Capacitor.getPlugin (try both names)
    if (!plugin || (typeof plugin === 'object' && Object.keys(plugin).length === 0)) {
      plugin = Capacitor.getPlugin('Calendar') || Capacitor.getPlugin('CalendarPlugin');
    }
    
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
