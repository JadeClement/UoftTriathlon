// Import date-fns-tz functions - in v3.x, these are exported directly
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');

/**
 * Centralized date utilities for consistent date handling across the application
 * IMPORTANT: Workout dates/times are in America/Toronto timezone (EST/EDT)
 * User action timestamps (signups, cancellations) are in UTC (no timezone assumption)
 */

const TORONTO_TIMEZONE = 'America/Toronto';

/**
 * Parse a date string or Date object into a standardized Date object
 * For workout dates (YYYY-MM-DD), this is just for extraction - timezone handling is in combineDateTime
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
function parseDate(dateInput) {
  if (!dateInput) return null;
  
  // If it's already a Date object, return it
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  
  // Handle string inputs
  if (typeof dateInput === 'string') {
    // Handle ISO strings (these are already timezone-aware)
    if (dateInput.includes('T') || dateInput.includes('Z')) {
      const date = new Date(dateInput);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Handle YYYY-MM-DD format - just extract the date components
    // The actual timezone interpretation happens in combineDateTime()
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-').map(Number);
      // Return a date object - we'll handle timezone in combineDateTime
      return new Date(year, month - 1, day);
    }
    
    // Handle other formats
    const date = new Date(dateInput);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
}

/**
 * Parse a time string into hours, minutes, seconds
 * @param {string} timeStr - Time string in HH:MM:SS or HH:MM format
 * @returns {Object|null} - {hours, minutes, seconds} or null if invalid
 */
function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parts[2] ? parseInt(parts[2], 10) : 0;
  
  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;
  
  return { hours, minutes, seconds };
}

/**
 * Combine a date and time into a single Date object (UTC)
 * IMPORTANT: This interprets the date/time as America/Toronto local time (EST/EDT)
 * The returned Date object is in UTC, representing the workout time in Toronto
 * @param {string|Date} dateInput - Date string (YYYY-MM-DD) or Date object
 * @param {string} timeStr - Time string in HH:MM:SS or HH:MM format
 * @returns {Date|null} - Combined Date object in UTC, or null if invalid
 */
function combineDateTime(dateInput, timeStr) {
  const time = parseTime(timeStr);
  if (!time) return null;
  
  // Extract date components
  let year, month, day;
  
  if (dateInput instanceof Date) {
    year = dateInput.getFullYear();
    month = dateInput.getMonth() + 1;
    day = dateInput.getDate();
  } else if (typeof dateInput === 'string') {
    // Parse YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const parts = dateInput.split('-').map(Number);
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else if (dateInput.includes('T')) {
      // ISO string - extract date part
      const datePart = dateInput.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const parts = datePart.split('-').map(Number);
        year = parts[0];
        month = parts[1];
        day = parts[2];
      } else {
        return null;
      }
    } else {
      const date = parseDate(dateInput);
      if (!date) return null;
      year = date.getFullYear();
      month = date.getMonth() + 1;
      day = date.getDate();
    }
  } else {
    return null;
  }
  
  // Create date-time string in Toronto timezone format: YYYY-MM-DDTHH:mm:ss
  const dateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}:${String(time.seconds).padStart(2, '0')}`;
  
  // Convert Toronto local time to UTC using date-fns-tz
  // This properly handles DST transitions automatically
  try {
    // Check if zonedTimeToUtc is available
    if (typeof zonedTimeToUtc !== 'function') {
      console.error('❌ zonedTimeToUtc is not a function. date-fns-tz may not be installed correctly.');
      // Fallback: Create date assuming Toronto timezone
      // This is a simple fallback - may not handle DST perfectly
      const date = new Date(`${dateTimeStr}-05:00`); // EST offset
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    }
    
    const result = zonedTimeToUtc(dateTimeStr, TORONTO_TIMEZONE);
    
    if (isNaN(result.getTime())) {
      return null;
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error in zonedTimeToUtc:', error);
    // Fallback: Create date assuming Toronto timezone
    const date = new Date(`${dateTimeStr}-05:00`); // EST offset
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  }
}

/**
 * Format a Date object for database storage (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string|null} - Formatted date string or null if invalid
 */
function formatDateForDB(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
  
  return date.toISOString().split('T')[0];
}

/**
 * Format a Date object for database storage (HH:MM:SS)
 * @param {Date} date - Date object
 * @returns {string|null} - Formatted time string or null if invalid
 */
function formatTimeForDB(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
  
  return date.toTimeString().split(' ')[0];
}

/**
 * Format a Date object for display
 * For workout dates: displays in Toronto timezone
 * For user timestamps: displays in UTC (no timezone assumption)
 * @param {Date} date - Date object (in UTC)
 * @param {Object} options - Intl.DateTimeFormat options
 * @param {boolean} isWorkoutTime - If true, format as Toronto time; if false, format as UTC
 * @returns {string} - Formatted date string
 */
function formatDateForDisplay(date, options = {}, isWorkoutTime = false) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  
  const defaultOptions = {
    timeZone: isWorkoutTime ? TORONTO_TIMEZONE : 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  return date.toLocaleDateString(undefined, { ...defaultOptions, ...options });
}

/**
 * Format a Date object for display with time
 * For workout datetimes: displays in Toronto timezone
 * For user timestamps: displays in UTC (no timezone assumption)
 * @param {Date} date - Date object (in UTC)
 * @param {Object} options - Intl.DateTimeFormat options
 * @param {boolean} isWorkoutTime - If true, format as Toronto time; if false, format as UTC
 * @returns {string} - Formatted datetime string
 */
function formatDateTimeForDisplay(date, options = {}, isWorkoutTime = false) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  
  const defaultOptions = {
    timeZone: isWorkoutTime ? TORONTO_TIMEZONE : 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return date.toLocaleString(undefined, { ...defaultOptions, ...options });
}

/**
 * Check if a date is in the past
 * @param {Date} date - Date object
 * @returns {boolean} - True if date is in the past
 */
function isPast(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
  
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setUTCHours(0, 0, 0, 0);
  
  return compareDate < now;
}

/**
 * Check if a date is within a certain number of hours from now
 * Both dates are compared in UTC (Date objects are always UTC internally)
 * @param {Date} date - Date object (in UTC)
 * @param {number} hours - Number of hours to check
 * @returns {boolean} - True if date is within the specified hours
 */
function isWithinHours(date, hours) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
  
  const now = new Date(); // Current UTC time
  const diffMs = date - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return diffHours >= 0 && diffHours <= hours;
}

/**
 * Get the number of hours until a date
 * @param {Date} date - Date object
 * @returns {number} - Number of hours until the date (negative if in the past)
 */
function getHoursUntil(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 0;
  
  const now = new Date();
  const diffMs = date - now;
  return diffMs / (1000 * 60 * 60);
}

/**
 * Get the number of days until a date
 * @param {Date} date - Date object
 * @returns {number} - Number of days until the date (negative if in the past)
 */
function getDaysUntil(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 0;
  
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setUTCHours(0, 0, 0, 0);
  
  const diffMs = compareDate - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format a signup/action timestamp for display in Toronto timezone
 * This ensures all users see the same time regardless of their location
 * @param {Date|string} date - Date object or ISO string (stored in UTC)
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted datetime string in Toronto timezone
 */
function formatSignupTimeForDisplay(date, options = {}) {
  if (!date) return '';
  
  // Convert to Date object if it's a string
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return '';
  
  const defaultOptions = {
    timeZone: TORONTO_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return dateObj.toLocaleString(undefined, { ...defaultOptions, ...options });
}

/**
 * Format a signup/action date for display in Toronto timezone
 * @param {Date|string} date - Date object or ISO string (stored in UTC)
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string in Toronto timezone
 */
function formatSignupDateForDisplay(date, options = {}) {
  if (!date) return '';
  
  // Convert to Date object if it's a string
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return '';
  
  const defaultOptions = {
    timeZone: TORONTO_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  return dateObj.toLocaleDateString(undefined, { ...defaultOptions, ...options });
}

/**
 * Format a signup/action time (just time, no date) for display in Toronto timezone
 * @param {Date|string} date - Date object or ISO string (stored in UTC)
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted time string in Toronto timezone
 */
function formatSignupTimeOnlyForDisplay(date, options = {}) {
  if (!date) return '';
  
  // Convert to Date object if it's a string
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return '';
  
  const defaultOptions = {
    timeZone: TORONTO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return dateObj.toLocaleTimeString(undefined, { ...defaultOptions, ...options });
}

module.exports = {
  parseDate,
  parseTime,
  combineDateTime,
  formatDateForDB,
  formatTimeForDB,
  formatDateForDisplay,
  formatDateTimeForDisplay,
  formatSignupTimeForDisplay,
  formatSignupDateForDisplay,
  formatSignupTimeOnlyForDisplay,
  isPast,
  isWithinHours,
  getHoursUntil,
  getDaysUntil,
  TORONTO_TIMEZONE // Export for use in other modules
};
