# iOS Calendar Plugin Setup

## Overview

A custom Capacitor plugin has been created to add workout events to the iOS calendar using EventKit. The plugin file has been created, but you need to add it to your Xcode project.

## Steps to Complete Setup

### 1. Add CalendarPlugin.swift to Xcode Project

1. Open your project in Xcode:
   ```bash
   npm run cap:open:ios
   ```

2. In Xcode, right-click on the `App` folder (inside `ios/App/App/`)
3. Select **Add Files to "App"...**
4. Navigate to `ios/App/App/CalendarPlugin.swift`
5. Make sure:
   - ✅ **Copy items if needed** is checked (if the file isn't already in the project)
   - ✅ **Add to targets: App** is checked
6. Click **Add**

### 2. Verify the Plugin is Registered

The plugin should be auto-registered by Capacitor. To verify:

1. Build the project in Xcode (⌘B)
2. Check for any compilation errors
3. The plugin should be available as `Calendar` in JavaScript

### 3. Test the Integration

1. Run the app in the iOS Simulator or on a device
2. Navigate to a workout detail page
3. Click the "📅 Add to Calendar" button
4. You should see a permission prompt for calendar access
5. After granting permission, the event should be added to your calendar
6. The button should change to "✓ Added to Calendar"

## Troubleshooting

### Plugin Not Found Error

If you see "Calendar plugin not available" error:

1. Make sure `CalendarPlugin.swift` is added to the Xcode project
2. Make sure it's included in the App target
3. Clean build folder: **Product** → **Clean Build Folder** (⇧⌘K)
4. Rebuild: **Product** → **Build** (⌘B)

### Permission Denied

If calendar permission is denied:

1. Go to **Settings** → **Privacy & Security** → **Calendars**
2. Find your app and enable calendar access
3. Restart the app

### Build Errors

If you get Swift compilation errors:

1. Make sure you're using Xcode 15+ (for iOS 15+ support)
2. Check that EventKit framework is available (it should be by default)
3. Verify the Swift syntax is correct

## How It Works

1. **User clicks "Add to Calendar"** → `handleAddToCalendar()` is called
2. **JavaScript calls plugin** → `Calendar.addEvent()` with workout details
3. **Swift plugin requests permission** → EventKit requests calendar access
4. **Event is created** → Using EventKit's `EKEvent` and `EKEventStore`
5. **Event is saved** → Added to user's default calendar
6. **State is updated** → Button changes to "✓ Added to Calendar"
7. **State is persisted** → Stored in localStorage for quick checks

## Files Modified

- ✅ `ios/App/App/CalendarPlugin.swift` - Swift plugin implementation
- ✅ `ios/App/App/Info.plist` - Added calendar permissions
- ✅ `src/services/calendarService.js` - JavaScript service using the plugin
- ✅ `src/components/WorkoutDetail.js` - UI integration with state tracking
- ✅ `src/components/WorkoutDetail.css` - Button styling

## Notes

- The plugin properly handles EST/EDT timezone conversion
- Events are saved with proper start/end times based on workout type
- The button state persists across page reloads using localStorage
- Calendar permission is requested on first use
