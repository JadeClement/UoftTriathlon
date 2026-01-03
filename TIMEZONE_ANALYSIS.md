# Timezone Handling Analysis

## Current State

### Database Schema
- **`workout_date`**: Stored as `DATE` (no timezone information)
- **`workout_time`**: Stored as `TIME` (no timezone information)
- **Timestamps** (`cancelled_at`, `recorded_at`, `signup_time`): Stored as `TIMESTAMP` (with timezone, typically UTC)

### Backend (`backend/utils/dateUtils.js`)

**Issues:**
1. **`parseDate()` for YYYY-MM-DD**: Uses `new Date(year, month - 1, day)` which creates dates in the **server's local timezone**
   - Comment says "assuming server is in America/Toronto" but this is **fragile**
   - If server is in UTC or another timezone, dates will be wrong

2. **`combineDateTime()`**: Uses `setHours()` which operates in the **server's local timezone**
   - Has TODO comments acknowledging this is a problem
   - No actual timezone handling - just assumes server timezone = Toronto

3. **No timezone library**: Relies on server timezone configuration

### Frontend (`src/utils/dateUtils.js`)

**Issues:**
1. **Manual EST/EDT detection**: Hardcoded logic to determine if date is in EDT
   ```javascript
   const isEDT = (monthNum > 3 && monthNum < 11) || 
                 (monthNum === 3 && dayNum >= 10) || 
                 (monthNum === 11 && dayNum <= 3);
   ```
   - **Problem**: DST transitions are not on fixed dates - they're on specific Sundays
   - This will be wrong for some dates near DST boundaries
   - Example: In 2025, DST starts March 9 (2nd Sunday) and ends November 2 (1st Sunday)

2. **Hardcoded offsets**: Uses `-04:00` or `-05:00` strings
   - Doesn't account for actual DST rules
   - Could be wrong for dates near DST transitions

### Display Issues

**Inconsistent approaches:**
1. Some places use `toLocaleDateString()` without timezone (uses browser timezone)
2. Some use `Date.UTC()` + `toLocaleDateString(undefined, { timeZone: 'UTC' })`
3. Some use `new Date(Date.UTC(y,m-1,d))` for parsing
4. No consistent pattern across components

**Examples:**
- `WorkoutDetail.js`: Uses `Date.UTC()` + `timeZone: 'UTC'` for dates
- `Forum.js`: Has `parseDateOnlyUTC()` function that uses `Date.UTC()`
- `Admin.js`: Uses `new Date().toLocaleDateString()` without timezone
- Many places: Just use `new Date(dateString).toLocaleDateString()`

## Problems This Causes

1. **12-Hour Cancellation Window**: 
   - If server timezone ≠ Toronto, calculations will be wrong
   - If frontend timezone handling is wrong, users see incorrect warnings

2. **Date Display Confusion**:
   - Users in different timezones might see different dates
   - Workout on "Dec 19" might show as "Dec 18" for users in PST

3. **DST Transition Issues**:
   - Manual EDT detection will fail on DST boundary dates
   - Could cause 1-hour errors in calculations

4. **Server Deployment Issues**:
   - Requires server to be in America/Toronto timezone
   - Not portable to cloud services that default to UTC

## Recommended Solution

### Option 1: Use a Timezone Library (RECOMMENDED)

**Use `date-fns-tz` or `luxon`** to properly handle timezones:

```javascript
// Example with date-fns-tz
import { zonedTimeToUtc, utcToZonedTime, format } from 'date-fns-tz';

// When creating workout datetime
const torontoTime = 'America/Toronto';
const workoutDateTime = zonedTimeToUtc(
  `${workoutDate}T${workoutTime}`,
  torontoTime
);

// When displaying
const displayTime = format(
  utcToZonedTime(workoutDateTime, torontoTime),
  'MMM d, yyyy h:mm a',
  { timeZone: torontoTime }
);
```

**Benefits:**
- Handles DST automatically
- Works regardless of server timezone
- Consistent across frontend/backend
- No manual date calculations

### Option 2: Store Timezone-Aware Timestamps

**Change database schema:**
- Store `workout_datetime` as `TIMESTAMP WITH TIME ZONE` instead of separate DATE + TIME
- Store timezone explicitly: `'America/Toronto'`

**Benefits:**
- Database handles timezone conversions
- Single source of truth
- PostgreSQL has excellent timezone support

**Drawbacks:**
- Requires migration
- More complex queries

### Option 3: Store Everything in UTC, Display in Toronto

**Current approach but done correctly:**
- Store workout datetime as UTC timestamp
- Always convert to/from Toronto timezone for display
- Use timezone library for conversions

**Benefits:**
- Works with current schema (mostly)
- Clear separation: storage (UTC) vs display (Toronto)

## My Recommendation

**Use Option 1 (timezone library) + Option 3 (UTC storage):**

1. **Install `date-fns-tz`** (lightweight, modern, well-maintained)
2. **Backend**: Always interpret workout date/time as America/Toronto, convert to UTC for storage
3. **Frontend**: Always display in America/Toronto timezone
4. **Database**: Keep current schema (DATE + TIME) OR migrate to TIMESTAMP WITH TIME ZONE
5. **Consistent display**: Always use timezone-aware formatting

**Implementation steps:**
1. Add `date-fns-tz` to both frontend and backend
2. Update `combineDateTime()` to use timezone library
3. Update all display functions to use timezone-aware formatting
4. Remove manual EST/EDT detection
5. Add tests for DST transitions

## Current Workarounds

The codebase has several workarounds that indicate awareness of the problem:
- Comments like "assuming server is in America/Toronto"
- TODO comments about using a timezone library
- Manual EDT detection in frontend
- SQL queries that explicitly set timezone: `SET timezone = 'America/Toronto'`

These are **band-aids** that work in specific conditions but are fragile.

## Implementation Status

### ✅ Completed (2025-01-XX)

**Installed `date-fns-tz` library:**
- ✅ Added to frontend (`package.json`)
- ✅ Added to backend (`backend/package.json`)

**Updated Backend (`backend/utils/dateUtils.js`):**
- ✅ `combineDateTime()` now uses `zonedTimeToUtc()` to properly convert Toronto time to UTC
- ✅ Handles DST transitions automatically
- ✅ No longer relies on server timezone
- ✅ Updated `formatDateForDisplay()` and `formatDateTimeForDisplay()` to accept `isWorkoutTime` parameter
- ✅ Exported `TORONTO_TIMEZONE` constant

**Updated Frontend (`src/utils/dateUtils.js`):**
- ✅ `combineDateTime()` now uses `zonedTimeToUtc()` instead of manual EST/EDT detection
- ✅ Removed error-prone manual DST detection code
- ✅ Updated display functions to accept `isWorkoutTime` parameter
- ✅ Exported `TORONTO_TIMEZONE` constant

**Verified:**
- ✅ Signup timestamps use `CURRENT_TIMESTAMP` (UTC) - correct, no changes needed
- ✅ Cancellation timestamps use `CURRENT_TIMESTAMP` (UTC) - correct, no changes needed
- ✅ All user action timestamps remain in UTC (no timezone assumption)

### 🔄 Remaining Work

**Update display calls to use `isWorkoutTime` parameter:**
- ⏳ `WorkoutDetail.js` - workout date/time display
- ⏳ `Forum.js` - workout date display in list
- ⏳ `Admin.js` - workout date display in attendance dashboard
- ⏳ Other components displaying workout dates/times

**Testing needed:**
- ⏳ Test DST transition dates (March/November)
- ⏳ Test 12-hour cancellation window calculations
- ⏳ Verify workout times display correctly in Toronto timezone
- ⏳ Verify signup times display correctly (UTC, no timezone assumption)

## Conclusion

**Implementation is in progress:**
- ✅ Core timezone handling now uses proper library
- ✅ Workout times correctly interpreted as Toronto timezone
- ✅ User timestamps correctly remain in UTC
- ⏳ Display functions need to be updated to use new `isWorkoutTime` parameter
- ⏳ Testing needed to verify correctness

**Key Principle:**
- **Workout date/time**: Always interpreted as America/Toronto (EST/EDT)
- **User action timestamps**: Always UTC (no timezone assumption)

