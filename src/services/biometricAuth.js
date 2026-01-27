import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

/**
 * Get the native biometric auth plugin
 * Capacitor automatically strips "Plugin" from class names, so BiometricAuthPlugin becomes BiometricAuth
 */
const getBiometricPlugin = () => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  return Capacitor.getPlugin('BiometricAuth');
};

/**
 * Check if biometric authentication is available on the device
 * @returns {Promise<{available: boolean, biometryType: string}>}
 */
export const checkBiometricAvailability = async () => {
  if (!Capacitor.isNativePlatform()) {
    return { available: false, biometryType: null };
  }

  try {
    const plugin = getBiometricPlugin();
    if (!plugin) {
      console.warn('BiometricAuth plugin not available');
      return { available: false, biometryType: null };
    }

    const result = await plugin.checkBiometry();
    return {
      available: result.isAvailable || false,
      biometryType: result.biometryType || null,
    };
  } catch (error) {
    console.error('Error checking biometric availability:', error);
    return { available: false, biometryType: null };
  }
};

/**
 * Authenticate using biometrics (Face ID, Touch ID, etc.)
 * @param {string} reason - Reason for authentication (shown to user)
 * @returns {Promise<boolean>} - True if authentication successful
 */
export const authenticateWithBiometrics = async (reason = 'Sign in to your account') => {
  if (!Capacitor.isNativePlatform()) {
    console.warn('Biometric authentication only available on native platforms');
    return false;
  }

  try {
    const plugin = getBiometricPlugin();
    if (!plugin) {
      console.warn('BiometricAuth plugin not available');
      return false;
    }

    const result = await plugin.authenticate({
      reason,
      title: 'Biometric Authentication',
      subtitle: 'Use Face ID or Touch ID to sign in',
      description: reason,
      fallbackTitle: 'Use Password',
      allowDeviceCredential: false,
    });

    return result.succeeded || false;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return false;
  }
};

/**
 * Save user credentials securely for biometric login
 * @param {string} email - User email
 * @param {string} token - Authentication token
 * @returns {Promise<void>}
 */
export const saveBiometricCredentials = async (email, token) => {
  if (!Capacitor.isNativePlatform()) {
    console.warn('Biometric credentials only saved on native platforms');
    return;
  }

  try {
    const credentials = {
      email,
      token,
      savedAt: Date.now(),
    };

    await Preferences.set({
      key: BIOMETRIC_CREDENTIALS_KEY,
      value: JSON.stringify(credentials),
    });

    await Preferences.set({
      key: BIOMETRIC_ENABLED_KEY,
      value: 'true',
    });

    console.log('✅ Biometric credentials saved');
  } catch (error) {
    console.error('Error saving biometric credentials:', error);
    throw error;
  }
};

/**
 * Retrieve saved biometric credentials
 * @returns {Promise<{email: string, token: string} | null>}
 */
export const getBiometricCredentials = async () => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const credentialsData = await Preferences.get({ key: BIOMETRIC_CREDENTIALS_KEY });
    
    if (!credentialsData || !credentialsData.value) {
      return null;
    }

    const credentials = JSON.parse(credentialsData.value);
    return {
      email: credentials.email,
      token: credentials.token,
    };
  } catch (error) {
    console.error('Error retrieving biometric credentials:', error);
    return null;
  }
};

/**
 * Check if biometric login is enabled
 * @returns {Promise<boolean>}
 */
export const isBiometricEnabled = async () => {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const result = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
    return result.value === 'true';
  } catch (error) {
    console.error('Error checking biometric enabled status:', error);
    return false;
  }
};

/**
 * Clear saved biometric credentials
 * @returns {Promise<void>}
 */
export const clearBiometricCredentials = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await Preferences.remove({ key: BIOMETRIC_CREDENTIALS_KEY });
    await Preferences.remove({ key: BIOMETRIC_ENABLED_KEY });
    console.log('✅ Biometric credentials cleared');
  } catch (error) {
    console.error('Error clearing biometric credentials:', error);
  }
};

/**
 * Perform biometric login - authenticates user and returns saved credentials
 * @returns {Promise<{email: string, token: string} | null>}
 */
export const performBiometricLogin = async () => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    // Check if biometric is enabled
    const enabled = await isBiometricEnabled();
    if (!enabled) {
      console.log('Biometric login not enabled');
      return null;
    }

    // Get saved credentials
    const credentials = await getBiometricCredentials();
    if (!credentials) {
      console.log('No saved biometric credentials found');
      return null;
    }

    // Authenticate with biometrics
    const authenticated = await authenticateWithBiometrics('Sign in to your account');
    if (!authenticated) {
      console.log('Biometric authentication failed');
      return null;
    }

    // Return credentials for login
    return credentials;
  } catch (error) {
    console.error('Error performing biometric login:', error);
    return null;
  }
};
