# Pre-Capacitor Testing Checklist
## Comprehensive Testing Before Mobile App Deployment

This document outlines all tests that should be performed before converting the web app to a Capacitor mobile app.

---

## 🎯 Testing Strategy

### Phase 1: Build & Compilation ✅
- [ ] Production build succeeds without errors
- [ ] No TypeScript/ESLint errors
- [ ] All dependencies resolve correctly
- [ ] Build output is optimized

### Phase 2: PWA Readiness ✅
- [ ] Manifest.json is valid and complete
- [ ] Service worker registers successfully
- [ ] Icons are present and correct sizes
- [ ] Offline page works
- [ ] App can be installed as PWA

### Phase 3: Mobile Responsiveness ✅
- [ ] Viewport meta tag is correct
- [ ] All pages responsive on mobile viewports (320px - 768px)
- [ ] Touch targets are at least 44x44px
- [ ] No horizontal scrolling on mobile
- [ ] Text is readable without zooming
- [ ] Forms are mobile-friendly

### Phase 4: API & Network ✅
- [ ] API endpoints are accessible
- [ ] Error handling for network failures
- [ ] Loading states are shown
- [ ] Timeout handling
- [ ] CORS is properly configured
- [ ] Authentication tokens are stored securely

### Phase 5: Performance ✅
- [ ] Initial load time < 3s on 3G
- [ ] Images are optimized
- [ ] No memory leaks
- [ ] Bundle size is reasonable
- [ ] Lazy loading where appropriate

### Phase 6: Security ✅
- [ ] No sensitive data in localStorage (except tokens)
- [ ] HTTPS enforced in production
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Input validation on forms

### Phase 7: Browser Compatibility ✅
- [ ] Works on iOS Safari
- [ ] Works on Chrome Android
- [ ] Works on Samsung Internet
- [ ] Works on Firefox Mobile

### Phase 8: Common Mobile Issues ✅
- [ ] No `alert()` or `confirm()` dialogs (use custom modals)
- [ ] No `window.open()` without user gesture
- [ ] Keyboard doesn't cover inputs
- [ ] Scroll behavior is smooth
- [ ] Pull-to-refresh doesn't conflict
- [ ] Back button works correctly

### Phase 9: Offline Functionality ✅
- [ ] App loads when offline
- [ ] Cached content displays
- [ ] Offline indicator shown
- [ ] Data syncs when back online

### Phase 10: User Flows ✅
- [ ] Login/logout works
- [ ] Registration works
- [ ] Password reset works
- [ ] Navigation works
- [ ] Forms submit correctly
- [ ] File uploads work
- [ ] Image display works

---

## 🚨 Critical Issues to Fix Before Capacitor

1. **Hardcoded localhost URLs** - Must use environment variables
2. **Browser-only APIs** - Check for `window`, `document`, `navigator` usage
3. **Service worker scope** - Must match app structure
4. **Relative vs absolute paths** - Ensure all assets load correctly
5. **Console errors** - Fix all errors and warnings
6. **Memory leaks** - Check for event listeners not being cleaned up

---

## 📝 Test Execution Log

Date: _______________
Tester: _______________

### Results:
- [ ] All tests passed
- [ ] Issues found: _______________
- [ ] Issues fixed: _______________
- [ ] Ready for Capacitor: Yes / No

---

## 🔧 Quick Test Commands

```bash
# Build production version
npm run build

# Check for linting errors
npm run lint (if available)

# Run existing tests
cd backend && npm test

# Check bundle size
npm run build && du -sh build/static/js/*.js

# Test service worker
# Open DevTools > Application > Service Workers
```

---

## 📱 Mobile Testing Tools

1. **Chrome DevTools Device Mode** - Test responsive design
2. **Lighthouse** - PWA audit and performance
3. **BrowserStack** - Real device testing
4. **iOS Simulator** - Test on iOS
5. **Android Emulator** - Test on Android

---

## ✅ Sign-off

Once all tests pass:
- [ ] Code reviewed
- [ ] Tests passing
- [ ] No critical issues
- [ ] Ready for Capacitor integration

**Approved by:** _______________
**Date:** _______________


