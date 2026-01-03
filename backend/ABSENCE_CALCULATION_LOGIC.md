# Absence Calculation Logic

This document explains how user absences are calculated and tracked in the system.

## Overview

Absences are stored in the `users.absences` column (INTEGER, default 0) and are incremented/decremented based on two scenarios:
1. **Late Cancellations** (within 12 hours of workout)
2. **Admin-Submitted Attendance** (user signed up but didn't attend)

---

## Scenario 1: Late Cancellation (Within 12 Hours)

**Location:** `backend/routes/forum.js` - `POST /workouts/:id/signup` (when user cancels)

### Flow:

1. **User cancels a workout signup**
   - Endpoint: `POST /api/forum/workouts/:id/signup`
   - When a user who is already signed up tries to sign up again, it triggers cancellation

2. **Check if cancellation is within 12 hours**
   ```javascript
   const workoutDateTime = combineDateTime(workout.workout_date, workout.workout_time);
   const within12hrs = isWithinHours(workoutDateTime, 12);
   ```
   - Uses `combineDateTime()` to create a Date object from workout date/time
   - Uses `isWithinHours()` to check if workout is 0-12 hours in the future
   - **Important:** This comparison happens at the time of cancellation

3. **If within 12 hours (`within12hrs = true`):**
   - **Insert/Update `workout_cancellations` table:**
     ```sql
     INSERT INTO workout_cancellations (post_id, user_id, cancelled_at, within_12hrs, marked_absent)
     VALUES ($1, $2, CURRENT_TIMESTAMP, true, true)
     ```
     - `within_12hrs = true`
     - `marked_absent = true`
     - `cancelled_at = CURRENT_TIMESTAMP` (UTC timestamp)

   - **Insert/Update `workout_attendance` table:**
     ```sql
     INSERT INTO workout_attendance (post_id, user_id, attended, recorded_at)
     VALUES ($1, $2, false, CURRENT_TIMESTAMP)
     ```
     - `attended = false`
     - Creates a record indicating the user was absent

   - **Increment `users.absences`:**
     ```sql
     UPDATE users SET absences = absences + 1 WHERE id = $1
     ```
     - Adds 1 to the user's absence count

4. **If outside 12 hours (`within12hrs = false`):**
   - **Insert/Update `workout_cancellations` table:**
     ```sql
     INSERT INTO workout_cancellations (post_id, user_id, cancelled_at, within_12hrs, marked_absent)
     VALUES ($1, $2, CURRENT_TIMESTAMP, false, false)
     ```
     - `within_12hrs = false`
     - `marked_absent = false`
     - **NO absence is recorded** - user cancelled early enough

---

## Scenario 2: Admin-Submitted Attendance

**Location:** `backend/routes/admin.js` - `POST /workout-attendance/:workoutId`

### Flow:

1. **Admin submits attendance for a workout**
   - Endpoint: `POST /api/admin/workout-attendance/:workoutId`
   - Admin provides an array of `attendanceData` with `userId` and `attended` status

2. **For each user who signed up:**
   ```javascript
   const signups = await pool.query(`
     SELECT ws.user_id, u.name, u.email
     FROM workout_signups ws
     JOIN users u ON ws.user_id = u.id
     WHERE ws.post_id = $1
   `);
   ```

3. **Check if user attended:**
   ```javascript
   const attended = attendedUserIds.includes(signup.user_id);
   ```

4. **Insert/Update `workout_attendance` table:**
   ```sql
   INSERT INTO workout_attendance (post_id, user_id, attended, recorded_at)
   VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
   ON CONFLICT (post_id, user_id) 
   DO UPDATE SET attended = $3, recorded_at = CURRENT_TIMESTAMP
   ```

5. **If user did NOT attend (`attended = false`):**
   ```sql
   UPDATE users 
   SET absences = absences + 1 
   WHERE id = $1
   ```
   - **Increments absence count by 1**
   - **Note:** This happens regardless of whether they cancelled early or not
   - **Potential Issue:** If a user cancelled outside 12 hours, they won't have an absence from cancellation, but they WILL get an absence from admin attendance submission

---

## Database Tables Involved

### 1. `users` table
- `absences INTEGER DEFAULT 0` - The running count of absences

### 2. `workout_cancellations` table
- `post_id` - Workout ID
- `user_id` - User ID
- `cancelled_at TIMESTAMP` - When cancellation happened
- `within_12hrs BOOLEAN` - Whether cancellation was within 12 hours
- `marked_absent BOOLEAN` - Whether this cancellation resulted in an absence

### 3. `workout_attendance` table
- `post_id` - Workout ID
- `user_id` - User ID
- `attended BOOLEAN` - Whether user attended (false = absent)
- `recorded_at TIMESTAMP` - When attendance was recorded
- `late BOOLEAN` - Whether user was late (optional)

---

## Potential Issues

### Issue 1: Double Counting (CRITICAL BUG)
**Problem:** If a user cancels within 12 hours, they get an absence from cancellation. Then if an admin submits attendance and marks them as "did not attend", they get ANOTHER absence, resulting in 2 absences for the same workout.

**Current Behavior:**
- Cancellation within 12 hours: +1 absence (creates `workout_attendance` record with `attended = false`)
- Admin marks as absent: +1 absence (again) - **DOES NOT CHECK if absence already exists**
- **Total: 2 absences for one workout** ❌

**Code Location:** `backend/routes/admin.js:656-663`
```javascript
if (!attended) {
  await pool.query(`
    UPDATE users 
    SET absences = absences + 1 
    WHERE id = $1
  `, [signup.user_id]);
}
```

**Expected Behavior:**
- Should check if `workout_attendance` record already exists for this workout/user
- Should check if user cancelled within 12 hours (already has absence)
- Only increment if this is a new absence

**Fix Needed:**
```javascript
// Check if absence already exists
const existingAttendance = await pool.query(`
  SELECT attended FROM workout_attendance 
  WHERE post_id = $1 AND user_id = $2
`, [workoutId, signup.user_id]);

// Only increment if:
// 1. No existing attendance record, OR
// 2. Existing record shows attended = true (changing from attended to absent)
if (!attended && (!existingAttendance.rows.length || existingAttendance.rows[0].attended)) {
  await pool.query(`
    UPDATE users 
    SET absences = absences + 1 
    WHERE id = $1
  `, [signup.user_id]);
}
```

### Issue 2: Timezone Handling
**Problem:** The `isWithinHours()` function compares:
- `workoutDateTime` (created using `combineDateTime()` which uses server's local timezone)
- `new Date()` (current time, also in server's timezone)

If the server is not in America/Toronto timezone, the 12-hour calculation will be incorrect.

**Current Implementation:**
```javascript
function combineDateTime(dateInput, timeStr) {
  const result = new Date(date);
  result.setHours(time.hours, time.minutes, time.seconds, 0); // Uses server's local timezone
  return result;
}

function isWithinHours(date, hours) {
  const now = new Date(); // Current time in server's timezone
  const diffMs = date - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= hours;
}
```

**Issue:** If server is in UTC but workouts are scheduled in EST, a workout at 6:00 PM EST (11:00 PM UTC) will be calculated incorrectly.

### Issue 3: Admin Attendance Overwrites Cancellation Logic
**Problem:** Admin attendance submission doesn't check if the user already has an absence from cancellation. It just increments absences for anyone marked as "did not attend".

**Current Code:**
```javascript
if (!attended) {
  await pool.query(`
    UPDATE users 
    SET absences = absences + 1 
    WHERE id = $1
  `, [signup.user_id]);
}
```

**Should Check:**
- If user already has an absence record in `workout_attendance` for this workout
- If user cancelled within 12 hours (already has absence)
- Only increment if this is a new absence

---

## Migration Scripts

There are several migration scripts that fix historical absence calculations:

1. **`migrate-fix-cancellation-timezones.sql`** - Fixes timezone issues in historical cancellations
2. **`migrate-fix-cancellation-timezones-apply.sql`** - Applies the fixes
3. **`migrate-fix-cancellation-timezones.js`** - Node.js version of the migration

These scripts:
- Recalculate `within_12hrs` based on correct timezone logic
- Update `workout_cancellations` table
- Adjust `users.absences` counts accordingly
- Add/remove `workout_attendance` records as needed

---

## Summary

**Absences are incremented when:**
1. ✅ User cancels within 12 hours of workout start
2. ✅ Admin marks user as "did not attend" (regardless of cancellation status)

**Absences are NOT incremented when:**
1. ✅ User cancels outside 12 hours of workout start
2. ❌ (But admin attendance can still add an absence)

**Key Functions:**
- `combineDateTime()` - Creates workout datetime from date/time strings
- `isWithinHours()` - Checks if workout is within N hours from now
- `getHoursUntil()` - Calculates hours until workout

**Database Operations:**
- `workout_cancellations` - Tracks cancellations and whether they count as absences
- `workout_attendance` - Tracks actual attendance records
- `users.absences` - Running count of total absences

