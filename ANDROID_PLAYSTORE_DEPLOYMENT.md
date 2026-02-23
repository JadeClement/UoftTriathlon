# Android Google Play Store Deployment Guide

This guide walks you through building and submitting the UofT Triathlon app to the Google Play Console.

## Prerequisites

- ✅ Google Play Developer account ($25 one-time fee)
- ✅ [Android Studio](https://developer.android.com/studio) installed (Arctic Fox or newer)
- ✅ Java 17+ (comes with Android Studio)
- ✅ App built and tested: `npm run build && npx cap sync`

---

## Step 1: Create a Release Keystore

You need a keystore to sign your release builds. **Keep this file and passwords safe** — you cannot update your app on Play Store without them.

### 1.1 Generate the keystore

From your project root, run (or run from any directory and adjust paths):

```bash
keytool -genkey -v -keystore android/app/uoft-tri-release.keystore -alias uoft-tri -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for:
- **Keystore password** — choose a strong password, save it
- **Key password** — can be same as keystore password
- **Name, Organization, City, State, Country** — use real values (they appear in the certificate)

### 1.2 Create keystore.properties

Create `android/keystore.properties` (this file is gitignored — never commit it):

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=uoft-tri
storeFile=uoft-tri-release.keystore
```

Replace `YOUR_KEYSTORE_PASSWORD` and `YOUR_KEY_PASSWORD` with the passwords you chose.

**Important:** `storeFile` is relative to the `android/app/` directory. If you put the keystore elsewhere, use the full path.

---

## Step 2: Configure Release Signing in Gradle

The `android/app/build.gradle` is already set up to use `keystore.properties` when it exists. If the file is missing, release builds will fail with a clear error — that's intentional to avoid accidental debug builds for production.

Verify your `app/build.gradle` has a `signingConfigs` block that loads from `keystore.properties`. (See the file for the exact configuration.)

---

## Step 3: Update Version for Release

Edit `android/app/build.gradle` or `variables.gradle`:

- **versionCode** — integer, must increase for each Play Store upload (e.g., 1, 2, 3…)
- **versionName** — user-facing version string (e.g., `"1.0.0"`)

Example in `app/build.gradle`:

```gradle
defaultConfig {
    versionCode 2
    versionName "1.0.1"
    // ...
}
```

---

## Step 4: Set Production API URL (if needed)

If your app loads the web app from a production URL, update `capacitor.config.ts`:

```ts
server: {
  url: 'https://www.uoft-tri.club',
  cleartext: false
}
```

Then rebuild and sync:

```bash
npm run build
npx cap sync
```

---

## Step 5: Build the Release AAB

Google Play requires an **Android App Bundle (AAB)**, not an APK, for new apps.

### Option A: Command line

From project root:

```bash
cd android
./gradlew bundleRelease
```

The AAB will be at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

### Option B: Android Studio

1. `npx cap open android`
2. **Build → Generate Signed Bundle / APK**
3. Choose **Android App Bundle**
4. Select your keystore (or create one)
5. Select **release** build variant
6. Finish

---

## Step 6: Prepare for Google Play Console

### 6.1 Create app in Play Console

1. Go to [Google Play Console](https://play.google.com/console/)
2. **Create app** (if not already created)
3. Fill in:
   - App name
   - Default language
   - App or game (App)
   - Free or paid (usually Free)

### 6.2 Complete Store Listing

- Short description (80 chars)
- Full description (4000 chars)
- Screenshots (phone: at least 2, 16:9 or 9:16)
- High-res icon (512×512)
- Feature graphic (1024×500)
- Privacy Policy URL (required)

### 6.3 Set up App Content

- **Privacy Policy** — URL to your policy
- **App access** — explain login if members-only
- **Ads** — declare if you use ads (likely “No”)
- **Content rating** — complete questionnaire
- **Target audience** — age groups
- **News app** — if applicable
- **COVID-19 contact tracing** — if applicable
- **Data safety** — describe collected data

### 6.4 Create a release

1. **Production** (or **Testing → Internal testing** first)
2. **Create new release**
3. Upload `app-release.aab`
4. Add release notes
5. **Review and rollout**

---

## Step 7: Push Notifications (Firebase)

If you use push notifications (like iOS):

1. Add your Android app to [Firebase Console](https://console.firebase.google.com/)
2. Download `google-services.json`
3. Place it in `android/app/`
4. Rebuild

The project already applies the Google Services plugin when `google-services.json` exists.

---

## Quick Reference: Build Commands

```bash
# Build web app
npm run build

# Sync to native
npx cap sync

# Build release AAB (from project root)
cd android && ./gradlew bundleRelease

# Or open in Android Studio
npx cap open android
```

---

## Troubleshooting

### "Keystore was tampered with, or password was incorrect"
- Check `keystore.properties` — correct password and alias

### "Execution failed for task ':app:validateSigningRelease'"
- Ensure `keystore.properties` exists and paths are correct
- Ensure the keystore file exists at the path in `storeFile`

### Build fails with "Duplicate class"
- Run `./gradlew clean` then `bundleRelease` again

### "Minimum supported Gradle version"
- Update `gradle-wrapper.properties` or Android Studio
- Capacitor 8 typically needs Gradle 8.x
