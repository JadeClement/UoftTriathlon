// NOTE: For the web build (including Vercel), we disable biometric auth entirely
// to avoid bundling native-only dependencies like @capacitor/preferences.
// The native Capacitor app can implement biometrics using a separate, native-only path.

/**
 * Check if biometric authentication is available on the device.
 * Web build: always reports unavailable.
 */
export const checkBiometricAvailability = async () => {
  return { available: false, biometryType: null };
};

/**
 * Authenticate using biometrics.
 * Web build: always returns false.
 */
export const authenticateWithBiometrics = async () => {
  return false;
};

/**
 * Save user credentials for biometric login.
 * Web build: no-op.
 */
export const saveBiometricCredentials = async () => {
  return;
};

/**
 * Retrieve saved biometric credentials.
 * Web build: always returns null.
 */
export const getBiometricCredentials = async () => {
  return null;
};

/**
 * Check if biometric login is enabled.
 * Web build: always false.
 */
export const isBiometricEnabled = async () => {
  return false;
};

/**
 * Clear saved biometric credentials.
 * Web build: no-op.
 */
export const clearBiometricCredentials = async () => {
  return;
};

/**
 * Perform biometric login.
 * Web build: always returns null.
 */
export const performBiometricLogin = async () => {
  return null;
};
