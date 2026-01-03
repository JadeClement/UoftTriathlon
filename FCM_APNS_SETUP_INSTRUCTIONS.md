# FCM & APNs Setup Instructions

This guide will walk you through setting up Firebase Cloud Messaging (FCM) for Android and Apple Push Notification service (APNs) for iOS push notifications.

## Overview

- **FCM (Firebase Cloud Messaging)**: Google's service for sending push notifications to Android devices
- **APNs (Apple Push Notification service)**: Apple's service for sending push notifications to iOS devices

Both services require accounts and credentials to be set up before push notifications will work.

---

## Part 1: Firebase Setup (Android - FCM)

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter project name (e.g., "UofT Triathlon")
   - Enable/disable Google Analytics (optional)
   - Create project

### Step 2: Add Android App to Firebase

1. In Firebase Console, click the Android icon (or "Add app" > Android)
2. Enter package name: `uofttri.club.app` (should match your `capacitor.config.ts`)
3. Enter app nickname (optional): "UofT Triathlon Android"
4. Enter SHA-1 certificate fingerprint (optional for now, needed for production)
5. Click "Register app"

### Step 3: Download google-services.json

1. Download `google-services.json`
2. Place it in: `android/app/google-services.json`
3. **Important**: This file will be automatically included when you run `npx cap sync`

### Step 4: Get FCM Credentials

You have two options:

#### Option A: Service Account (Recommended - More Secure)

1. In Firebase Console, go to Project Settings (gear icon) > Service Accounts
2. Click "Generate new private key"
3. Save the JSON file as `backend/config/firebase-service-account.json`
4. **DO NOT commit this file to git!** Add it to `.gitignore`

#### Option B: Server Key (Legacy - Simpler but Less Secure)

1. In Firebase Console, go to Project Settings > Cloud Messaging
2. Find "Server key" under "Cloud Messaging API (Legacy)"
3. Copy the key (you'll add it to your `.env` file)

### Step 5: Enable Cloud Messaging API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to "APIs & Services" > "Library"
4. Search for "Firebase Cloud Messaging API"
5. Click "Enable"

---

## Part 2: Apple Push Notification Setup (iOS - APNs)

### Step 1: Apple Developer Account

You need an active Apple Developer account ($99/year). If you don't have one:
- Sign up at [developer.apple.com](https://developer.apple.com/programs/)
- Wait for approval (usually instant for individuals)

### Step 2: Create APNs Auth Key

1. Log in to [Apple Developer Portal](https://developer.apple.com/account/)
2. Go to "Certificates, Identifiers & Profiles"
3. Click "Keys" in the sidebar
4. Click the "+" button to create a new key
5. Enter a name: "UofT Triathlon Push Notifications"
6. Check "Apple Push Notifications service (APNs)"
7. Click "Continue" > "Register"
8. **IMPORTANT**: Download the `.p8` key file immediately (you can only download it once!)
9. Save it as: `backend/config/AuthKey_XXXXXXXXXX.p8` (where X's are your Key ID)
10. Note down:
    - **Key ID**: Found in the key name (e.g., `A1B2C3D4E5`)
    - **Team ID**: Found at the top right of the Developer Portal (e.g., `ABC123DEF4`)

### Step 3: Configure App ID

1. In Apple Developer Portal, go to "Identifiers"
2. Find your App ID (or create one): `uofttri.club.app`
3. Ensure "Push Notifications" capability is enabled
4. Click "Save"

### Step 4: Configure Xcode Project

1. Open your iOS project: `npx cap open ios`
2. In Xcode, select your project in the navigator
3. Select your app target
4. Go to "Signing & Capabilities" tab
5. Click "+ Capability"
6. Add "Push Notifications"
7. The Capacitor plugin should handle the rest

---

## Part 3: Backend Configuration

### Step 1: Install Backend Dependencies

Run in your terminal:

```bash
cd backend
npm install firebase-admin apn
```

### Step 2: Create Config Directory

```bash
mkdir -p backend/config
```

### Step 3: Add Files to .gitignore

Add to `backend/.gitignore`:

```
config/
.env
firebase-service-account.json
AuthKey_*.p8
```

### Step 4: Configure Environment Variables

Add to your `backend/.env` file:

#### For FCM (choose one option):

**Option A - Service Account (Recommended):**
```env
FCM_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
```

**Option B - Server Key (Legacy):**
```env
FCM_SERVER_KEY=your_fcm_server_key_here
```

#### For APNs (required for iOS):
```env
APNS_KEY_PATH=./config/AuthKey_XXXXXXXXXX.p8
APNS_KEY_ID=your_key_id_here
APNS_TEAM_ID=your_team_id_here
APNS_BUNDLE_ID=uofttri.club.app
APNS_PRODUCTION=false  # Set to true for production App Store builds
```

### Step 5: Place Credential Files

1. Copy `firebase-service-account.json` to `backend/config/`
2. Copy your APNs `.p8` key file to `backend/config/AuthKey_XXXXXXXXXX.p8`

---

## Part 4: Frontend Configuration

### Step 1: Install Capacitor Plugins

```bash
npm install @capacitor/push-notifications @capacitor/local-notifications
npx cap sync
```

### Step 2: Verify Integration

The push notification service is already integrated into `AuthContext.js`, so it will:
- Request permissions when user logs in
- Register device tokens automatically
- Send tokens to backend

---

## Part 5: Testing

### Test on Android:

1. Build and run on a physical Android device (not emulator - push doesn't work in emulators)
2. Log in to the app
3. Check backend logs for: "📱 Push registration success, token: ..."
4. Check database: `SELECT * FROM push_device_tokens WHERE platform = 'android';`
5. Send a test notification via Firebase Console > Cloud Messaging > Send test message

### Test on iOS:

1. Build and run on a physical iOS device (not simulator)
2. Ensure you're using a development build (not TestFlight/App Store)
3. Log in to the app
4. Check backend logs for: "📱 Push registration success, token: ..."
5. Check database: `SELECT * FROM push_device_tokens WHERE platform = 'ios';`
6. Test notifications by triggering them from your backend (e.g., posting a workout)

---

## Troubleshooting

### FCM Issues:

- **"FCM not initialized"**: Check that `FCM_SERVICE_ACCOUNT_PATH` or `FCM_SERVER_KEY` is set correctly
- **"Permission denied"**: Ensure `google-services.json` is in `android/app/`
- **Token not registering**: Verify Cloud Messaging API is enabled in Google Cloud Console

### APNs Issues:

- **"APNs not initialized"**: Check that all APNS_* environment variables are set
- **"Invalid key"**: Ensure the `.p8` file path is correct and file exists
- **"Topic mismatch"**: Ensure `APNS_BUNDLE_ID` matches your app's bundle ID
- **Notifications not received**: 
  - Development vs Production: Use `APNS_PRODUCTION=false` for development builds
  - Check that Push Notifications capability is enabled in Xcode

### General Issues:

- **No device tokens**: User must be logged in and grant notification permissions
- **Backend errors**: Check that all npm packages are installed (`npm install` in backend directory)
- **Database errors**: Ensure `push_device_tokens` table was created (runs automatically on server start)

---

## Next Steps

Once setup is complete:

1. ✅ Test push notifications end-to-end
2. ✅ Monitor delivery rates and errors
3. ✅ Set up notification analytics (optional)
4. ✅ Implement rich notifications (images, action buttons) if needed
5. ✅ Handle notification actions (deep linking) - already partially implemented in `pushNotificationService.js`

---

## Security Notes

- **Never commit** `.p8` files, `firebase-service-account.json`, or `.env` files to git
- Store production credentials securely (use environment variables on your hosting platform)
- Rotate keys periodically for security
- Use service account (not server key) for FCM in production



