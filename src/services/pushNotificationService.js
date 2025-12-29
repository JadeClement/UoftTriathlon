import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Push Notification Service
 * 
 * Handles native push notifications for Capacitor apps (iOS/Android)
 * Falls back gracefully on web/desktop platforms
 */

const isNativePlatform = Capacitor.isNativePlatform();
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

let pushToken = null;
let isRegistered = false;
let listenersSetup = false;

/**
 * Request push notification permissions
 * @returns {Promise<boolean>} True if permissions granted, false otherwise
 */
export async function requestPushPermissions() {
  if (!isNativePlatform) {
    console.log('📱 Push notifications not available on web platform');
    return false;
  }

  try {
    // Request permission to send push notifications
    const permissionResult = await PushNotifications.requestPermissions();
    
    if (permissionResult.receive === 'granted') {
      console.log('✅ Push notification permissions granted');
      return true;
    } else {
      console.log('❌ Push notification permissions denied');
      return false;
    }
  } catch (error) {
    console.error('❌ Error requesting push permissions:', error);
    return false;
  }
}

/**
 * Register for push notifications
 * This should be called after user logs in
 * @param {string} userId - Current user ID
 * @returns {Promise<boolean>} True if registration successful
 */
export async function registerForPushNotifications(userId) {
  if (!isNativePlatform) {
    console.log('📱 Push notifications not available on web platform');
    return false;
  }

  if (!userId) {
    console.log('⚠️ Cannot register for push notifications: no user ID');
    return false;
  }

  if (isRegistered) {
    console.log('📱 Already registered for push notifications');
    return true;
  }

  try {
    // Request permissions first
    const hasPermission = await requestPushPermissions();
    if (!hasPermission) {
      return false;
    }

    // Set up event listeners BEFORE registering (to catch immediate token)
    if (!listenersSetup) {
      setupPushNotificationListeners(userId);
      listenersSetup = true;
    }

    // Register for push notifications
    console.log('📱 Calling PushNotifications.register()...');
    await PushNotifications.register();
    console.log('📱 PushNotifications.register() completed, waiting for token...');

    isRegistered = true;
    console.log('✅ Registered for push notifications');
    return true;
  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);
    return false;
  }
}

/**
 * Set up push notification event listeners
 * @param {string} userId - Current user ID
 */
function setupPushNotificationListeners(userId) {
  console.log(`📱 Setting up push notification listeners for user ${userId}`);
  
  // On registration, we receive the device token
  PushNotifications.addListener('registration', async (token) => {
    console.log('📱 Push registration success, token: ' + token.value);
    console.log('📱 Token object:', JSON.stringify(token));
    pushToken = token.value;
    
    // Send token to backend
    console.log(`📱 Attempting to save token for user ${userId}...`);
    await saveDeviceTokenToBackend(userId, token.value);
  });

  // Handle registration errors
  PushNotifications.addListener('registrationError', (error) => {
    console.error('❌ Error on push registration:', error);
    console.error('❌ Registration error details:', JSON.stringify(error));
  });

  // Handle received push notifications (when app is in foreground)
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('📬 Push notification received:', notification);
    
    // Show local notification when app is in foreground
    showLocalNotification(notification);
  });

  // Handle push notification actions (when user taps notification)
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('👆 Push notification action performed:', notification);
    
    // Handle navigation based on notification data
    handleNotificationAction(notification);
  });
}

/**
 * Save device token to backend
 * @param {string} userId - User ID
 * @param {string} token - Device push token
 */
async function saveDeviceTokenToBackend(userId, token) {
  try {
    const authToken = localStorage.getItem('triathlonToken');
    if (!authToken) {
      console.log('⚠️ Cannot save device token: no auth token');
      return;
    }

    const platform = Capacitor.getPlatform();
    console.log(`📱 Saving device token for user ${userId}, platform: ${platform}, token length: ${token.length}`);

    const response = await fetch(`${API_BASE_URL}/users/push-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: token,
        platform: platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : platform
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Device token saved to backend:', data);
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Failed to save device token to backend:', response.status, errorData);
    }
  } catch (error) {
    console.error('❌ Error saving device token to backend:', error);
  }
}

/**
 * Show local notification when push is received in foreground
 * @param {Object} notification - Push notification object
 */
async function showLocalNotification(notification) {
  try {
    // Request local notification permissions
    const permission = await LocalNotifications.requestPermissions();
    
    if (permission.display === 'granted') {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title || 'New Notification',
            body: notification.body || '',
            id: Date.now(),
            sound: 'default',
            attachments: notification.data?.image ? [{ url: notification.data.image }] : undefined,
            extra: notification.data
          }
        ]
      });
    }
  } catch (error) {
    console.error('❌ Error showing local notification:', error);
  }
}

/**
 * Handle notification action (when user taps notification)
 * @param {Object} notification - Notification action object
 */
function handleNotificationAction(notification) {
  // This will be handled by the app router
  // For now, just log - can be extended to navigate to specific screens
  const data = notification.notification.data;
  
  if (data?.type === 'workout') {
    // Navigate to workout detail
    window.location.href = `/workouts/${data.workoutId}`;
  } else if (data?.type === 'event') {
    // Navigate to event detail
    window.location.href = `/events/${data.eventId}`;
  } else if (data?.type === 'forum') {
    // Navigate to forum post
    window.location.href = `/forum/${data.postId}`;
  } else if (data?.type === 'race') {
    // Navigate to race detail
    window.location.href = `/races/${data.raceId}`;
  }
  
  console.log('📍 Would navigate to:', data);
}

/**
 * Unregister from push notifications (e.g., on logout)
 */
export async function unregisterFromPushNotifications() {
  if (!isNativePlatform) {
    return;
  }

  try {
    // Remove all listeners
    await PushNotifications.removeAllListeners();
    
    // Optionally, delete token from backend
    const authToken = localStorage.getItem('triathlonToken');
    if (authToken && pushToken) {
      try {
        await fetch(`${API_BASE_URL}/users/push-token`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token: pushToken })
        });
      } catch (error) {
        console.error('❌ Error deleting device token from backend:', error);
      }
    }

    isRegistered = false;
    pushToken = null;
    console.log('✅ Unregistered from push notifications');
  } catch (error) {
    console.error('❌ Error unregistering from push notifications:', error);
  }
}

/**
 * Check if push notifications are available
 * @returns {boolean}
 */
export function isPushNotificationsAvailable() {
  return isNativePlatform;
}

/**
 * Get current push token (if registered)
 * @returns {string|null}
 */
export function getPushToken() {
  return pushToken;
}


