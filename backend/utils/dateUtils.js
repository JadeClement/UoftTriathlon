/**
 * Centralized date utilities for consistent date handling across the application
 * All dates are stored and processed in UTC to avoid timezone issues
 */

/**
 * Parse a date string or Date object into a standardized Date object
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
    // Handle ISO strings
    if (dateInput.includes('T') || dateInput.includes('Z')) {
      const date = new Date(dateInput);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Handle YYYY-MM-DD format (treat as UTC to avoid timezone shifts)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
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
 * Combine a date and time into a single Date object
 * @param {string|Date} dateInput - Date string or Date object
 * @param {string} timeStr - Time string in HH:MM:SS format
 * @returns {Date|null} - Combined Date object or null if invalid
 */
function combineDateTime(dateInput, timeStr) {
  const date = parseDate(dateInput);
  const time = parseTime(timeStr);
  
  if (!date || !time) return null;
  
  // Create a new date with the time set
  const result = new Date(date);
  result.setUTCHours(time.hours, time.minutes, time.seconds, 0);
  
  return result;
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
 * Format a Date object for display (localized)
 * @param {Date} date - Date object
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
function formatDateForDisplay(date, options = {}) {
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
function formatDateTimeForDisplay(date, options = {}) {
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
 * @param {Date} date - Date object
 * @param {number} hours - Number of hours to check
 * @returns {boolean} - True if date is within the specified hours
 */
function isWithinHours(date, hours) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
  
  const now = new Date();
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

module.exports = {
  parseDate,
  parseTime,
  combineDateTime,
  formatDateForDB,
  formatTimeForDB,
  formatDateForDisplay,
  formatDateTimeForDisplay,
  isPast,
  isWithinHours,
  getHoursUntil,
  getDaysUntil
};
