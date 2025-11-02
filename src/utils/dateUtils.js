/**
 * Frontend date utilities for consistent date handling
 * All dates are processed in UTC to avoid timezone issues
 */

/**
 * Parse a date string or Date object into a standardized Date object
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export function parseDate(dateInput) {
  if (!dateInput) return null;
  
  // If it's already a Date object, return it
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  
  // Handle string inputs
  if (typeof dateInput === 'string') {
    // Handle ISO strings
    if (dateInput.includes('T') || dateInput.includes('Z')) {
      const date = new Date(dateInput);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Handle YYYY-MM-DD format (treat as local date to match user's timezone)
    // This ensures workout dates match the user's local timezone
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-').map(Number);
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
export function parseTime(timeStr) {
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
 * Combine a date and time into a single Date object
 * @param {string|Date} dateInput - Date string or Date object
 * @param {string} timeStr - Time string in HH:MM:SS format
 * @returns {Date|null} - Combined Date object or null if invalid
 */
export function combineDateTime(dateInput, timeStr) {
  console.log('🕐 combineDateTime called:', { dateInput, timeStr });
  
  const date = parseDate(dateInput);
  const time = parseTime(timeStr);
  
  console.log('🕐 Parsed values:', { date, time, dateIsValid: date instanceof Date && !isNaN(date.getTime()) });
  
  if (!date || !time) {
    console.warn('⚠️ combineDateTime: Invalid date or time', { date, time });
    return null;
  }
  
  // Create a new date with the time set in LOCAL timezone
  // This ensures the workout time matches the user's local timezone
  const result = new Date(date);
  result.setHours(time.hours, time.minutes, time.seconds, 0);
  
  console.log('🕐 Combined datetime:', {
    result: result.toISOString(),
    resultLocal: result.toString(),
    hours: time.hours,
    minutes: time.minutes
  });
  
  return result;
}

/**
 * Format a Date object for display (localized)
 * @param {Date} date - Date object
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
export function formatDateForDisplay(date, options = {}) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  
  const defaultOptions = {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  return date.toLocaleDateString(undefined, { ...defaultOptions, ...options });
}

/**
 * Format a Date object for display with time (localized)
 * @param {Date} date - Date object
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted datetime string
 */
export function formatDateTimeForDisplay(date, options = {}) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  
  const defaultOptions = {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return date.toLocaleString(undefined, { ...defaultOptions, ...options });
}

/**
 * Format a date for input fields (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string for input fields
 */
export function formatDateForInput(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  
  return date.toISOString().split('T')[0];
}

/**
 * Format a time for input fields (HH:MM)
 * @param {Date} date - Date object
 * @returns {string} - Formatted time string for input fields
 */
export function formatTimeForInput(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  
  return date.toTimeString().split(' ')[0].substring(0, 5);
}

/**
 * Check if a date is in the past
 * @param {Date} date - Date object
 * @returns {boolean} - True if date is in the past
 */
export function isPast(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
  
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setUTCHours(0, 0, 0, 0);
  
  return compareDate < now;
}

/**
 * Check if a date is within a certain number of hours from now
 * @param {Date} date - Date object
 * @param {number} hours - Number of hours to check
 * @returns {boolean} - True if date is within the specified hours
 */
export function isWithinHours(date, hours) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.warn('⚠️ isWithinHours: Invalid date', { date });
    return false;
  }
  
  const now = new Date();
  const diffMs = date - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  const within = diffHours >= 0 && diffHours <= hours;
  
  console.log('🕐 isWithinHours:', {
    workoutDate: date.toISOString(),
    workoutDateLocal: date.toString(),
    currentDate: now.toISOString(),
    currentDateLocal: now.toString(),
    diffHours: diffHours.toFixed(2),
    checkHours: hours,
    within
  });
  
  return within;
}

/**
 * Get the number of hours until a date
 * @param {Date} date - Date object
 * @returns {number} - Number of hours until the date (negative if in the past)
 */
export function getHoursUntil(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.warn('⚠️ getHoursUntil: Invalid date', { date });
    return 0;
  }
  
  const now = new Date();
  const diffMs = date - now;
  const hours = diffMs / (1000 * 60 * 60);
  
  console.log('🕐 getHoursUntil:', {
    workoutDate: date.toISOString(),
    workoutDateLocal: date.toString(),
    currentDate: now.toISOString(),
    currentDateLocal: now.toString(),
    diffMs,
    hours: hours.toFixed(2)
  });
  
  return hours;
}

/**
 * Get the number of days until a date
 * @param {Date} date - Date object
 * @returns {number} - Number of days until the date (negative if in the past)
 */
export function getDaysUntil(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 0;
  
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setUTCHours(0, 0, 0, 0);
  
  const diffMs = compareDate - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get a human-readable relative time string
 * @param {Date} date - Date object
 * @returns {string} - Relative time string (e.g., "2 days", "Tomorrow", "Today")
 */
export function getRelativeTime(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  
  const days = getDaysUntil(date);
  
  if (days < 0) {
    return `Past (${Math.abs(days)} days ago)`;
  } else if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Tomorrow';
  } else {
    return `${days} days`;
  }
}

/**
 * Get month and year string for grouping
 * @param {Date} date - Date object
 * @returns {string} - Month and year string (e.g., "September 2025")
 */
export function getMonthYear(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  
  return date.toLocaleDateString(undefined, { 
    timeZone: 'UTC',
    month: 'long', 
    year: 'numeric' 
  });
}
