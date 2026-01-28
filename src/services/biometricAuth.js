// src/services/biometricAuth.js
// Native Face ID/Touch ID via BiometricAuth Swift plugin + localStorage for "enabled" state.

import { Capacitor } from '@capacitor/core';

const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

// Get the native BiometricAuth plugin instance
const getBiometricPlugin = () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('🔐 [BiometricAuth] Not on native platform');
    return null;
  }

  try {
    const plugin = Capacitor.getPlugin('BiometricAuth');
    if (plugin) {
      console.log('🔐 [BiometricAuth] Plugin via Capacitor.getPlugin', Object.keys(plugin));
      return plugin;
    }
  } catch (e) {
    console.warn('🔐 [BiometricAuth] Capacitor.getPlugin failed:', e);
  }

  try {
    const plugin =
      window?.Capacitor?.Plugins?.BiometricAuth ||
      window?.Capacitor?.Plugins?.BiometricAuthPlugin;
    if (plugin) {
      console.log('🔐 [BiometricAuth] Plugin via window.Capacitor.Plugins', Object.keys(plugin));
      return plugin;
    }
  } catch (e) {
    console.warn('🔐 [BiometricAuth] window.Capacitor.Plugins lookup failed:', e);
  }

  console.warn('🔐 [BiometricAuth] Plugin not found');
  return null;
};

// Check if biometrics are available
export const checkBiometricAvailability = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('🔐 [BiometricAuth] checkBiometricAvailability: web/non-native -> disabled');
    return { available: false, biometryType: null };
  }

  try {
    const plugin = getBiometricPlugin();
    if (!plugin || typeof plugin.checkBiometry !== 'function') {
      console.warn('🔐 [BiometricAuth] checkBiometry not available on plugin');
      return { available: false, biometryType: null };
    }

    const result = await plugin.checkBiometry();
    console.log('🔐 [BiometricAuth] checkBiometry result:', result);
    return {
      available: !!result?.isAvailable,
      biometryType: result?.biometryType || null,
    };
  } catch (err) {
    console.error('🔐 [BiometricAuth] checkBiometricAvailability error:', err);
    return { available: false, biometryType: null };
  }
};

// Run biometric prompt
export const authenticateWithBiometrics = async (reason = 'Sign in to your account') => {
  if (!Capacitor.isNativePlatform()) {
    console.log('🔐 [BiometricAuth] authenticateWithBiometrics: web/non-native -> false');
    return false;
  }

  try {
    const plugin = getBiometricPlugin();
    if (!plugin || typeof plugin.authenticate !== 'function') {
      console.warn('🔐 [BiometricAuth] authenticate not available on plugin');
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

    console.log('🔐 [BiometricAuth] authenticate result:', result);
    return !!result?.succeeded;
  } catch (err) {
    console.error('🔐 [BiometricAuth] authenticateWithBiometrics error:', err);
    return false;
  }
};

// Save email + token in localStorage for biometric login
export const saveBiometricCredentials = async (email, token) => {
  if (!Capacitor.isNativePlatform()) {
    console.log('🔐 [BiometricAuth] saveBiometricCredentials: web/non-native -> no-op');
    return;
  }

  if (!email || !token) {
    console.error('🔐 [BiometricAuth] saveBiometricCredentials: missing email or token', {
      hasEmail: !!email,
      hasToken: !!token,
    });
    throw new Error('Email and token are required');
  }

  try {
    console.log('🔐 [BiometricAuth] Saving credentials for', email);
    const payload = { email, token, savedAt: Date.now() };

    localStorage.setItem(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(payload));
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');

    const flag = localStorage.getItem(BIOMETRIC_ENABLED_KEY);
    const raw = localStorage.getItem(BIOMETRIC_CREDENTIALS_KEY);
    console.log('🔐 [BiometricAuth] Verify save -> enabled=', flag, 'credsPresent=', !!raw);
  } catch (err) {
    console.error('🔐 [BiometricAuth] Error saving credentials:', err);
    throw err;
  }
};

// Read saved biometric credentials
export const getBiometricCredentials = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('🔐 [BiometricAuth] getBiometricCredentials: web/non-native -> null');
    return null;
  }

  try {
    const raw = localStorage.getItem(BIOMETRIC_CREDENTIALS_KEY);
    if (!raw) {
      console.log('🔐 [BiometricAuth] getBiometricCredentials: no stored credentials');
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.email || !parsed?.token) {
      console.warn('🔐 [BiometricAuth] getBiometricCredentials: malformed payload', parsed);
      return null;
    }

    return { email: parsed.email, token: parsed.token };
  } catch (err) {
    console.error('🔐 [BiometricAuth] Error parsing stored credentials:', err);
    return null;
  }
};

// Is biometric login enabled in our app?
export const isBiometricEnabled = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('🔐 [BiometricAuth] isBiometricEnabled: web/non-native -> false');
    return false;
  }

  try {
    const flag = localStorage.getItem(BIOMETRIC_ENABLED_KEY);
    const enabled = flag === 'true';
    console.log('🔐 [BiometricAuth] isBiometricEnabled -> flag:', flag, 'enabled:', enabled);
    return enabled;
  } catch (err) {
    console.error('🔐 [BiometricAuth] Error reading enabled flag:', err);
    return false;
  }
};

// Clear biometric state
export const clearBiometricCredentials = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('🔐 [BiometricAuth] clearBiometricCredentials: web/non-native -> no-op');
    return;
  }

  try {
    localStorage.removeItem(BIOMETRIC_CREDENTIALS_KEY);
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    console.log('🔐 [BiometricAuth] Cleared biometric credentials');
  } catch (err) {
    console.error('🔐 [BiometricAuth] Error clearing credentials:', err);
  }
};

// Full biometric login flow
export const performBiometricLogin = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('🔐 [BiometricAuth] performBiometricLogin: web/non-native -> null');
    return null;
  }

  try {
    const enabled = await isBiometricEnabled();
    if (!enabled) {
      console.log('🔐 [BiometricAuth] performBiometricLogin: not enabled');
      return null;
    }

    const credentials = await getBiometricCredentials();
    if (!credentials) {
      console.log('🔐 [BiometricAuth] performBiometricLogin: no stored credentials');
      return null;
    }

    const ok = await authenticateWithBiometrics('Sign in to your account');
    if (!ok) {
      console.log('🔐 [BiometricAuth] performBiometricLogin: authentication failed/cancelled');
      return null;
    }

    console.log('🔐 [BiometricAuth] performBiometricLogin: success');
    return credentials;
  } catch (err) {
    console.error('🔐 [BiometricAuth] performBiometricLogin error:', err);
    return null;
  }
};