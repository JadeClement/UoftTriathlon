-- Migration script to fix historical cancellation timezone issues
-- 
-- This script:
-- 1. Recalculates within_12hrs for all existing cancellations using local-time logic
-- 2. Updates workout_cancellations table
-- 3. Fixes marked_absent flags
-- 4. Adjusts users.absences counts accordingly
--
-- IMPORTANT: If you see negative hours_diff values, it means cancelled_at was likely
-- stored in UTC. In that case, uncomment the alternative calculation below that
-- explicitly treats cancelled_at as UTC.
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- First, let's see what we're working with
SELECT 
  'Diagnostics' as step,
  (SELECT COUNT(*) FROM workout_cancellations) as total_cancellations,
  (SELECT COUNT(*) FROM forum_posts WHERE type = 'workout') as total_workouts,
  (SELECT COUNT(*) FROM workout_cancellations wc 
   JOIN forum_posts fp ON wc.post_id = fp.id 
   WHERE fp.type = 'workout') as cancellations_with_workouts;

-- Set timezone to Toronto for consistent calculations
SET timezone = 'America/Toronto';

-- NOTE: cancelled_at was stored in UTC in the past, so we need to convert it to Toronto time

-- Create a temporary table with recalculated values
CREATE TEMP TABLE cancellation_fixes AS
SELECT 
  wc.post_id,
  wc.user_id,
  wc.cancelled_at,
  wc.within_12hrs AS old_within_12hrs,
  wc.marked_absent AS old_marked_absent,
  fp.workout_date,
  fp.workout_time,
  -- Combine workout date and time as local timestamp
  -- With session timezone set to America/Toronto, this will be interpreted in Toronto time
  (fp.workout_date::timestamp + fp.workout_time::time) AS workout_datetime,
  -- cancelled_at was stored in UTC in the past, so we need to convert it to Toronto time
  -- AT TIME ZONE 'UTC' treats the timestamp as UTC, then AT TIME ZONE 'America/Toronto' converts to Toronto
  (wc.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto') AS cancelled_at_toronto,
  -- Calculate hours between workout and cancellation
  -- Both are now in Toronto timezone for comparison
  -- Positive means workout is in the future from cancellation time
  EXTRACT(EPOCH FROM (
    (fp.workout_date::timestamp + fp.workout_time::time) - 
    (wc.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto')
  )) / 3600.0 AS hours_diff,
  -- New calculation: within 12 hours means workout is 0-12 hours in the future
  CASE 
    WHEN EXTRACT(EPOCH FROM (
      (fp.workout_date::timestamp + fp.workout_time::time) - 
      (wc.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto')
    )) / 3600.0 BETWEEN 0 AND 12 THEN true
    ELSE false
  END AS new_within_12hrs
FROM workout_cancellations wc
JOIN forum_posts fp ON wc.post_id = fp.id
WHERE fp.type = 'workout';

-- Show what will change
SELECT 
  'Records that will change' as info,
  COUNT(*) as count
FROM cancellation_fixes
WHERE old_within_12hrs != new_within_12hrs;

-- Show details of records that will change
SELECT 
  post_id,
  user_id,
  workout_date,
  workout_time,
  workout_datetime,
  cancelled_at,
  cancelled_at_toronto,
  ROUND(hours_diff::numeric, 2) as hours_diff,
  old_within_12hrs,
  new_within_12hrs,
  CASE 
    WHEN old_within_12hrs = false AND new_within_12hrs = true THEN 'Will add absence'
    WHEN old_within_12hrs = true AND new_within_12hrs = false THEN 'Will remove absence'
    ELSE 'No change'
  END AS action
FROM cancellation_fixes
WHERE old_within_12hrs != new_within_12hrs
ORDER BY cancelled_at DESC;

-- Show records with negative hours_diff (shouldn't happen - indicates timezone issue)
SELECT 
  'WARNING: Negative hours_diff detected' as warning,
  post_id,
  user_id,
  workout_date,
  workout_time,
  workout_datetime,
  cancelled_at,
  ROUND(hours_diff::numeric, 2) as hours_diff,
  'Cancellation appears to be AFTER workout time!' as issue
FROM cancellation_fixes
WHERE hours_diff < 0
ORDER BY hours_diff ASC;

-- Update workout_cancellations with new values
UPDATE workout_cancellations wc
SET 
  within_12hrs = cf.new_within_12hrs,
  marked_absent = cf.new_within_12hrs
FROM cancellation_fixes cf
WHERE wc.post_id = cf.post_id 
  AND wc.user_id = cf.user_id
  AND cf.old_within_12hrs != cf.new_within_12hrs;

-- Handle attendance records and absences for records that changed from false to true
-- (Need to add absence)
INSERT INTO workout_attendance (post_id, user_id, attended, recorded_at)
SELECT 
  cf.post_id,
  cf.user_id,
  false,
  cf.cancelled_at
FROM cancellation_fixes cf
WHERE cf.old_within_12hrs = false 
  AND cf.new_within_12hrs = true
ON CONFLICT (post_id, user_id) DO UPDATE SET
  attended = false,
  recorded_at = EXCLUDED.recorded_at;

-- Increment absences for users who should now have an absence
UPDATE users u
SET absences = absences + 1
FROM cancellation_fixes cf
WHERE u.id = cf.user_id
  AND cf.old_within_12hrs = false 
  AND cf.new_within_12hrs = true;

-- Handle attendance records and absences for records that changed from true to false
-- (Need to remove absence)
DELETE FROM workout_attendance wa
USING cancellation_fixes cf
WHERE wa.post_id = cf.post_id 
  AND wa.user_id = cf.user_id
  AND cf.old_within_12hrs = true 
  AND cf.new_within_12hrs = false;

-- Decrement absences for users who should no longer have an absence
UPDATE users u
SET absences = GREATEST(0, absences - 1)
FROM cancellation_fixes cf
WHERE u.id = cf.user_id
  AND cf.old_within_12hrs = true 
  AND cf.new_within_12hrs = false;

-- Show summary
SELECT 
  'Summary' as step,
  (SELECT COUNT(*) FROM cancellation_fixes WHERE old_within_12hrs != new_within_12hrs) as records_updated,
  (SELECT COUNT(*) FROM cancellation_fixes WHERE old_within_12hrs = false AND new_within_12hrs = true) as absences_added,
  (SELECT COUNT(*) FROM cancellation_fixes WHERE old_within_12hrs = true AND new_within_12hrs = false) as absences_removed;

-- Clean up temp table
DROP TABLE cancellation_fixes;

-- Review the changes before committing
-- If everything looks good, run: COMMIT;
-- If something is wrong, run: ROLLBACK;

-- For now, let's just show what would happen (ROLLBACK at the end)
-- Remove the ROLLBACK and add COMMIT when you're ready to apply changes
ROLLBACK;

