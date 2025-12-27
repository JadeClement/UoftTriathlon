# Background Sync - Simple Explanation

## What is Background Sync?

**Background Sync** is like a "to-do list" for your app. When you try to do something while offline, instead of showing an error, the app saves it to a list and does it later when you're back online.

**Note:** Some actions (like workout signups and forum posts) require an online connection and will show an error message if you're offline. Only certain actions (like profile updates) are queued for later.

## How It Works (Simple Version)

### Scenario: You're Offline and Try to Do Something

**For actions that require online connection (workout signups, forum posts):**
1. **You take an action** (e.g., sign up for a workout, post in forum)
2. **App checks if you're online** → ❌ No internet
3. **You see a message**: "Whoops! You're offline right now. Please check your internet connection and try again when you're back online!"

**For actions that can be queued (profile updates):**
1. **You take an action** (e.g., update profile)
2. **The app tries to send it to the server** → ❌ Fails (no internet)
3. **Instead of showing an error**, the app saves it to a "queue" (like a to-do list)
4. **You see a message**: "Saved offline, will sync when online" ✅

### Scenario: You Come Back Online

1. **The app automatically detects** you're online
2. **It goes through the queue** and sends each saved action to the server
3. **You get notified**: "1 action synced successfully!" ✅

## Real Examples from Your App

### Example 1: Signing Up for a Workout (Offline)

**What happens:**
- User clicks "Sign Up" for a workout
- App checks: Are we online? → ❌ No
- **User sees**: "Whoops! You're offline right now. Please check your internet connection and try again when you're back online!"
- **Action is NOT queued** - user must try again when online

**Why?** Workout signups have capacity limits and timing constraints (12-hour cancellation window). We need real-time server validation to prevent conflicts.

### Example 2: Posting in Forum (Offline)

**What happens:**
- User writes a forum post and clicks "Post"
- App checks: Are we online? → ❌ No
- **User sees**: "Whoops! You're offline right now. Please check your internet connection and try again when you're back online!"
- **Action is NOT queued** - user must try again when online

**Why?** Forum posts could create duplicates or confusion if queued. Better to require online connection.

### Example 3: Updating Profile (Offline)

**What happens:**
- User updates their bio and clicks "Save"
- App tries: `PUT /api/users/profile` → ❌ No internet
- App saves: "Update profile: bio = 'New bio text'" to queue
- User sees their changes locally

**When online:**
- App sends the update
- Profile is updated on server ✅

### Example 4: Canceling Workout (Offline)

**What happens:**
- User cancels a workout signup
- App tries: `DELETE /api/forum/posts/123/signup` → ❌ No internet
- App saves: "Cancel workout #123" to queue
- User sees they're canceled locally

**When online:**
- App sends the cancellation
- User is removed from workout ✅

## What Gets Queued?

✅ **These actions get queued (will sync when online):**
- Updating profile (`PUT /api/users/profile`)
- Other personal data updates that don't conflict with others

❌ **These DON'T get queued (require online connection):**
- Signing up for workouts (`POST /api/forum/workouts/:id/signup`)
- Canceling workouts (`POST /api/forum/workouts/:id/signup`)
- Creating forum posts (`POST /api/forum/posts`)
- Creating events (`POST /api/forum/posts` with type='event')
- Signing up for races (`POST /api/races/:id/signup`)
- Just viewing pages (`GET` requests)
- Login attempts (would fail anyway)

## The Queue System

### Queue Storage
- Stored in **IndexedDB** (browser database)
- Persists even if you close the app
- Maximum 100 items (removes oldest if full)

### Queue Processing
- **Automatic**: When you come back online
- **Manual**: You can click "Sync Now" button
- **Retry logic**: Tries up to 3 times if it fails
- **Smart**: Removes successful items, keeps failed ones for retry

## User Experience

### While Offline
```
User: *tries to sign up for workout*
App: "Saved offline ✓"
User: *sees they're signed up locally*
User: *can continue using app*
```

### Coming Back Online
```
App: *automatically syncs*
App: "3 actions synced successfully! ✓"
User: *everything is now on server*
```

### If Sync Fails
```
App: "2 actions synced, 1 failed"
App: *keeps trying the failed one*
App: *shows user which one failed*
```

## Technical Details (Simplified)

1. **Queue Request Function**: Saves failed requests to IndexedDB
2. **Process Queue Function**: Sends queued requests when online
3. **Retry Logic**: Tries failed requests up to 3 times
4. **Status Tracking**: Tracks pending/completed/failed status

## Benefits

✅ **No lost data**: Actions aren't lost when offline
✅ **Better UX**: Users can keep working offline
✅ **Automatic**: No manual intervention needed
✅ **Reliable**: Retries failed requests
✅ **Transparent**: Users know what's happening

## Potential Issues & Solutions

### Issue: Two users edit same thing offline
**Solution**: Last-write-wins (server timestamp decides)

### Issue: Queue gets too full
**Solution**: Removes oldest items (max 100)

### Issue: Request fails after retries
**Solution**: Marks as failed, user can retry manually

## Summary

**Background Sync = Save actions when offline, send them when online**

It's like writing a letter when the mail is down, then sending it when the mail comes back! 📮

