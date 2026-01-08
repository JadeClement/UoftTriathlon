# iOS Push Notifications Setup Guide

This guide focuses exclusively on setting up Apple Push Notification service (APNs) for iOS devices.

## Prerequisites

- Active Apple Developer account ($99/year)
- iOS device for testing (push notifications don't work in simulator)
- Your app's bundle ID: `uofttri.club.app`

## Step 1: Create APNs Auth Key

1. Log in to [Apple Developer Portal](https://developer.apple.com/account/)
2. Go to **Certificates, Identifiers & Profiles**
3. Click **Keys** in the sidebar
4. Click the **+** button to create a new key
5. Enter a name: "UofT Triathlon Push Notifications"
6. Check **Apple Push Notifications service (APNs)**
7. Click **Continue** → **Register**
8. **⚠️ IMPORTANT**: Download the `.p8` key file immediately (you can only download it once!)
   - Save it as: `backend/config/AuthKey_XXXXXXXXXX.p8` (where X's are your Key ID)
   - The filename will be something like `AuthKey_ABC123DEF4.p8`
9. **Note down these values** (you'll need them for your `.env` file):
   - **Key ID**: Found in the key name (e.g., `ABC123DEF4`)
   - **Team ID**: Found at the top right of the Developer Portal (e.g., `XYZ789ABC1`)

## Step 2: Configure Your App ID

1. In Apple Developer Portal, still in **Certificates, Identifiers & Profiles**
2. Click **Identifiers** in the sidebar
3. Find your App ID: `uofttri.club.app` (or create it if it doesn't exist)
4. Click on it to edit
5. Ensure **Push Notifications** capability is checked/enabled
6. Click **Save**

## Step 3: Configure Xcode Project

1. Open your iOS project:
   ```bash
   npx cap open ios
   ```

2. In Xcode:
   - Select your project in the navigator (left sidebar)
   - Select your app target (should be "App")
   - Go to the **Signing & Capabilities** tab
   - Click **+ Capability**
   - Add **Push Notifications**
   - The Capacitor plugin will handle the rest automatically

3. Ensure your bundle identifier matches: `uofttri.club.app`

## Step 4: Install Backend Dependencies

In your terminal:

```bash
cd backend
npm install apn
```

## Step 5: Create Config Directory

```bash
mkdir -p backend/config
```

## Step 6: Place APNs Key File

Copy your downloaded `.p8` file to:
```
backend/config/AuthKey_XXXXXXXXXX.p8
```

**Example:**
```bash
cp ~/Downloads/AuthKey_ABC123DEF4.p8 backend/config/
```

## Step 7: Update Backend Environment Variables

Add these to your `backend/.env` file:

```env
# Apple Push Notification Service (APNs) Configuration
APNS_KEY_PATH=./config/AuthKey_XXXXXXXXXX.p8
APNS_KEY_ID=ABC123DEF4
APNS_TEAM_ID=XYZ789ABC1
APNS_BUNDLE_ID=uofttri.club.app
APNS_PRODUCTION=false
```

**Replace:**
- `AuthKey_XXXXXXXXXX.p8` with your actual key filename
- `ABC123DEF4` with your actual Key ID
- `XYZ789ABC1` with your actual Team ID
- Set `APNS_PRODUCTION=true` only when building for App Store/TestFlight

## Step 8: Verify .gitignore

Make sure `backend/.gitignore` includes (it should already):
```
config/AuthKey_*.p8
config/*.p8
```

This prevents accidentally committing your APNs key to git!

## Step 9: Test Push Notifications

### On Your Device:

1. **Build and run on a physical iOS device** (not simulator):
   ```bash
   # Build your React app first
   npm run build
   
   # Sync Capacitor
   npx cap sync
   
   # Open in Xcode
   npx cap open ios
   ```
   
   Then in Xcode, select your device and click Run.

2. **Log in to the app** - Push notification registration happens automatically on login

3. **Check backend logs** - You should see:
   ```
   ✅ APNs initialized
   📱 Push registration success, token: <long_token_string>
   ```

4. **Verify token is stored** - Check your database:
   ```sql
   SELECT * FROM push_device_tokens WHERE platform = 'ios';
   ```
   You should see your device token stored.

5. **Test sending a notification** - Post a new workout or event (if you have notification preferences enabled), and you should receive a push notification!

## Troubleshooting

### "APNs not initialized"
- Check that all `APNS_*` environment variables are set in `.env`
- Verify the key file path is correct (relative to backend directory)
- Ensure the `.p8` file exists at the specified path

### "APNs key file not found"
- Double-check the file path in `APNS_KEY_PATH`
- Make sure the file was actually copied to `backend/config/`
- Path should be relative: `./config/AuthKey_XXXXXXXXXX.p8`

### "Invalid key" or authentication errors
- Verify Key ID and Team ID are correct
- Ensure the `.p8` file is the one you downloaded (not corrupted)
- Check that Push Notifications capability is enabled in Apple Developer Portal

### "Topic mismatch" error
- Verify `APNS_BUNDLE_ID` matches your app's bundle ID exactly
- Should be: `uofttri.club.app`

### Notifications not received
- **Development vs Production**: 
  - Use `APNS_PRODUCTION=false` for development/Xcode builds
  - Use `APNS_PRODUCTION=true` for App Store/TestFlight builds
- Ensure your device has internet connection
- Check that notification permissions were granted in iOS Settings
- Verify the device token is stored in the database
- Check backend logs for any error messages

### Token not registering
- Ensure Push Notifications capability is added in Xcode
- Check that user is logged in (registration happens on login)
- Verify backend is running and accessible
- Check console logs in Xcode for any errors

## Next Steps

Once iOS push notifications are working:

1. ✅ Test with different notification types (workouts, events, forum replies)
2. ✅ Test notification actions (tapping notification should navigate to relevant screen)
3. ✅ Set up FCM for Android (when ready)
4. ✅ Configure production APNs settings for App Store builds

## Security Reminder

- ⚠️ **Never commit** your `.p8` key file to git
- ✅ Keep your Key ID and Team ID in `.env` (not committed)
- ✅ Rotate keys periodically for security
- ✅ Use different keys for development and production if needed









