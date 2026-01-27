/**
 * API Configuration Utility
 * Handles API URL configuration for different platforms
 */

import { Capacitor } from '@capacitor/core';

/**
 * Get the API base URL based on the current platform
 * For iOS simulator, localhost doesn't work - need to use Mac's IP address
 */
export function getApiBaseUrl() {
  // First, check if environment variable is set (highest priority)
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }

  // Check if we're on iOS (simulator or device)
  const isIOS = Capacitor.getPlatform() === 'ios';
  const isNative = Capacitor.isNativePlatform();

  if (isIOS && isNative) {
    // For iOS simulator/device, localhost won't work
    // Default to using the Mac's local IP (user should set this in .env)
    // Common local IP ranges: 192.168.x.x or 10.0.x.x
    // For now, we'll use a placeholder that the user needs to configure
    console.warn('⚠️ iOS detected: Using default API URL. For iOS simulator, set REACT_APP_API_BASE_URL in .env to your Mac\'s IP (e.g., http://192.168.1.100:5001/api)');
    
    // Try to use a common development IP, but user should override this
    // You can find your Mac's IP by running: ipconfig getifaddr en0
    return 'http://localhost:5001/api'; // This won't work on simulator, but we'll warn
  }

  // For web or other platforms, use localhost
  return 'http://localhost:5001/api';
}

/**
 * Get the full API URL for a specific endpoint
 * @param {string} endpoint - API endpoint (e.g., '/auth/login')
 * @returns {string} Full URL
 */
export function getApiUrl(endpoint) {
  const baseUrl = getApiBaseUrl();
  // Remove trailing slash from base URL and leading slash from endpoint
  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}
