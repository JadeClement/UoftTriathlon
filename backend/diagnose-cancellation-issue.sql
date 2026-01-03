-- Diagnostic SQL to investigate cancellation time logic issues
-- This will show how workout times and cancellation times are being compared

SET timezone = 'America/Toronto';

-- Get recent cancellations with detailed time calculations
SELECT 
  wc.post_id,
  fp.title as workout_title,
  u.name as user_name,
  fp.workout_date,
  fp.workout_time,
  -- Workout datetime in Toronto timezone
  (fp.workout_date::timestamp + fp.workout_time::time) AS workout_datetime_toronto,
  -- Cancelled at (stored as timestamp, likely UTC)
  wc.cancelled_at AS cancelled_at_raw,
  -- Convert cancelled_at to Toronto timezone (assuming it was stored as UTC)
  (wc.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto') AS cancelled_at_toronto,
  -- Calculate hours difference (workout - cancelled)
  EXTRACT(EPOCH FROM (
    (fp.workout_date::timestamp + fp.workout_time::time) - 
    (wc.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto')
  )) / 3600.0 AS hours_diff,
  -- What should within_12hrs be?
  CASE 
    WHEN EXTRACT(EPOCH FROM (
      (fp.workout_date::timestamp + fp.workout_time::time) - 
      (wc.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto')
    )) / 3600.0 BETWEEN 0 AND 12 THEN true
    ELSE false
  END AS should_be_within_12hrs,
  -- What is currently stored?
  wc.within_12hrs AS stored_within_12hrs,
  wc.marked_absent AS stored_marked_absent,
  -- Check if there's a mismatch
  CASE 
    WHEN (CASE 
      WHEN EXTRACT(EPOCH FROM (
        (fp.workout_date::timestamp + fp.workout_time::time) - 
        (wc.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto')
      )) / 3600.0 BETWEEN 0 AND 12 THEN true
      ELSE false
    END) != wc.within_12hrs THEN '❌ MISMATCH'
    ELSE '✅ OK'
  END AS status
FROM workout_cancellations wc
JOIN forum_posts fp ON wc.post_id = fp.id
JOIN users u ON wc.user_id = u.id
WHERE fp.type = 'workout'
ORDER BY wc.cancelled_at DESC
LIMIT 20;

-- Summary: Count mismatches
SELECT 
  COUNT(*) as total_cancellations,
  COUNT(CASE WHEN 
    (CASE 
      WHEN EXTRACT(EPOCH FROM (
        (fp.workout_date::timestamp + fp.workout_time::time) - 
        (wc.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto')
      )) / 3600.0 BETWEEN 0 AND 12 THEN true
      ELSE false
    END) != wc.within_12hrs 
    THEN 1 END) as mismatches,
  COUNT(CASE WHEN 
    (CASE 
      WHEN EXTRACT(EPOCH FROM (
        (fp.workout_date::timestamp + fp.workout_time::time) - 
        (wc.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto')
      )) / 3600.0 BETWEEN 0 AND 12 THEN true
      ELSE false
    END) = wc.within_12hrs 
    THEN 1 END) as correct
FROM workout_cancellations wc
JOIN forum_posts fp ON wc.post_id = fp.id
WHERE fp.type = 'workout';



