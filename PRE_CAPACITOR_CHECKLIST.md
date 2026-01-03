# Pre-Capacitor Checklist
**Last Updated:** $(date)  
**Status:** Ready for Capacitor Integration

This checklist ensures the app is ready for Capacitor mobile app conversion.

---

## ✅ COMPLETED ITEMS

### Code Quality & Compatibility
- [x] **Alert/Confirm Dialogs Replaced** - All `alert()` and `window.confirm()` replaced with custom modals
  - Created `ConfirmModal` component
  - Using `SimpleNotification` for toast messages
  - 75+ instances replaced across 12 files
- [x] **Error Boundary Added** - React Error Boundary component created and integrated
  - File: `src/components/ErrorBoundary.js`
  - Wrapped around entire app in `App.js`
  - Shows user-friendly error UI with refresh option
  - Shows detailed error info in development mode
- [x] **.gitignore Updated** - Added Capacitor-related paths
  - Added `.capacitor/`, `ios/`, `android/` directories

### PWA Foundation
- [x] **Manifest.json** - PWA manifest exists with proper configuration
  - Location: `public/manifest.json`
  - Includes icons, theme colors, display mode
- [x] **Service Worker** - Service worker registered and functional
  - Location: `public/service-worker.js`
  - Registered in `src/index.js`
- [x] **Viewport Meta Tag** - Properly configured for mobile
  - `width=device-width, initial-scale=1` in `public/index.html`
  - Apple-specific meta tags present

### API & Environment
- [x] **Environment Variables** - All API calls use `REACT_APP_API_BASE_URL`
  - Proper fallback to localhost for development
  - Used consistently across all components

---

## 🔍 ITEMS TO VERIFY

### Build & Assets
- [ ] **Production Build Success**
  - Run: `npm run build`
  - Verify: Build completes without errors
  - Test: Serve build locally and verify app works
  - Command: `npx serve -s build`
- [ ] **Icon Assets Exist**
  - Verify: `/public/images/icon.png` exists
  - Check: Icon is at least 512x512px
  - Note: Will need additional sizes for Capacitor (1024x1024, etc.)
- [ ] **No Console Errors**
  - Run app in development
  - Check browser console for errors/warnings
  - Fix any critical errors before Capacitor

### Mobile Testing
- [ ] **Test on Mobile Browser**
  - iOS Safari: Test core functionality
  - Android Chrome: Test core functionality
  - Verify: All pages load correctly
  - Verify: Forms work properly
  - Verify: Touch interactions work
- [ ] **Touch Target Sizes**
  - Verify: All buttons are at least 44x44px
  - Check: Mobile navigation
  - Check: Form inputs and buttons
  - Check: Action buttons throughout app
- [ ] **Keyboard Handling**
  - Test: Forms don't get covered by keyboard
  - Verify: Input fields are accessible
  - Check: Form submission works on mobile
- [ ] **Scroll Behavior**
  - Verify: Smooth scrolling works
  - Check: No horizontal scrolling issues
  - Verify: Pull-to-refresh doesn't conflict (if implemented)

### Performance
- [ ] **Lighthouse Audit**
  - Run: Lighthouse PWA audit
  - Target: Score > 90
  - Check: Performance, Accessibility, Best Practices
  - Verify: PWA installable
- [ ] **Initial Load Time**
  - Target: < 3 seconds on 3G
  - Check: Bundle size is reasonable
  - Verify: Images are optimized

### Functionality
- [ ] **Offline Mode**
  - Test: Service worker caching
  - Verify: App works offline (if applicable)
  - Check: Offline indicator shows correctly
- [ ] **API Connectivity**
  - Verify: All API endpoints accessible
  - Test: Error handling for network failures
  - Check: Loading states work correctly
- [ ] **Authentication Flow**
  - Test: Login/logout works
  - Verify: Token storage works
  - Check: Session persistence

---

## 📋 CAPACITOR SETUP CHECKLIST

### Installation
- [ ] Install Capacitor CLI and core packages
  ```bash
  npm install @capacitor/core @capacitor/cli
  npm install @capacitor/ios @capacitor/android
  ```
- [ ] Initialize Capacitor
  ```bash
  npx cap init
  ```
  - App ID: `club.uofttri.app` (or your preferred ID)
  - App Name: `UofT Tri Club`
  - Web Dir: `build`

### Configuration
- [ ] Create `capacitor.config.json`
  - Configure app ID, name, webDir
  - Set server URL for production API
- [ ] Update `package.json` scripts
  - Add: `"cap:sync": "cap sync"`
  - Add: `"cap:open:ios": "cap open ios"`
  - Add: `"cap:open:android": "cap open android"`
- [ ] Configure app icons and splash screens
  - Prepare 1024x1024 icon
  - Use Capacitor asset generation or manual setup

### iOS Setup (if targeting iOS)
- [ ] Install Xcode
- [ ] Install CocoaPods: `sudo gem install cocoapods`
- [ ] Sync and open: `npm run build && npx cap sync && npx cap open ios`
- [ ] Configure signing in Xcode
- [ ] Test on iOS simulator

### Android Setup (if targeting Android)
- [ ] Install Android Studio
- [ ] Install Java Development Kit (JDK)
- [ ] Set up Android SDK
- [ ] Sync and open: `npm run build && npx cap sync && npx cap open android`
- [ ] Test on Android emulator

### Native Features (Optional - can do after initial setup)
- [ ] Camera Integration
  - Install: `npm install @capacitor/camera`
  - Replace file inputs with Camera plugin
  - Update profile image upload
  - Update gear image uploads
- [ ] Push Notifications
  - Install: `npm install @capacitor/push-notifications`
  - Configure FCM (Android) and APNs (iOS)
  - Update backend to support push tokens
- [ ] File System
  - Install: `npm install @capacitor/filesystem`
  - Use for file downloads if needed
- [ ] Device Info
  - Install: `npm install @capacitor/device`
  - Use for analytics/device identification

---

## 🔧 RECOMMENDED IMPROVEMENTS (Post-Capacitor)

These can be done after initial Capacitor setup:

### Error Tracking & Analytics
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Add analytics (Google Analytics, Mixpanel, etc.)
- [ ] Track app installs and usage patterns

### Performance
- [ ] Optimize images (WebP format, compression)
- [ ] Implement code splitting/lazy loading
- [ ] Optimize bundle size
- [ ] Add loading skeletons

### User Experience
- [ ] Add haptic feedback for actions
- [ ] Improve offline experience
- [ ] Add pull-to-refresh
- [ ] Implement deep linking

### Security
- [ ] Consider Capacitor Secure Storage for tokens
- [ ] Review and strengthen API security
- [ ] Add certificate pinning (if needed)

---

## 📝 NOTES

### Known Issues/Considerations
- Service worker update confirmation still uses `window.confirm()` (in `src/index.js`)
  - This is intentional for service worker lifecycle
  - Can be replaced with custom modal if needed later
- File uploads use standard HTML `<input type="file">`
  - Works but limited on mobile
  - Consider Capacitor Camera plugin after initial setup
- localStorage used for token storage
  - Works for Capacitor
  - Consider Capacitor Preferences or Secure Storage later

### Build Process
1. Make changes to React app
2. Run `npm run build` to create production build
3. Run `npx cap sync` to sync web assets to native projects
4. Test in Xcode (iOS) or Android Studio (Android)
5. Deploy to app stores

### Development Workflow
- Development: Use `npm start` and test in browser
- Testing: Build and test in simulators/emulators
- Production: Build, sync, then build native apps

---

## ✅ READY FOR CAPACITOR?

Before proceeding, ensure:
- [x] All alerts/confirms replaced
- [x] Error boundary added
- [x] .gitignore updated
- [ ] Production build succeeds
- [ ] Icons/assets verified
- [ ] Basic mobile browser testing done
- [ ] No critical console errors

**Status:** ✅ Ready for Capacitor Setup (pending build verification)

---

## 🚀 NEXT STEPS

1. Run `npm run build` and verify success
2. Verify icon assets exist
3. Quick mobile browser test
4. Install Capacitor: `npm install @capacitor/core @capacitor/cli`
5. Initialize: `npx cap init`
6. Configure and sync
7. Open in Xcode/Android Studio and test

Good luck! 🎉

