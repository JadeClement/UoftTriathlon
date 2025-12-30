# TestFlight Deployment Guide

This guide will walk you through deploying your iOS app to TestFlight for beta testing before App Store release.

## Prerequisites

- ✅ Active Apple Developer account ($99/year)
- ✅ App Store Connect access (same Apple ID as Developer account)
- ✅ Xcode installed (latest version recommended)
- ✅ Your app configured with bundle ID: `uofttri.club.app`
- ✅ All development features tested and working

## Step 1: Prepare App Store Connect

### 1.1 Create App in App Store Connect

1. Log in to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **My Apps** → **+** (Create New App)
3. Fill in the details:
   - **Platform**: iOS
   - **Name**: University of Toronto Triathlon Team (or your preferred name)
   - **Primary Language**: English
   - **Bundle ID**: Select `uofttri.club.app` (must match your Xcode project)
   - **SKU**: `uoft-tri-club-app` (unique identifier, can be anything)
   - **User Access**: Full Access (or Restricted Access if using multiple accounts)
4. Click **Create**

### 1.2 Complete App Information (Optional for TestFlight)

You can complete this later, but it's good to start:
- App description
- Keywords
- Support URL (your website)
- Marketing URL (optional)
- Privacy Policy URL (required for App Store submission)
- Screenshots (required for App Store, optional for TestFlight)

## Step 2: Update Version and Build Numbers

### 2.1 Set Version in Xcode

1. Open your iOS project in Xcode:
   ```bash
   npx cap open ios
   ```

2. In Xcode:
   - Select your project in the navigator (left sidebar)
   - Select the **App** target
   - Go to the **General** tab
   - Set **Version** (e.g., `1.0.0`) - This is the user-facing version
   - Set **Build** (e.g., `1`) - Increment this for each upload to TestFlight/App Store

### 2.2 Set Production APNs Environment

⚠️ **IMPORTANT**: For TestFlight and App Store builds, you need to use the **production** APNs gateway.

1. Update your backend environment variables (if not already set):
   ```env
   APNS_PRODUCTION=true  # Set to true for TestFlight/App Store builds
   ```

2. Note: The app will need to be rebuilt with production certificates to use the production APNs gateway.

## Step 3: Configure Signing & Capabilities

### 3.1 Set Up Distribution Signing

1. In Xcode, with your project selected:
   - Go to **Signing & Capabilities** tab
   - Under **Signing**:
     - ✅ Check **Automatically manage signing**
     - Select your **Team** (your Apple Developer account)
   - Xcode will automatically create/select the correct provisioning profiles

2. Verify Bundle Identifier:
   - Should be: `uofttri.club.app`
   - Make sure it matches App Store Connect

### 3.2 Verify Capabilities

Ensure these capabilities are enabled:
- ✅ Push Notifications (required for push notifications)
- Any other capabilities your app uses

## Step 4: Update Production API URL (If Needed)

If your backend is ready for production, update the Capacitor config:

1. Edit `capacitor.config.ts`:
   ```typescript
   const config: CapacitorConfig = {
     appId: 'uofttri.club.app',
     appName: 'University of Toronto Triathlon Team',
     webDir: 'build',
     server: {
       url: 'https://www.uoft-tri.club',  // Uncomment and set your production URL
       cleartext: false
     },
     // ... rest of config
   };
   ```

2. Sync Capacitor:
   ```bash
   npm run build
   npx cap sync ios
   ```

## Step 5: Build and Archive

### 5.1 Build Your React App

```bash
# Make sure you're in the project root
npm run build
```

### 5.2 Sync with Capacitor

```bash
npx cap sync ios
```

### 5.3 Create Archive in Xcode

1. Open Xcode:
   ```bash
   npx cap open ios
   ```

2. Select a **Generic iOS Device** as the build destination (not a simulator or specific device)
   - Top toolbar → Select destination → **Any iOS Device**

3. Create Archive:
   - Menu: **Product** → **Archive**
   - Wait for the build to complete (this may take several minutes)

4. If you get signing errors:
   - Check your Team selection in Signing & Capabilities
   - Ensure your Apple Developer account has proper permissions
   - Make sure your bundle ID matches App Store Connect

## Step 6: Upload to App Store Connect

### 6.1 Distribute Archive

Once the archive is created:

1. The **Organizer** window should open automatically
   - If not, go to: **Window** → **Organizer**

2. Select your archive (most recent one)

3. Click **Distribute App**

4. Choose distribution method:
   - Select **App Store Connect**
   - Click **Next**

5. Select distribution options:
   - **Upload**: Select this (you'll distribute via TestFlight)
   - Click **Next**

6. Select distribution options:
   - ✅ **Upload your app's symbols** (recommended for crash reporting)
   - ✅ **Manage Version and Build Number** (if you want Xcode to manage it)
   - Click **Next**

7. Review signing:
   - Usually: **Automatically manage signing** (Xcode will handle it)
   - Click **Next**

8. Review and upload:
   - Review the summary
   - Click **Upload**
   - Wait for the upload to complete (this may take 10-30 minutes)

9. Click **Done** when upload completes

## Step 7: Process Build in App Store Connect

### 7.1 Wait for Processing

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to **My Apps** → Your App
3. Click the **TestFlight** tab
4. Under **iOS Builds**, you should see your uploaded build
5. It will show status: **Processing** (usually takes 10-30 minutes)

### 7.2 Handle Processing Issues (If Any)

If processing fails:
- Check the build details for error messages
- Common issues:
  - Missing export compliance information
  - Invalid provisioning profiles
  - Missing required capabilities
- Fix issues and re-upload

## Step 8: Set Up TestFlight

### 8.1 Add Test Information

1. In App Store Connect, go to **TestFlight** tab
2. Under **Test Information**, click **Add Test Information** (first time only)
3. Fill in:
   - **Beta App Description**: Brief description for testers
   - **Feedback Email**: Email address for tester feedback
   - **Marketing URL** (optional)
   - **Privacy Policy URL** (required if you collect user data)

### 8.2 Add Internal Testers

Internal testers are members of your App Store Connect team:

1. Go to **TestFlight** → **Internal Testing**
2. Click **+** to create a test group (or use default)
3. Add testers:
   - Click **Add Testers**
   - Select team members from your organization
   - Or add by email (they must have App Store Connect access)

4. Select the build to test:
   - Check the build you want to test
   - Click **Start Testing**

5. Testers will receive an email invitation

### 8.3 Add External Testers (Optional)

External testers don't need App Store Connect access:

1. Go to **TestFlight** → **External Testing**
2. Click **+** to create a test group
3. Add testers:
   - Enter email addresses (up to 10,000 testers)
   - Or create a public link

4. Apple Review (first time only):
   - External test builds must be reviewed by Apple (usually 24-48 hours)
   - Your app must meet App Store guidelines
   - Submit for review when ready

5. Once approved, select the build and start testing

## Step 9: Test Your App

### 9.1 For Testers

1. Install TestFlight app from the App Store (if not already installed)
2. Accept the invitation email (tap the link)
3. Or open the TestFlight app and the invitation will appear
4. Tap **Install** to download your beta app
5. Launch and test the app

### 9.2 Gather Feedback

Testers can:
- Submit feedback through TestFlight
- Report bugs with screenshots
- Rate the build
- Send feedback emails

You can view feedback in App Store Connect under the TestFlight section.

## Step 10: Important Notes for Production

### 10.1 APNs Production Gateway

⚠️ **CRITICAL**: When uploading to TestFlight/App Store:
- Device tokens generated by TestFlight/App Store builds are for the **production** APNs gateway
- Your backend must use `APNS_PRODUCTION=true`
- Development builds (from Xcode) use the development gateway and won't work with production tokens

### 10.2 Update Backend Environment

Make sure your production backend has:
```env
APNS_PRODUCTION=true
APNS_KEY_BASE64=<your_base64_encoded_key>  # For Vercel/production
APNS_KEY_ID=<your_key_id>
APNS_TEAM_ID=<your_team_id>
APNS_BUNDLE_ID=uofttri.club.app
```

### 10.3 Testing Push Notifications

After uploading to TestFlight:
1. Install the app via TestFlight on a physical device
2. Log in to the app
3. The app will register with the **production** APNs gateway
4. Test push notifications from your production backend
5. Make sure `APNS_PRODUCTION=true` is set in production

## Step 11: Next Steps - App Store Submission

Once TestFlight testing is complete:

1. Go to **App Store Connect** → Your App → **App Store** tab
2. Complete all required information:
   - App description
   - Screenshots (all required sizes)
   - Keywords
   - Support URL
   - Privacy Policy URL
3. Submit for App Store Review
4. Wait for review (usually 24-48 hours)

## Troubleshooting

### Archive fails with signing errors
- Check Team selection in Xcode
- Ensure bundle ID matches App Store Connect
- Verify certificates and provisioning profiles

### Build upload fails
- Check internet connection
- Ensure all required capabilities are enabled
- Verify app icons are set (1024x1024 required)

### Build processing fails
- Check error messages in App Store Connect
- Verify export compliance information
- Check for missing required information

### Push notifications don't work in TestFlight
- Ensure `APNS_PRODUCTION=true` in backend
- Verify backend is using production APNs gateway
- Check that device token was registered from TestFlight build (not Xcode build)

## Additional Resources

- [Apple's TestFlight Documentation](https://developer.apple.com/testflight/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Xcode Archive Documentation](https://help.apple.com/xcode/mac/current/en.lproj/dev2539d985f.html)

