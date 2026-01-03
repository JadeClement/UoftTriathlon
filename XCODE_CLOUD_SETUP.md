# Xcode Cloud Setup Guide

This guide explains how to fix the Xcode Cloud configuration for your Capacitor iOS app.

## The Problem

Xcode Cloud is looking for the Xcode project but can't find it. The error message shows:
```
Project App.xcodeproj does not exist at ios/App/App.xcodeproj
```

## Solution

You need to configure the Xcode Cloud workflow properly. Here's how:

### Step 1: Fix the Workflow Configuration in Xcode

1. **Open your project in Xcode:**
   ```bash
   npx cap open ios
   ```

2. **Open Xcode Cloud settings:**
   - In Xcode, go to the **Cloud** tab (at the top, next to Source Control)
   - Or go to: **Product** → **Xcode Cloud** → **Configure Workflow**

3. **Configure the workflow:**
   - **Product**: Select "App"
   - **Project/Workspace Path**: The path should be relative to your repository root
     - Set to: `ios/App/App.xcodeproj` 
     - OR: Make sure Xcode Cloud knows the repository structure

4. **Add Build Script (Important for Capacitor):**
   - In the workflow settings, go to **Build** → **Environment**
   - Under **Pre-actions** or **Pre-build scripts**, add:
     - **Script Path**: `.github/xcode-cloud/ci_pre_xcodebuild.sh`
     - OR manually add:
       ```bash
       cd $CI_WORKSPACE
       npm ci
       npm run build
       npx cap sync ios
       ```

### Step 2: Verify Repository Structure

Make sure your `.gitignore` isn't excluding necessary files:
- ✅ `ios/App/App.xcodeproj` should be committed
- ✅ `ios/App/App/` directory should be committed
- ❌ `ios/App/App.xcuserdata/` should be ignored (user-specific)

### Step 3: Alternative - Use Manual Archive Instead

If Xcode Cloud continues to have issues, you can use the manual archive process instead:

1. **Build locally in Xcode:**
   - Open Xcode: `npx cap open ios`
   - Select "Any iOS Device"
   - Product → Archive

2. **Upload manually:**
   - Window → Organizer
   - Select your archive
   - Distribute App → App Store Connect → Upload

This is the method described in `TESTFLIGHT_DEPLOYMENT.md`.

## Xcode Cloud Workflow Configuration

If you want to continue with Xcode Cloud, here's the proper configuration:

### Required Files

1. **`.xcode-version`** (in repository root):
   ```
   15.0
   ```
   (or your Xcode version)

2. **`.github/xcode-cloud/ci_pre_xcodebuild.sh`** (pre-build script):
   ```bash
   #!/bin/sh
   set -e
   cd "$CI_WORKSPACE"
   npm ci
   npm run build
   npx cap sync ios
   ```
   This script is already committed to the repository.

### Workflow Settings

In Xcode Cloud workflow configuration:
- **Source**: Git repository
- **Branch**: `main` (or your production branch)
- **Product**: App
- **Project Path**: `ios/App/App.xcodeproj`
- **Pre-build script**: `.github/xcode-cloud/ci_pre_xcodebuild.sh` (already in repository)

## Troubleshooting

### If the path is still wrong:

1. **Check the actual path in your repository:**
   ```bash
   find . -name "App.xcodeproj" -type d
   ```

2. **Verify the path is correct relative to repository root:**
   - Repository root: `/` (where `.git` is)
   - Project path: `ios/App/App.xcodeproj`
   - Full path from root: `ios/App/App.xcodeproj`

### If build scripts fail:

1. Make sure `package.json` and `package-lock.json` are in the repository root
2. Make sure Node.js version is specified (Xcode Cloud uses Node.js 18 by default)
3. Check that all npm dependencies are in `package-lock.json`

### Recommended: Use Manual Archive for Now

For TestFlight deployment, the **manual archive method** (described in `TESTFLIGHT_DEPLOYMENT.md`) is often simpler and more reliable than Xcode Cloud, especially for Capacitor apps. You can set up Xcode Cloud later if you want automated builds.

