# Push Notification Testing Guide

## Current Status

✅ **Completed:**
- Push notification registration working on iPhone
- Device tokens being stored in database
- Backend push notification service implemented
- Test endpoint created at `/api/admin/test-push-notification`

## Next Steps to Test Real Push Notifications

### Step 1: Set Up APNs Credentials

To send real push notifications to your iPhone, you need to configure Apple Push Notification service (APNs):

1. **Get APNs Auth Key from Apple Developer Portal:**
   - Log in to [Apple Developer Portal](https://developer.apple.com/account/)
   - Go to **Certificates, Identifiers & Profiles** → **Keys**
   - Click **+** to create a new key
   - Name it: "UofT Triathlon Push Notifications"
   - Enable **Apple Push Notifications service (APNs)**
   - Download the `.p8` key file (⚠️ you can only download once!)
   - Note your **Key ID** and **Team ID**

2. **Place the Key File:**
   ```bash
   # Create config directory if it doesn't exist
   mkdir -p backend/config
   
   # Copy your downloaded .p8 file to backend/config/
   cp ~/Downloads/AuthKey_XXXXXXXXXX.p8 backend/config/
   ```

3. **Update Backend Environment Variables:**
   
   Add these to your `backend/.env` file:
   ```env
   APNS_KEY_PATH=./config/AuthKey_XXXXXXXXXX.p8
   APNS_KEY_ID=your_key_id_here
   APNS_TEAM_ID=your_team_id_here
   APNS_BUNDLE_ID=uofttri.club.app
   APNS_PRODUCTION=false  # Use false for development/testing
   ```

4. **Install APNs Package:**
   ```bash
   cd backend
   npm install apn
   ```

5. **Verify .gitignore:**
   
   Make sure `backend/.gitignore` includes:
   ```
   config/AuthKey_*.p8
   config/*.p8
   .env
   ```

### Step 2: Verify Your Device Token is Stored

Check that your iPhone's device token is in the database:

```sql
SELECT * FROM push_device_tokens WHERE platform = 'ios';
```

You should see your device token. If not:
1. Make sure you're logged into the app on your iPhone
2. Check backend logs for "📱 Push registration success, token: ..."
3. Verify the token was saved to the database

### Step 3: Test Push Notification via API

Once APNs is configured, you can test sending a push notification:

**Option A: Using curl**
```bash
curl -X POST http://localhost:5001/api/admin/test-push-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test push notification!"
  }'
```

**Option B: Using Postman or similar**
- Method: `POST`
- URL: `http://localhost:5001/api/admin/test-push-notification`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer YOUR_JWT_TOKEN`
- Body (JSON):
  ```json
  {
    "title": "Test Notification",
    "body": "This is a test push notification!"
  }
  ```

**Option C: Test to specific user**
```json
{
  "userId": 123,
  "title": "Test Notification",
  "body": "This is a test push notification!"
}
```

### Step 4: Check Backend Logs

When you send a test notification, watch your backend logs. You should see:

**If APNs is configured correctly:**
```
✅ APNs initialized
📱 Sending push notification to user X with Y device(s): { title: '...', body: '...' }
✅ APNs notification sent successfully
📱 Push notification results for user X: { sent: 1, failed: 0 }
```

**If APNs is NOT configured:**
```
⚠️ APNs not configured. Set APNS_KEY_PATH, APNS_KEY_ID, and APNS_TEAM_ID to enable iOS push notifications.
⚠️ APNs not initialized, skipping iOS notification
```

### Step 5: Verify Notification on Device

1. **Make sure your iPhone:**
   - Has internet connection
   - Has notification permissions enabled for the app
   - Is running the app (or in background - notifications work in both states)

2. **Check for the notification:**
   - If app is in foreground: You should see a local notification
   - If app is in background: You should see a push notification banner
   - If app is closed: You should see a push notification on the lock screen

### Step 6: Test Real-World Scenarios

Once basic push notifications work, test the actual app features that trigger notifications:

1. **Post a new workout** (if you have workout notification preferences enabled)
2. **Post a new event** (if you have event notification preferences enabled)
3. **Reply to a forum post** (if you have forum reply notifications enabled)
4. **Get promoted from waitlist** (if you have waitlist promotion notifications enabled)

## Troubleshooting

### "APNs not initialized"
- ✅ Check that all `APNS_*` environment variables are set in `backend/.env`
- ✅ Verify the `.p8` key file exists at the path specified in `APNS_KEY_PATH`
- ✅ Make sure the path is relative to the backend directory (e.g., `./config/AuthKey_XXX.p8`)
- ✅ Restart your backend server after adding environment variables

### "APNs key file not found"
- ✅ Double-check the file path in `APNS_KEY_PATH`
- ✅ Make sure the file was actually copied to `backend/config/`
- ✅ Verify the filename matches exactly (including the Key ID)

### "Invalid key" or authentication errors
- ✅ Verify Key ID and Team ID are correct
- ✅ Ensure the `.p8` file is the one you downloaded (not corrupted)
- ✅ Check that Push Notifications capability is enabled in Apple Developer Portal

### "Topic mismatch" error
- ✅ Verify `APNS_BUNDLE_ID` matches your app's bundle ID exactly: `uofttri.club.app`
- ✅ Check your `capacitor.config.ts` to confirm the bundle ID

### Notifications not received
- ✅ **Development vs Production**: 
  - Use `APNS_PRODUCTION=false` for development/Xcode builds
  - Use `APNS_PRODUCTION=true` for App Store/TestFlight builds
- ✅ Ensure your device has internet connection
- ✅ Check that notification permissions were granted in iOS Settings
- ✅ Verify the device token is stored in the database
- ✅ Check backend logs for any error messages
- ✅ Make sure you're testing on a physical device (not simulator)

### Token not registering
- ✅ Ensure Push Notifications capability is added in Xcode
- ✅ Check that user is logged in (registration happens on login)
- ✅ Verify backend is running and accessible
- ✅ Check console logs in Xcode for any errors

### Backend errors when sending
- ✅ Make sure `apn` package is installed: `npm install apn` in backend directory
- ✅ Check that all environment variables are loaded (restart server)
- ✅ Verify the `.p8` file permissions (should be readable)

## Next Steps After Testing

Once push notifications are working:

1. ✅ Test with different notification types (workouts, events, forum replies)
2. ✅ Test notification actions (tapping notification should navigate to relevant screen)
3. ✅ Set up FCM for Android (when ready)
4. ✅ Configure production APNs settings for App Store builds
5. ✅ Monitor notification delivery rates
6. ✅ Set up notification analytics (optional)

## Security Reminder

- ⚠️ **Never commit** your `.p8` key file to git
- ✅ Keep your Key ID and Team ID in `.env` (not committed)
- ✅ Rotate keys periodically for security
- ✅ Use different keys for development and production if needed

