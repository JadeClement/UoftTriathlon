/**
 * PWA Detection Utilities
 * Detects if the app is installed as a PWA (standalone mode)
 */

/**
 * Check if the app is running in standalone mode (installed as PWA)
 * @returns {boolean} True if running in standalone mode
 */
export function isStandalone() {
  // Check if running in standalone mode
  // This works for Android Chrome and iOS Safari (iOS 11.3+)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  // iOS Safari specific check (legacy support)
  if (window.navigator.standalone === true) {
    return true;
  }
  
  // Additional check: if launched from home screen on mobile
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return true;
  }
  
  return false;
}

/**
 * Check if the app is running on a mobile device
 * @returns {boolean} True if on mobile device
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}




