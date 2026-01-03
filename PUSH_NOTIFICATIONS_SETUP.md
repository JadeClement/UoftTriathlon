# Push Notifications Setup Guide

This guide explains how to complete the push notifications setup for the Capacitor mobile app.

## Current Status

✅ **Completed:**
- Push notification service created (`src/services/pushNotificationService.js`)
- Push notifications integrated with AuthContext (auto-register on login, unregister on logout)
- Backend endpoints created for storing/deleting device tokens
- Database schema updated with `push_device_tokens` table
- Notification service updated to send push notifications

⏳ **Remaining Setup:**
- Install Capacitor push notification plugins (run `npm install @capacitor/push-notifications @capacitor/local-notifications`)
- Configure Firebase Cloud Messaging (FCM) for Android
- Configure Apple Push Notification service (APNs) for iOS
- Implement actual FCM/APNs sending logic in `backend/services/notificationService.js`

## Step 1: Install Packages

If you haven't already, install the Capacitor push notification plugins:

```bash
npm install @capacitor/push-notifications @capacitor/local-notifications
npx cap sync
```

## Step 2: iOS Setup (APNs)

### 2.1 Apple Developer Account
1. Log in to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to Certificates, Identifiers & Profiles
3. Create an App ID for your app (if not already created)
4. Enable Push Notifications capability for your App ID

### 2.2 Create APNs Key
1. In Apple Developer Portal, go to Keys section
2. Click "+" to create a new key
3. Enable "Apple Push Notifications service (APNs)"
4. Download the `.p8` key file (you can only download once!)
5. Note the Key ID and Team ID

### 2.3 Configure Xcode Project
1. Open your iOS project: `npx cap open ios`
2. In Xcode, go to Signing & Capabilities
3. Add "Push Notifications" capability
4. The Capacitor plugin should handle the rest

### 2.4 Update Backend
Add APNs credentials to your environment variables:

```env
APNS_KEY_ID=your_key_id
APNS_TEAM_ID=your_team_id
APNS_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
APNS_BUNDLE_ID=uofttri.club.app
APNS_PRODUCTION=true  # false for development
```

Install APNs npm package:
```bash
npm install apn
```

## Step 3: Android Setup (FCM)

### 3.1 Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing one
3. Add Android app to your Firebase project
4. Download `google-services.json`
5. Place it in `android/app/` directory

### 3.2 Firebase Cloud Messaging
1. In Firebase Console, go to Project Settings > Cloud Messaging
2. Copy the Server Key (for legacy API) or create a service account (recommended)
3. Enable Cloud Messaging API in Google Cloud Console

### 3.3 Update Android Project
1. Open your Android project: `npx cap open android`
2. Add Firebase dependencies (usually handled by Capacitor plugin)
3. Sync: `npx cap sync`

### 3.4 Update Backend
Add FCM credentials to your environment variables:

```env
FCM_SERVER_KEY=your_fcm_server_key
# OR for service account (recommended):
FCM_SERVICE_ACCOUNT_PATH=/path/to/service-account-key.json
```

Install FCM Admin SDK:
```bash
npm install firebase-admin
```

## Step 4: Implement Push Sending Logic

Update `backend/services/notificationService.js` to implement actual push sending:

### For iOS (APNs):
```javascript
const apn = require('apn');

// Initialize APNs provider
const apnProvider = new apn.Provider({
  token: {
    key: process.env.APNS_KEY_PATH,
    keyId: process.env.APNS_KEY_ID,
    teamId: process.env.APNS_TEAM_ID
  },
  production: process.env.APNS_PRODUCTION === 'true'
});

// In sendPushNotification function:
const iosTokens = tokens.filter(t => t.platform === 'ios').map(t => t.token);
if (iosTokens.length > 0) {
  const note = new apn.Notification();
  note.alert = { title: notification.title, body: notification.body };
  note.topic = process.env.APNS_BUNDLE_ID;
  note.payload = notification.data;
  note.sound = 'default';
  
  apnProvider.send(note, iosTokens).then((result) => {
    console.log('✅ APNs send result:', result);
  });
}
```

### For Android (FCM):
```javascript
const admin = require('firebase-admin');

// Initialize FCM
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(process.env.FCM_SERVICE_ACCOUNT_PATH))
  });
}

// In sendPushNotification function:
const androidTokens = tokens.filter(t => t.platform === 'android').map(t => t.token);
if (androidTokens.length > 0) {
  const message = {
    notification: {
      title: notification.title,
      body: notification.body
    },
    data: notification.data,
    tokens: androidTokens
  };
  
  admin.messaging().sendMulticast(message).then((response) => {
    console.log('✅ FCM send result:', response);
  });
}
```

## Step 5: Test Push Notifications

1. Build and run the app on a physical device (push notifications don't work in simulators/emulators)
2. Log in to the app
3. Check console logs - you should see "📱 Push registration success, token: ..."
4. Send a test notification from the backend or use a tool like Postman
5. Verify notification appears on device

## Testing Endpoints

### Test device token storage:
```bash
POST /api/users/push-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "test_token_123",
  "platform": "ios"
}
```

### Test notification sending (manual):
You can manually trigger a notification by calling the notification service functions in your backend code or via an admin endpoint.

## Troubleshooting

### iOS Issues:
- **Token not registering**: Make sure Push Notifications capability is enabled in Xcode
- **Notifications not received**: Check APNs credentials, ensure app is built with correct bundle ID
- **Development vs Production**: Use development APNs for debug builds, production for App Store builds

### Android Issues:
- **Token not registering**: Ensure `google-services.json` is in the correct location
- **Notifications not received**: Check FCM server key, verify device has Google Play Services
- **Build errors**: Make sure Firebase dependencies are properly added

### General Issues:
- **No device tokens**: Make sure user is logged in and app has notification permissions
- **Backend errors**: Check environment variables are set correctly
- **Token deletion**: Old/invalid tokens should be automatically cleaned up

## Next Steps

After completing the setup:
1. Test push notifications end-to-end
2. Monitor notification delivery rates
3. Set up notification analytics (optional)
4. Implement notification action handling (deep linking)
5. Add rich notifications (images, action buttons) if needed



