require('dotenv').config();

/**
 * Push Notification Sender Service
 * 
 * Handles sending push notifications via FCM (Android) and APNs (iOS)
 * Requires proper configuration in environment variables
 */

let fcmAdmin = null;
let apnProvider = null;

/**
 * Initialize Firebase Cloud Messaging (FCM) for Android
 */
function initializeFCM() {
  if (fcmAdmin) {
    return fcmAdmin; // Already initialized
  }

  try {
    // Check if FCM is configured
    if (process.env.FCM_SERVICE_ACCOUNT_PATH) {
      const admin = require('firebase-admin');
      
      // Initialize with service account (recommended)
      if (!admin.apps.length) {
        const serviceAccount = require(process.env.FCM_SERVICE_ACCOUNT_PATH);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ FCM initialized with service account');
      }
      fcmAdmin = admin;
      return fcmAdmin;
    } else if (process.env.FCM_SERVER_KEY) {
      // Legacy FCM server key (less secure, but simpler setup)
      console.log('⚠️ FCM_SERVER_KEY detected. Consider using FCM_SERVICE_ACCOUNT_PATH for better security.');
      // For legacy key, we'll use HTTP API instead
      fcmAdmin = { legacy: true, serverKey: process.env.FCM_SERVER_KEY };
      return fcmAdmin;
    } else {
      console.log('⚠️ FCM not configured. Set FCM_SERVICE_ACCOUNT_PATH or FCM_SERVER_KEY to enable Android push notifications.');
      return null;
    }
  } catch (error) {
    console.error('❌ Error initializing FCM:', error);
    return null;
  }
}

/**
 * Initialize Apple Push Notification service (APNs) for iOS
 */
function initializeAPNs() {
  if (apnProvider) {
    return apnProvider; // Already initialized
  }

  try {
    // Check if APNs is configured
    // Support both file path (local) and base64 encoded key (production/Vercel)
    const hasKeyPath = process.env.APNS_KEY_PATH;
    const hasKeyBase64 = process.env.APNS_KEY_BASE64;
    const hasKeyId = process.env.APNS_KEY_ID;
    const hasTeamId = process.env.APNS_TEAM_ID;
    
    if ((hasKeyPath || hasKeyBase64) && hasKeyId && hasTeamId) {
      const apn = require('apn');
      let key;
      
      // Method 1: Read from base64 encoded environment variable (for Vercel/production)
      if (hasKeyBase64) {
        try {
          key = Buffer.from(process.env.APNS_KEY_BASE64, 'base64');
          console.log('📱 APNs: Using key from APNS_KEY_BASE64 environment variable');
        } catch (error) {
          console.error('❌ Error decoding APNS_KEY_BASE64:', error);
          return null;
        }
      }
      // Method 2: Read from file path (for local development)
      else if (hasKeyPath) {
        const fs = require('fs');
        const keyPath = process.env.APNS_KEY_PATH;
        if (!fs.existsSync(keyPath)) {
          console.error('❌ APNs key file not found:', keyPath);
          return null;
        }
        key = fs.readFileSync(keyPath);
        console.log('📱 APNs: Using key from file:', keyPath);
      } else {
        console.log('⚠️ APNs not configured. Set APNS_KEY_PATH (local) or APNS_KEY_BASE64 (production) along with APNS_KEY_ID and APNS_TEAM_ID.');
        return null;
      }
      
      apnProvider = new apn.Provider({
        token: {
          key: key,
          keyId: process.env.APNS_KEY_ID,
          teamId: process.env.APNS_TEAM_ID
        },
        production: process.env.APNS_PRODUCTION === 'true' || process.env.NODE_ENV === 'production'
      });
      
      console.log('✅ APNs initialized');
      return apnProvider;
    } else {
      console.log('⚠️ APNs not configured. Set APNS_KEY_PATH (local) or APNS_KEY_BASE64 (production) along with APNS_KEY_ID and APNS_TEAM_ID to enable iOS push notifications.');
      return null;
    }
  } catch (error) {
    console.error('❌ Error initializing APNs:', error);
    return null;
  }
}

/**
 * Send push notification to Android device via FCM
 * @param {string} token - FCM device token
 * @param {Object} notification - { title, body, data }
 * @returns {Promise<boolean>} True if sent successfully
 */
async function sendFCMNotification(token, notification) {
  try {
    const fcm = initializeFCM();
    if (!fcm) {
      console.log('⚠️ FCM not initialized, skipping Android notification');
      return false;
    }

    // Use FCM Admin SDK (recommended)
    if (fcm && typeof fcm.messaging === 'function') {
      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: Object.keys(notification.data || {}).reduce((acc, key) => {
          acc[key] = String(notification.data[key]); // FCM data must be strings
          return acc;
        }, {}),
        token: token
      };

      const response = await fcm.messaging().send(message);
      console.log('✅ FCM notification sent successfully:', response);
      return true;
    } 
    // Legacy FCM server key - use HTTP API
    else if (fcm.legacy) {
      const https = require('https');
      
      const message = {
        to: token,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {}
      };

      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'fcm.googleapis.com',
          path: '/fcm/send',
          method: 'POST',
          headers: {
            'Authorization': `key=${fcm.serverKey}`,
            'Content-Type': 'application/json'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode === 200) {
              console.log('✅ FCM (legacy) notification sent successfully');
              resolve(true);
            } else {
              console.error('❌ FCM (legacy) error:', res.statusCode, data);
              resolve(false);
            }
          });
        });

        req.on('error', (error) => {
          console.error('❌ FCM (legacy) request error:', error);
          resolve(false);
        });

        req.write(JSON.stringify(message));
        req.end();
      });
    }

    return false;
  } catch (error) {
    console.error('❌ Error sending FCM notification:', error);
    return false;
  }
}

/**
 * Send push notification to iOS device via APNs
 * @param {string} token - APNs device token
 * @param {Object} notification - { title, body, data }
 * @returns {Promise<boolean>} True if sent successfully
 */
async function sendAPNsNotification(token, notification) {
  try {
    const apn = require('apn');
    const provider = initializeAPNs();
    if (!provider) {
      console.log('⚠️ APNs not initialized, skipping iOS notification');
      return false;
    }

    const apnNotification = new apn.Notification();
    apnNotification.alert = {
      title: notification.title,
      body: notification.body
    };
    apnNotification.topic = process.env.APNS_BUNDLE_ID || 'uofttri.club.app';
    apnNotification.payload = notification.data || {};
    apnNotification.sound = 'default';
    apnNotification.badge = 1;
    apnNotification.pushType = 'alert';

    const result = await provider.send(apnNotification, token);
    
    if (result.sent && result.sent.length > 0) {
      console.log('✅ APNs notification sent successfully');
      return true;
    } else if (result.failed && result.failed.length > 0) {
      console.error('❌ APNs notification failed:', result.failed);
      return false;
    }

    return false;
  } catch (error) {
    console.error('❌ Error sending APNs notification:', error);
    return false;
  }
}

/**
 * Send push notification to a device based on platform
 * @param {string} token - Device token
 * @param {string} platform - 'ios' or 'android'
 * @param {Object} notification - { title, body, data }
 * @returns {Promise<boolean>} True if sent successfully
 */
async function sendPushNotification(token, platform, notification) {
  if (platform === 'ios') {
    return await sendAPNsNotification(token, notification);
  } else if (platform === 'android') {
    return await sendFCMNotification(token, notification);
  } else {
    console.error('❌ Unknown platform:', platform);
    return false;
  }
}

/**
 * Send push notifications to multiple devices
 * @param {Array} tokens - Array of { token, platform }
 * @param {Object} notification - { title, body, data }
 * @returns {Promise<Object>} { sent: number, failed: number }
 */
async function sendBulkPushNotifications(tokens, notification) {
  const results = { sent: 0, failed: 0 };
  
  // Group tokens by platform for efficiency
  const iosTokens = tokens.filter(t => t.platform === 'ios');
  const androidTokens = tokens.filter(t => t.platform === 'android');

  // Send to iOS devices
  if (iosTokens.length > 0) {
    const apn = require('apn');
    const provider = initializeAPNs();
    if (provider) {
      const apnNotification = new apn.Notification();
      apnNotification.alert = {
        title: notification.title,
        body: notification.body
      };
      apnNotification.topic = process.env.APNS_BUNDLE_ID || 'uofttri.club.app';
      apnNotification.payload = notification.data || {};
      apnNotification.sound = 'default';
      apnNotification.badge = 1;

      const iosTokenStrings = iosTokens.map(t => t.token);
      const result = await provider.send(apnNotification, iosTokenStrings);
      
      if (result.sent) results.sent += result.sent.length;
      if (result.failed) results.failed += result.failed.length;
    }
  }

  // Send to Android devices
  for (const tokenData of androidTokens) {
    const success = await sendFCMNotification(tokenData.token, notification);
    if (success) {
      results.sent++;
    } else {
      results.failed++;
    }
  }

  return results;
}

module.exports = {
  initializeFCM,
  initializeAPNs,
  sendPushNotification,
  sendBulkPushNotifications
};

