-- Fix workout cancellations that happened between 12-24 hours before workout
-- These should not be marked as absences

-- Step 1: Identify cancellations that happened between 12-24 hours before workout
-- and are currently marked as absent
WITH cancellations_to_fix AS (
  SELECT 
    wc.id,
    wc.post_id,
    wc.user_id,
    wc.cancelled_at,
    wc.marked_absent,
    wc.within_12hrs,
    fp.workout_date,
    fp.workout_time,
    -- Calculate workout datetime
    CASE 
      WHEN fp.workout_time IS NOT NULL THEN
        (fp.workout_date::date + fp.workout_time::time)::timestamp
      ELSE
        fp.workout_date::timestamp
    END as workout_datetime,
    -- Calculate hours between cancellation and workout
    EXTRACT(EPOCH FROM (
      CASE 
        WHEN fp.workout_time IS NOT NULL THEN
          (fp.workout_date::date + fp.workout_time::time)::timestamp
        ELSE
          fp.workout_date::timestamp
      END - wc.cancelled_at
    )) / 3600.0 as hours_before_workout
  FROM workout_cancellations wc
  JOIN forum_posts fp ON wc.post_id = fp.id
  WHERE wc.marked_absent = true
    -- Cancellation happened between 12 and 24 hours before workout
    AND EXTRACT(EPOCH FROM (
      CASE 
        WHEN fp.workout_time IS NOT NULL THEN
          (fp.workout_date::date + fp.workout_time::time)::timestamp
        ELSE
          fp.workout_date::timestamp
      END - wc.cancelled_at
    )) / 3600.0 BETWEEN 12 AND 24
)
-- Step 2: Show what will be fixed
SELECT 
  id,
  post_id,
  user_id,
  cancelled_at,
  workout_datetime,
  ROUND(hours_before_workout, 2) as hours_before_workout,
  marked_absent,
  within_12hrs
FROM cancellations_to_fix
ORDER BY cancelled_at DESC;

-- Step 3: Update cancellations to mark as NOT absent
-- This updates records where cancellation was between 12-24 hours before workout
UPDATE workout_cancellations wc
SET 
  marked_absent = false,
  within_12hrs = false
FROM forum_posts fp
WHERE wc.post_id = fp.id
  AND wc.marked_absent = true
  -- Cancellation happened between 12 and 24 hours before workout
  AND EXTRACT(EPOCH FROM (
    CASE 
      WHEN fp.workout_time IS NOT NULL THEN
        (fp.workout_date::date + fp.workout_time::time)::timestamp
      ELSE
        fp.workout_date::timestamp
    END - wc.cancelled_at
  )) / 3600.0 BETWEEN 12 AND 24;

-- Step 4: Decrement absence counts for users who had absences incorrectly counted
-- This finds users who had cancellations marked as absent that are now being fixed
WITH cancellations_fixed AS (
  SELECT DISTINCT wc.user_id
  FROM workout_cancellations wc
  JOIN forum_posts fp ON wc.post_id = fp.id
  WHERE wc.marked_absent = false  -- After the update above
    AND EXTRACT(EPOCH FROM (
      CASE 
        WHEN fp.workout_time IS NOT NULL THEN
          (fp.workout_date::date + fp.workout_time::time)::timestamp
        ELSE
          fp.workout_date::timestamp
      END - wc.cancelled_at
    )) / 3600.0 BETWEEN 12 AND 24
)
UPDATE users u
SET absences = GREATEST(0, absences - 1)
FROM cancellations_fixed cf
WHERE u.id = cf.user_id
  AND u.absences > 0;

-- Step 5: Remove workout_attendance records that were created by these cancellations
-- Only remove if the attendance record was created around the same time as cancellation
DELETE FROM workout_attendance wa
WHERE EXISTS (
  SELECT 1
  FROM workout_cancellations wc
  JOIN forum_posts fp ON wc.post_id = fp.id
  WHERE wc.post_id = wa.post_id
    AND wc.user_id = wa.user_id
    AND wa.attended = false
    AND wc.marked_absent = false  -- After the update above
    AND EXTRACT(EPOCH FROM (
      CASE 
        WHEN fp.workout_time IS NOT NULL THEN
          (fp.workout_date::date + fp.workout_time::time)::timestamp
        ELSE
          fp.workout_date::timestamp
      END - wc.cancelled_at
    )) / 3600.0 BETWEEN 12 AND 24
    -- Attendance was recorded within 5 minutes of cancellation (likely auto-created)
    AND ABS(EXTRACT(EPOCH FROM (wa.recorded_at - wc.cancelled_at))) < 300
);

-- Step 6: Verify the fix - show summary
SELECT 
  'Summary' as info,
  COUNT(*) FILTER (WHERE marked_absent = true) as still_marked_absent,
  COUNT(*) FILTER (WHERE marked_absent = false AND within_12hrs = false) as fixed_cancellations,
  COUNT(*) as total_cancellations
FROM workout_cancellations wc
JOIN forum_posts fp ON wc.post_id = fp.id
WHERE EXTRACT(EPOCH FROM (
  CASE 
    WHEN fp.workout_time IS NOT NULL THEN
      (fp.workout_date::date + fp.workout_time::time)::timestamp
    ELSE
      fp.workout_date::timestamp
  END - wc.cancelled_at
)) / 3600.0 BETWEEN 12 AND 24;

