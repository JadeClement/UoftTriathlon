/**
 * Haptic Feedback Utilities
 * Provides haptic feedback for mobile devices using Web APIs
 */

/**
 * Trigger haptic feedback (vibration)
 * @param {number|number[]} pattern - Vibration pattern in milliseconds
 * @returns {boolean} - True if vibration is supported, false otherwise
 */
export function vibrate(pattern = 10) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      console.warn('Vibration failed:', error);
      return false;
    }
  }
  return false;
}

/**
 * Light haptic feedback (short tap)
 */
export function hapticLight() {
  return vibrate(10);
}

/**
 * Medium haptic feedback (medium tap)
 */
export function hapticMedium() {
  return vibrate(20);
}

/**
 * Heavy haptic feedback (strong tap)
 */
export function hapticHeavy() {
  return vibrate(30);
}

/**
 * Success haptic pattern (two quick taps)
 */
export function hapticSuccess() {
  return vibrate([10, 50, 10]);
}

/**
 * Error haptic pattern (three quick taps)
 */
export function hapticError() {
  return vibrate([20, 50, 20, 50, 20]);
}

/**
 * Warning haptic pattern (two medium taps)
 */
export function hapticWarning() {
  return vibrate([30, 100, 30]);
}

/**
 * Selection haptic feedback (for button presses, selections)
 */
export function hapticSelection() {
  return hapticLight();
}

/**
 * Impact haptic feedback (for actions like refresh, submit)
 */
export function hapticImpact() {
  return hapticMedium();
}

