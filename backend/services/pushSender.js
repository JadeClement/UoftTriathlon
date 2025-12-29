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
  // Check if provider needs to be re-initialized (e.g., if production setting changed)
  const currentProduction = process.env.APNS_PRODUCTION === 'true';
  if (apnProvider && apnProvider._production === currentProduction) {
    return apnProvider; // Already initialized with correct settings
  }
  
  // Reset provider if settings changed
  if (apnProvider) {
    console.log('🔄 APNs provider settings changed, re-initializing...');
    apnProvider = null;
  }

  try {
    // Check if APNs is configured
    // Support both file path (local) and base64 encoded key (production/Vercel)
    const hasKeyPath = process.env.APNS_KEY_PATH;
    const hasKeyBase64 = process.env.APNS_KEY_BASE64;
    const hasKeyId = process.env.APNS_KEY_ID;
    const hasTeamId = process.env.APNS_TEAM_ID;
    
    // Debug logging
    console.log('📱 APNs config check:', {
      hasKeyPath: !!hasKeyPath,
      hasKeyBase64: !!hasKeyBase64,
      hasKeyId: !!hasKeyId,
      hasTeamId: !!hasTeamId,
      keyId: hasKeyId,
      teamId: hasTeamId
    });
    
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
      
      // Trim whitespace from key ID and team ID (in case of copy/paste issues)
      const keyId = (process.env.APNS_KEY_ID || '').trim();
      const teamId = (process.env.APNS_TEAM_ID || '').trim();
      const bundleId = (process.env.APNS_BUNDLE_ID || 'uofttri.club.app').trim();
      
      // IMPORTANT: For development/testing, explicitly set APNS_PRODUCTION=false
      // Development builds from Xcode generate tokens for the development APNs gateway
      // Production builds (App Store/TestFlight) generate tokens for the production APNs gateway
      // These are NOT interchangeable - using the wrong gateway causes BadDeviceToken errors
      const isProduction = process.env.APNS_PRODUCTION === 'true';
      const nodeEnv = process.env.NODE_ENV;
      
      console.log('📱 APNs provider config:', {
        keyId: keyId,
        teamId: teamId,
        bundleId: bundleId,
        production: isProduction,
        nodeEnv: nodeEnv,
        apnsProductionEnv: process.env.APNS_PRODUCTION,
        keyLength: key.length,
        note: isProduction ? 'Using PRODUCTION APNs gateway (for App Store/TestFlight builds)' : 'Using DEVELOPMENT APNs gateway (for Xcode builds)'
      });
      
      apnProvider = new apn.Provider({
        token: {
          key: key,
          keyId: keyId,
          teamId: teamId
        },
        production: isProduction
      });
      
      // Store production setting for comparison
      apnProvider._production = isProduction;
      
      console.log('✅ APNs initialized with settings:', {
        production: isProduction,
        bundleId: bundleId,
        keyId: keyId,
        teamId: teamId
      });
      
      // Verify the provider was created correctly
      if (!apnProvider) {
        console.error('❌ Failed to create APNs provider');
        return null;
      }
      
      return apnProvider;
    } else {
      console.log('⚠️ APNs not configured. Missing:');
      if (!hasKeyPath && !hasKeyBase64) {
        console.log('   - APNS_KEY_PATH (local) or APNS_KEY_BASE64 (production)');
      }
      if (!hasKeyId) {
        console.log('   - APNS_KEY_ID');
      }
      if (!hasTeamId) {
        console.log('   - APNS_TEAM_ID');
      }
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

    // Validate and clean token
    if (!token || typeof token !== 'string') {
      console.error('❌ Invalid token type:', typeof token);
      return false;
    }
    
    // Remove any whitespace and convert to lowercase (iOS tokens are hex)
    const cleanToken = token.trim().toLowerCase();
    
    // iOS device tokens should be 64 hex characters
    if (cleanToken.length !== 64) {
      console.error(`❌ Invalid token length: ${cleanToken.length} (expected 64). Token: ${cleanToken.substring(0, 20)}...`);
      return false;
    }
    
    // Validate it's hex
    if (!/^[0-9a-f]{64}$/.test(cleanToken)) {
      console.error(`❌ Token contains invalid characters (not hex). Token: ${cleanToken.substring(0, 20)}...`);
      return false;
    }

    const bundleId = (process.env.APNS_BUNDLE_ID || 'uofttri.club.app').trim();
    
    const apnNotification = new apn.Notification();
    apnNotification.alert = {
      title: notification.title,
      body: notification.body
    };
    apnNotification.topic = bundleId;
    apnNotification.payload = notification.data || {};
    apnNotification.sound = 'default';
    apnNotification.badge = 1;
    apnNotification.pushType = 'alert';

    console.log('📱 Sending APNs notification:', {
      topic: bundleId,
      token: cleanToken.substring(0, 32) + '...',
      tokenLength: cleanToken.length,
      tokenFull: cleanToken, // Log full token for debugging
      title: notification.title
    });

    const result = await provider.send(apnNotification, cleanToken);
    
    if (result.sent && result.sent.length > 0) {
      console.log('✅ APNs notification sent successfully to', result.sent.length, 'device(s)');
      return true;
    } else if (result.failed && result.failed.length > 0) {
      console.error('❌ APNs notification failed:', result.failed.length, 'failure(s)');
      result.failed.forEach((failure, index) => {
        console.error(`❌ Failure ${index + 1}:`, {
          device: failure.device,
          error: failure.error,
          status: failure.status,
          response: failure.response
        });
      });
      return false;
    }

    console.log('⚠️ APNs send returned no sent or failed results');
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
      const bundleId = (process.env.APNS_BUNDLE_ID || 'uofttri.club.app').trim();
      const apnNotification = new apn.Notification();
      apnNotification.alert = {
        title: notification.title,
        body: notification.body
      };
      apnNotification.topic = bundleId;
      apnNotification.payload = notification.data || {};
      apnNotification.sound = 'default';
      apnNotification.badge = 1;
      apnNotification.pushType = 'alert';

      // Clean and validate tokens
      const iosTokenStrings = iosTokens.map((t, index) => {
        console.log(`🔍 Processing token ${index + 1} from database:`, {
          rawType: typeof t.token,
          rawValue: t.token,
          rawLength: t.token ? t.token.length : 0,
          hasSpaces: t.token ? t.token.includes(' ') : false,
          hasDashes: t.token ? t.token.includes('-') : false
        });
        
        if (!t.token || typeof t.token !== 'string') {
          console.error('❌ Invalid token type in database:', typeof t.token);
          return null;
        }
        
        // Remove spaces, dashes, and convert to lowercase
        // Some systems store tokens with dashes or spaces
        let clean = t.token.replace(/[\s-]/g, '').toLowerCase();
        
        console.log(`🔍 After cleaning token ${index + 1}:`, {
          cleaned: clean,
          length: clean.length,
          isHex: /^[0-9a-f]+$/.test(clean),
          isValid: clean.length === 64 && /^[0-9a-f]{64}$/.test(clean)
        });
        
        if (clean.length !== 64 || !/^[0-9a-f]{64}$/.test(clean)) {
          console.error(`❌ Invalid token format after cleaning: length=${clean.length}, token=${clean.substring(0, 20)}...`);
          console.error(`   Original token was: ${t.token}`);
          return null;
        }
        return clean;
      }).filter(t => t !== null);
      
      if (iosTokenStrings.length === 0) {
        console.error('❌ No valid iOS tokens to send to');
        results.failed += iosTokens.length;
        return results;
      }
      
      const isProduction = process.env.APNS_PRODUCTION === 'true';
      console.log(`📱 Sending APNs notification to ${iosTokenStrings.length} iOS device(s), topic: ${bundleId}, production: ${isProduction}`);
      console.log(`📱 Token sample: ${iosTokenStrings[0]?.substring(0, 32)}... (full: ${iosTokenStrings[0]})`);
      
      console.log('📱 Calling provider.send()...');
      const result = await provider.send(apnNotification, iosTokenStrings);
      console.log('📱 provider.send() completed, result received');
      
      // Log the full result structure for debugging
      console.log('📱 APNs send result structure:', {
        hasResult: !!result,
        resultType: typeof result,
        isArray: Array.isArray(result),
        resultKeys: result && typeof result === 'object' ? Object.keys(result) : 'N/A',
        sentCount: result?.sent?.length || 0,
        failedCount: result?.failed?.length || 0,
        sentType: result?.sent ? typeof result.sent : 'N/A',
        failedType: result?.failed ? typeof result.failed : 'N/A'
      });
      
      // The apn library might return results in different formats
      // Try to extract sent/failed arrays
      let sentArray = [];
      let failedArray = [];
      
      if (result) {
        if (Array.isArray(result.sent)) {
          sentArray = result.sent;
        } else if (result.sent && typeof result.sent === 'object') {
          // Might be a Set or other collection
          sentArray = Array.from(result.sent);
        }
        
        if (Array.isArray(result.failed)) {
          failedArray = result.failed;
        } else if (result.failed && typeof result.failed === 'object') {
          failedArray = Array.from(result.failed);
        }
      }
      
      console.log('📱 Extracted arrays:', {
        sentArrayLength: sentArray.length,
        failedArrayLength: failedArray.length
      });
      
      // Wait a bit for async responses (APNs uses HTTP/2 and responses may be delayed)
      console.log('📱 Waiting 2 seconds for async APNs responses...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check again after delay - the arrays might have been populated
      const finalSent = result?.sent ? (Array.isArray(result.sent) ? result.sent : Array.from(result.sent)) : [];
      const finalFailed = result?.failed ? (Array.isArray(result.failed) ? result.failed : Array.from(result.failed)) : [];
      
      console.log('📱 APNs final result after delay:', {
        sentCount: finalSent.length,
        failedCount: finalFailed.length,
        resultKeys: result ? Object.keys(result) : []
      });
      
      if (finalSent.length > 0) {
        console.log(`✅ APNs: Successfully sent to ${finalSent.length} device(s)`);
        finalSent.forEach((device, index) => {
          const deviceToken = typeof device === 'string' ? device : (device?.device || device?.token || String(device));
          console.log(`   ✅ Device ${index + 1}: ${deviceToken.substring(0, 32)}...`);
        });
        results.sent += finalSent.length;
      }
      
      if (finalFailed.length > 0) {
        console.error(`❌ APNs: Failed to send to ${finalFailed.length} device(s)`);
        finalFailed.forEach((failure, index) => {
          const errorReason = failure.response?.reason || failure.error?.message || failure.error || 'Unknown error';
          console.error(`❌ APNs Failure ${index + 1}:`, {
            device: failure.device ? failure.device.substring(0, 32) + '...' : 'unknown',
            deviceFull: failure.device, // Log full token for debugging
            error: failure.error,
            status: failure.status,
            reason: errorReason,
            response: failure.response,
            fullFailure: JSON.stringify(failure, null, 2)
          });
          
          // Provide helpful error messages
          if (errorReason === 'BadDeviceToken') {
            console.error('💡 BadDeviceToken troubleshooting:');
            console.error('   1. Verify APNS_PRODUCTION matches your build type (false for Xcode, true for App Store)');
            console.error('   2. Check that the APNs key has "Apple Push Notifications service (APNs)" enabled in Apple Developer Portal');
            console.error('   3. Verify the bundle ID (uofttri.club.app) is registered for push notifications');
            console.error('   4. Ensure the device token is from the same app/bundle ID');
            console.error('   5. Try deleting the token from database and getting a fresh one');
          }
        });
        results.failed += finalFailed.length;
      }
      
      // If no sent or failed, log warning
      if (finalSent.length === 0 && finalFailed.length === 0) {
        console.warn('⚠️ APNs: No sent or failed results in response. This might indicate:');
        console.warn('   1. The notification is still being processed (check device)');
        console.warn('   2. The APNs connection was closed before response');
        console.warn('   3. The result structure is different than expected');
        console.warn('   4. The notification was sent but APNs hasn\'t responded yet');
        console.warn('   Full result object:', result);
        console.warn('   Result keys:', result ? Object.keys(result) : 'null');
        console.warn('   Result type:', typeof result);
        
        // Assume success if no errors (APNs might not always return immediate feedback)
        console.warn('   ⚠️ Assuming notification was sent (no error response received)');
        results.sent += iosTokenStrings.length;
      }
    } else {
      console.log('⚠️ APNs provider not initialized, skipping iOS notifications');
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

