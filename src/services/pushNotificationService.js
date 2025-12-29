import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { handleNotificationNavigation, navigateTo } from '../utils/notificationNavigation';

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
let currentUserId = null;

// Store pending notification for when app launches from notification
let pendingNotificationAction = null;

/**
 * Set up notification listeners immediately on module load
 * This ensures listeners are ready even if app launches from notification
 */
function setupEarlyNotificationListeners() {
  if (!isNativePlatform || listenersSetup) {
    return;
  }
  
  console.log('📱 Setting up early notification listeners (before user login)');
  
  // Handle push notification actions (when user taps notification)
  // This MUST be set up early, before user login, to catch notifications that open the app
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('👆 ===== PUSH NOTIFICATION ACTION PERFORMED (EARLY) =====');
    console.log('👆 Full notification object:', JSON.stringify(notification, null, 2));
    
    // Store for later processing if navigation isn't ready
    pendingNotificationAction = notification;
    if (typeof window !== 'undefined') {
      window.pendingNotificationAction = notification;
    }
    console.log('📱 Stored pending notification action');
    
    // Try to handle immediately
    try {
      handleNotificationNavigation(notification);
    } catch (error) {
      console.error('❌ Error in early notification handler:', error);
      // Will be handled when navigation is ready
    }
  });
  
  // Handle local notification clicks (for foreground notifications)
  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    console.log('👆 ===== LOCAL NOTIFICATION CLICKED (EARLY) =====');
    console.log('👆 Local notification action:', JSON.stringify(action, null, 2));
    
    const data = action.notification?.extra || action.notification?.data || {};
    console.log('👆 Local notification data:', data);
    
    // Handle navigation immediately
    try {
      if (data?.type === 'workout' && data?.workoutId) {
        const workoutId = String(data.workoutId);
        console.log(`📍 Navigating from local notification to: /workout/${workoutId}`);
        navigateTo(`/workout/${workoutId}`);
      } else if (data?.type === 'event' && data?.eventId) {
        const eventId = String(data.eventId);
        console.log(`📍 Navigating from local notification to: /event/${eventId}`);
        navigateTo(`/event/${eventId}`);
      } else if (data?.type === 'race' && data?.raceId) {
        const raceId = String(data.raceId);
        console.log(`📍 Navigating from local notification to: /race/${raceId}`);
        navigateTo(`/race/${raceId}`);
      }
    } catch (error) {
      console.error('❌ Error handling local notification click:', error);
    }
  });
  
  console.log('✅ Early notification listeners set up');
}

// Set up listeners immediately when module loads
if (typeof window !== 'undefined' && isNativePlatform) {
  setupEarlyNotificationListeners();
}

// Global handler for AppDelegate to call directly
if (typeof window !== 'undefined') {
  window.handlePushToken = function(token) {
    console.log('📱 ===== GLOBAL HANDLER: Received token =====');
    console.log('📱 Token:', token);
    pushToken = token;
    
    // If we have a user ID, save the token
    if (currentUserId) {
      console.log(`📱 Saving token for user ${currentUserId} via global handler`);
      saveDeviceTokenToBackend(currentUserId, token);
    } else {
      console.log('⚠️ No user ID yet, token will be saved when user logs in');
      // Store token to save later
      window.pendingPushToken = token;
    }
  };
  console.log('📱 Global handlePushToken function registered');
}

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

  // Store user ID for global handler
  currentUserId = userId;
  
  // Check if there's a pending token from AppDelegate injection
  if (typeof window !== 'undefined' && window.pendingPushToken) {
    console.log('📱 Found pending token, saving now...');
    const pendingToken = window.pendingPushToken;
    delete window.pendingPushToken;
    pushToken = pendingToken;
    await saveDeviceTokenToBackend(userId, pendingToken);
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
    
    // Try to get token directly (in case it was already registered)
    try {
      // Some Capacitor versions expose a method to check registration state
      // This is a fallback if the event doesn't fire
      console.log('📱 Checking if token is already available...');
    } catch (e) {
      // Ignore - not all versions support this
    }

    // Wait and check if token arrived (iOS can take time)
    setTimeout(() => {
      if (!pushToken) {
        console.log('⚠️ No token received after 5 seconds');
        console.log('⚠️ Token was received at native level but not forwarded to JS');
        console.log('⚠️ This might be a Capacitor plugin bridge issue');
        console.log('⚠️ Trying to manually check for stored token...');
        
        // Try to manually trigger by calling register again (might re-emit token)
        PushNotifications.register().catch(err => {
          console.log('⚠️ Re-register attempt:', err);
        });
      } else {
        console.log('✅ Token received:', pushToken.substring(0, 20) + '...');
      }
    }, 5000);
    
    // Check again after 10 seconds
    setTimeout(() => {
      if (!pushToken) {
        console.log('⚠️ Still no token after 10 seconds');
        console.log('⚠️ Native token was received but Capacitor plugin bridge may not be working');
        console.log('⚠️ Check Xcode console for: "Token forwarded to Capacitor via NotificationCenter"');
      }
    }, 10000);

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
  
  // Note: Local notification listener is set up in setupEarlyNotificationListeners()
  // to ensure it's ready even if app launches from notification
  console.log('📱 Local notification listener already set up in early setup');
  
  // On registration, we receive the device token
  const registrationListener = PushNotifications.addListener('registration', async (token) => {
    console.log('📱 ===== PUSH REGISTRATION EVENT FIRED =====');
    console.log('📱 Push registration success, token: ' + token.value);
    console.log('📱 Token object:', JSON.stringify(token));
    console.log('📱 Token type:', typeof token);
    console.log('📱 Token.value:', token.value);
    pushToken = token.value;
    
    // Send token to backend
    console.log(`📱 Attempting to save token for user ${userId}...`);
    await saveDeviceTokenToBackend(userId, token.value);
  });
  console.log('📱 Registration listener added:', registrationListener);
  
  // Fallback: Listen for custom event from AppDelegate JavaScript injection
  if (typeof window !== 'undefined') {
    window.addEventListener('pushNotificationRegistration', (event) => {
      console.log('📱 ===== FALLBACK: Received token via custom event =====');
      const tokenValue = event.detail?.value;
      if (tokenValue) {
        console.log('📱 Fallback token received:', tokenValue);
        pushToken = tokenValue;
        saveDeviceTokenToBackend(userId, tokenValue);
      }
    });
    console.log('📱 Fallback custom event listener added');
  }

  // Handle registration errors
  const errorListener = PushNotifications.addListener('registrationError', (error) => {
    console.error('❌ ===== PUSH REGISTRATION ERROR =====');
    console.error('❌ Error on push registration:', error);
    console.error('❌ Registration error details:', JSON.stringify(error));
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error keys:', Object.keys(error || {}));
  });
  console.log('📱 Error listener added:', errorListener);

  // Handle received push notifications (when app is in foreground)
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('📬 ===== PUSH NOTIFICATION RECEIVED (FOREGROUND) =====');
    console.log('📬 Full notification object:', JSON.stringify(notification, null, 2));
    console.log('📬 Notification keys:', notification ? Object.keys(notification) : 'null');
    console.log('📬 Notification data:', notification?.data);
    console.log('📬 Notification title:', notification?.title);
    console.log('📬 Notification body:', notification?.body);
    
    // Store notification data for potential click handling
    if (notification?.data) {
      window.lastReceivedNotification = notification.data;
      console.log('📬 Stored notification data for click handling');
    }
    
    // Show local notification when app is in foreground
    // Pass the full notification object
    showLocalNotification(notification);
  });

  // Note: pushNotificationActionPerformed listener is set up in setupEarlyNotificationListeners()
  // to ensure it's ready even if app launches from notification
  // But we also set it up here as a backup (won't duplicate due to early setup)
  if (!listenersSetup) {
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('👆 ===== PUSH NOTIFICATION ACTION PERFORMED (BACKUP) =====');
      handleNotificationNavigation(notification);
    });
  }
  console.log('📱 Push notification action listener already set up in early setup');
  
  // Also check for pending notifications when app starts (in case app was opened from notification)
  // This is a fallback for when pushNotificationActionPerformed doesn't fire
  if (typeof window !== 'undefined' && window.Capacitor) {
    // Check if there's a pending notification in Capacitor's state
    PushNotifications.getDeliveredNotifications().then((notifications) => {
      if (notifications && notifications.notifications && notifications.notifications.length > 0) {
        console.log('📬 Found delivered notifications on app start:', notifications.notifications.length);
        // The most recent notification might be the one that opened the app
        const latestNotification = notifications.notifications[notifications.notifications.length - 1];
        console.log('📬 Latest notification:', latestNotification);
      }
    }).catch(err => {
      console.log('📬 Could not check delivered notifications:', err);
    });
  }
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
    console.log('📬 ===== SHOW LOCAL NOTIFICATION START =====');
    console.log('📬 Attempting to show local notification for foreground push');
    console.log('📬 Notification object:', JSON.stringify(notification, null, 2));
    console.log('📬 Notification type:', typeof notification);
    console.log('📬 Notification keys:', notification ? Object.keys(notification) : 'null');
    
    // Request local notification permissions
    console.log('📬 Requesting local notification permissions...');
    const permission = await LocalNotifications.requestPermissions();
    console.log('📬 Local notification permission result:', JSON.stringify(permission, null, 2));
    
    if (permission.display === 'granted') {
      console.log('📬 Permission granted, preparing notification...');
      
      // Extract notification data - handle different notification structures
      let notificationData = {};
      if (notification?.data) {
        notificationData = notification.data;
        console.log('📬 Found data in notification.data');
      } else if (notification?.notification?.data) {
        notificationData = notification.notification.data;
        console.log('📬 Found data in notification.notification.data');
      } else {
        notificationData = notification || {};
        console.log('📬 Using notification object as data');
      }
      
      console.log('📬 Extracted notification data:', JSON.stringify(notificationData, null, 2));
      
      // Create notification ID - must be a number for Capacitor
      // Use workoutId if available, otherwise use timestamp
      // CRITICAL: ID must be a positive integer between 1 and 2147483647
      let notificationId;
      
      try {
        if (notificationData.workoutId) {
          const parsedId = parseInt(String(notificationData.workoutId), 10);
          console.log('📬 Parsed workoutId:', parsedId, 'from:', notificationData.workoutId);
          
          // Validate: must be positive integer within iOS limits
          if (!isNaN(parsedId) && parsedId > 0 && parsedId <= 2147483647) {
            notificationId = parsedId;
            console.log('📬 ✅ Using workoutId as notification ID:', notificationId);
          } else {
            console.log('📬 ⚠️ workoutId out of range, using timestamp');
            notificationId = Math.abs(Math.floor(Date.now() % 2147483647));
          }
        } else {
          notificationId = Math.abs(Math.floor(Date.now() % 2147483647));
          console.log('📬 No workoutId found, using timestamp:', notificationId);
        }
      } catch (error) {
        console.error('❌ Error parsing notification ID:', error);
        notificationId = Math.abs(Math.floor(Date.now() % 2147483647));
      }
      
      // Final validation - ensure ID is a valid positive integer
      notificationId = Math.abs(Math.floor(Number(notificationId)));
      if (!notificationId || isNaN(notificationId) || notificationId <= 0 || notificationId > 2147483647) {
        console.error('❌ ID validation failed, forcing fallback');
        notificationId = Math.abs(Math.floor(Date.now() % 2147483647));
      }
      
      // Ensure it's an integer (not a float)
      notificationId = Math.floor(Number(notificationId));
      
      console.log('📬 ✅ Final notification ID:', notificationId);
      console.log('📬 ✅ ID type:', typeof notificationId);
      console.log('📬 ✅ ID is integer:', Number.isInteger(notificationId));
      console.log('📬 ✅ ID is valid:', !isNaN(notificationId) && notificationId > 0 && notificationId <= 2147483647);
      
      // Build notification payload with all required fields
      // Extract title and body from the push notification to match exactly
      // iOS push notifications structure: data.aps.alert.title and data.aps.alert.body
      let notificationTitle = notification?.title;
      let notificationBody = notification?.body;
      
      // Check various possible locations for title/body
      // iOS typically puts them in: notification.data.aps.alert.title/body
      if (!notificationTitle) {
        notificationTitle = notification?.data?.aps?.alert?.title ||
                          notificationData?.aps?.alert?.title ||
                          notificationData?.title || 
                          notification?.data?.title || 
                          notification?.aps?.alert?.title ||
                          'New Notification';
      }
      
      if (!notificationBody) {
        notificationBody = notification?.data?.aps?.alert?.body ||
                          notificationData?.aps?.alert?.body ||
                          notificationData?.body || 
                          notification?.data?.body || 
                          notification?.aps?.alert?.body ||
                          '';
      }
      
      console.log('📬 Extracted title:', notificationTitle);
      console.log('📬 Extracted body:', notificationBody);
      
      const notificationPayload = {
        id: Number(notificationId), // Explicitly convert to number
        title: String(notificationTitle),
        body: String(notificationBody),
        sound: 'default',
        extra: notificationData // Store full data for click handling
      };
      
      // Only add attachments if image exists
      if (notification?.data?.image || notificationData?.image) {
        notificationPayload.attachments = [{ url: String(notification?.data?.image || notificationData?.image) }];
      }
      
      // Final validation before sending
      if (!notificationPayload.id || isNaN(notificationPayload.id) || notificationPayload.id <= 0) {
        const error = new Error(`Invalid notification ID: ${notificationPayload.id} (type: ${typeof notificationPayload.id})`);
        console.error('❌', error);
        throw error;
      }
      
      // CRITICAL: Ensure ID is definitely set and is a valid number
      // This is a last-ditch check before sending to native
      if (!notificationPayload.id || typeof notificationPayload.id !== 'number' || !Number.isInteger(notificationPayload.id) || notificationPayload.id <= 0) {
        console.error('❌ CRITICAL: Notification ID is invalid, forcing fallback');
        notificationPayload.id = Math.abs(Math.floor(Date.now() % 2147483647));
        console.log('❌ Forced notification ID to:', notificationPayload.id);
      }
      
      console.log('📬 Notification payload before schedule:', JSON.stringify(notificationPayload, null, 2));
      console.log('📬 Payload ID check:', {
        hasId: 'id' in notificationPayload,
        idValue: notificationPayload.id,
        idType: typeof notificationPayload.id,
        idIsNumber: typeof notificationPayload.id === 'number',
        idIsInteger: Number.isInteger(notificationPayload.id),
        idIsValid: !isNaN(notificationPayload.id) && notificationPayload.id > 0 && notificationPayload.id <= 2147483647,
        idStringified: JSON.stringify(notificationPayload.id)
      });
      
      // Create a fresh, minimal object to ensure no hidden properties or getters
      // CRITICAL: ID must be a plain number, not an object or getter
      const notificationIdFinal = Math.floor(Number(notificationPayload.id));
      
      console.log('📬 Creating clean payload with ID:', notificationIdFinal);
      console.log('📬 ID validation before clean payload:', {
        original: notificationPayload.id,
        final: notificationIdFinal,
        type: typeof notificationIdFinal,
        isInteger: Number.isInteger(notificationIdFinal),
        isValid: !isNaN(notificationIdFinal) && notificationIdFinal > 0
      });
      
      // Build minimal payload - only required fields
      const cleanPayload = {
        id: notificationIdFinal, // Direct assignment, no conversion
        title: String(notificationTitle || 'New Notification'),
        body: String(notificationBody || ''),
        sound: 'default'
      };
      
      // Only add extra if we have data (some platforms don't like empty objects)
      if (notificationData && Object.keys(notificationData).length > 0) {
        cleanPayload.extra = notificationData;
      }
      
      if (notificationPayload.attachments) {
        cleanPayload.attachments = notificationPayload.attachments;
      }
      
      // Final validation of clean payload
      if (!cleanPayload.id || typeof cleanPayload.id !== 'number' || !Number.isInteger(cleanPayload.id) || cleanPayload.id <= 0) {
        console.error('❌ CRITICAL: Clean payload ID is invalid!', cleanPayload.id);
        cleanPayload.id = Math.abs(Math.floor(Date.now() % 2147483647));
        console.error('❌ Forced ID to:', cleanPayload.id);
      }
      
      console.log('📬 ✅ Clean notification payload:', JSON.stringify(cleanPayload, null, 2));
      console.log('📬 ✅ Clean payload ID check:', {
        hasId: 'id' in cleanPayload,
        idValue: cleanPayload.id,
        idType: typeof cleanPayload.id,
        idIsNumber: typeof cleanPayload.id === 'number',
        idIsInteger: Number.isInteger(cleanPayload.id),
        idStringified: String(cleanPayload.id)
      });
      
      console.log('📬 Calling LocalNotifications.schedule with:', JSON.stringify({ notifications: [cleanPayload] }, null, 2));
      
      // Double-check ID one more time right before calling
      if (!cleanPayload.id || typeof cleanPayload.id !== 'number') {
        console.error('❌ CRITICAL ERROR: ID is missing or wrong type right before schedule!');
        console.error('❌ Payload:', cleanPayload);
        throw new Error(`Invalid notification ID before schedule: ${cleanPayload.id} (type: ${typeof cleanPayload.id})`);
      }
      
      try {
        const result = await LocalNotifications.schedule({
          notifications: [cleanPayload]
        });
        
        console.log('📬 ✅ Local notification scheduled successfully:', JSON.stringify(result, null, 2));
        console.log('📬 Notification data stored:', notificationData);
        console.log('📬 ===== SHOW LOCAL NOTIFICATION SUCCESS =====');
      } catch (scheduleError) {
        console.error('❌ ERROR in LocalNotifications.schedule call:');
        console.error('❌ Error:', scheduleError);
        console.error('❌ Error message:', scheduleError?.message);
        console.error('❌ Error stack:', scheduleError?.stack);
        console.error('❌ Payload that failed:', JSON.stringify(cleanPayload, null, 2));
        console.error('❌ Payload ID:', cleanPayload.id, 'type:', typeof cleanPayload.id);
        throw scheduleError; // Re-throw to be caught by outer try-catch
      }
    } else {
      console.warn('⚠️ Local notification permission not granted:', permission);
      console.warn('⚠️ Permission status:', permission.display);
      
      // Fallback: Try to show notification anyway (some platforms allow it)
      try {
        const notificationData = notification.data || {};
        const notificationId = notificationData.workoutId 
          ? Math.abs(Math.floor(parseInt(notificationData.workoutId))) || Date.now()
          : Date.now();
        
        await LocalNotifications.schedule({
          notifications: [{
            id: notificationId,
            title: notification.title || 'New Notification',
            body: notification.body || '',
            sound: 'default',
            extra: notificationData
          }]
        });
        console.log('📬 Local notification scheduled despite permission warning');
      } catch (fallbackError) {
        console.error('❌ Fallback notification also failed:', fallbackError);
      }
    }
  } catch (error) {
    console.error('❌ Error showing local notification:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
}

/**
 * Handle notification action (when user taps notification)
 * @deprecated Use handleNotificationNavigation from notificationNavigation.js instead
 * Kept as fallback for error handling
 */
function handleNotificationAction(notification) {
  console.log('👆 Fallback handleNotificationAction called:', notification);
  
  try {
    // Try the new navigation helper first
    handleNotificationNavigation(notification);
  } catch (error) {
    console.error('❌ Error in notification navigation, using fallback:', error);
    
    // Fallback to window.location
    const data = notification.notification?.data || notification.data || {};
    
    if (data?.type === 'workout' && data?.workoutId) {
      window.location.href = `/workout/${data.workoutId}`;
    } else if (data?.type === 'event' && data?.eventId) {
      window.location.href = `/event/${data.eventId}`;
    } else if (data?.type === 'forum' && data?.postId) {
      window.location.href = `/forum`;
    } else if (data?.type === 'race' && data?.raceId) {
      window.location.href = `/race/${data.raceId}`;
    }
  }
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


