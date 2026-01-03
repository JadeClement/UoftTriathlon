/**
 * Offline Check Utility
 * Provides simple functions to check online status and show user-friendly error messages
 */

/**
 * Check if device is online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Check if device is offline
 */
export function isOffline() {
  return !navigator.onLine;
}

/**
 * Get a user-friendly offline error message
 */
export function getOfflineErrorMessage() {
  return "Whoops! You're offline right now. Please check your internet connection and try again when you're back online!";
}

/**
 * Check if online, throw error if offline
 * Useful for operations that require online connection
 */
export function requireOnline() {
  if (isOffline()) {
    throw new Error(getOfflineErrorMessage());
  }
}

/**
 * Check if online before making a request
 * Returns true if online, false if offline
 */
export function checkOnlineBeforeRequest() {
  if (isOffline()) {
    // Note: This alert is for offline detection
    // In a real implementation, this should use a notification system
    // For now, keeping as alert since it's a utility function
    console.warn(getOfflineErrorMessage());
    return false;
  }
  return true;
}

/**
 * Wrapper for fetch that checks online status first
 * Shows error message if offline, otherwise makes the request
 */
export async function fetchWithOfflineCheck(url, options = {}) {
  if (isOffline()) {
    throw new Error(getOfflineErrorMessage());
  }
  
  return fetch(url, options);
}

/**
 * Listen for online/offline status changes
 * @param {Function} callback - Called with (isOnline: boolean) when status changes
 * @returns {Function} - Cleanup function to remove listeners
 */
export function onOnlineStatusChange(callback) {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Call immediately with current status
  callback(navigator.onLine);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

