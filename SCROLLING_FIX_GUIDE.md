# Scrolling Fix Guide for Capacitor iOS

## 🔍 Settings to Check in Xcode

### 1. **Check the ViewController in Xcode**

1. Open `ios/App/App.xcodeproj` in Xcode
2. Navigate to `App/Base.lproj/Main.storyboard`
3. Select the **View Controller** (should be `CAPBridgeViewController`)
4. In the **Attributes Inspector** (right panel), check:
   - No constraints that might prevent scrolling
   - View mode is set correctly

### 2. **Check WebView ScrollView Settings**

Since Capacitor uses `CAPBridgeViewController`, the WebView is created programmatically. You may need to create a custom ViewController to enable scrolling.

**Option A: Create Custom ViewController (Recommended)**

1. In Xcode, create a new Swift file: `App/ViewController.swift`
2. Add this code:

```swift
import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Ensure scrolling is enabled
        if let webView = self.webView {
            webView.scrollView.isScrollEnabled = true
            webView.scrollView.bounces = true
            webView.scrollView.alwaysBounceVertical = true
            webView.scrollView.alwaysBounceHorizontal = false
        }
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        // Double-check scrolling is enabled after view appears
        if let webView = self.webView {
            webView.scrollView.isScrollEnabled = true
        }
    }
}
```

3. Update `Main.storyboard` to use this custom class:
   - Open `Main.storyboard`
   - Select the View Controller
   - In Identity Inspector, change `Custom Class` from `CAPBridgeViewController` to `ViewController`

### 3. **Check Info.plist Settings**

Verify these settings in `Info.plist`:
- No settings that disable scrolling
- Viewport settings are correct

### 4. **Check Capacitor Config**

In `capacitor.config.ts`, ensure there are no settings blocking scrolling.

## 🛠️ Quick JavaScript Fix (Try This First)

Add this to your `src/index.js` or create a new file `src/utils/enableScrolling.js`:

```javascript
// Force enable scrolling on iOS
if (window.Capacitor) {
  document.addEventListener('DOMContentLoaded', () => {
    // Enable scrolling on body
    document.body.style.overflow = 'auto';
    document.body.style.webkitOverflowScrolling = 'touch';
    
    // Enable scrolling on html
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.webkitOverflowScrolling = 'touch';
    
    // Force enable touch events
    document.body.style.touchAction = 'pan-y';
    document.documentElement.style.touchAction = 'pan-y';
    
    console.log('✅ Scrolling enabled');
  });
  
  // Also try after a delay
  setTimeout(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
  }, 100);
}
```

Then import it in `src/index.js`:
```javascript
import './utils/enableScrolling';
```

## 🔧 Alternative: Check Content Height

The issue might be that your content isn't actually taller than the viewport. Check:

1. In Safari Web Inspector (connect to iOS simulator):
   - Open Safari → Develop → [Your Simulator] → [Your App]
   - Check the computed height of `body` and `html`
   - Verify content actually extends beyond viewport

2. Add temporary CSS to test:
```css
body {
  min-height: 200vh; /* Force content to be 2x viewport height */
}
```

If scrolling works with this, the issue is content height, not scrolling settings.

## 📱 Test in Different Environments

1. **iOS Simulator** - Test scrolling
2. **Physical Device** - Sometimes simulators behave differently
3. **Safari on iOS** - Test if the web version scrolls (to isolate Capacitor issue)

## 🐛 Debug Steps

1. **Check Console Logs:**
   - Look for any JavaScript errors
   - Check if touch events are being fired

2. **Inspect Element:**
   - Use Safari Web Inspector
   - Check computed styles for `overflow`, `height`, `touch-action`
   - Verify no element has `position: fixed` covering the whole screen

3. **Test Touch Events:**
   Add this to test if touch is working:
```javascript
document.addEventListener('touchstart', (e) => {
  console.log('Touch start:', e.touches[0].clientY);
});

document.addEventListener('touchmove', (e) => {
  console.log('Touch move:', e.touches[0].clientY);
});
```

## ✅ Most Likely Fixes

1. **Create custom ViewController** (Option A above) - This is the most common fix
2. **Add JavaScript fix** - Force enable scrolling via JS
3. **Check content height** - Ensure content is actually scrollable
4. **Remove conflicting CSS** - Check for `overflow: hidden` or `height: 100vh` on parent elements

## 🚨 If Nothing Works

Check if there's a plugin or Capacitor version issue:
```bash
npm list @capacitor/ios @capacitor/core
```

Update if needed:
```bash
npm update @capacitor/ios @capacitor/core
npm run cap:sync
```

