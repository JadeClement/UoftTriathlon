-- Migration script to set term_id for users based on expiry_date
-- ⚠️  DRY-RUN PREVIEW: This file ends with ROLLBACK - it does NOT apply changes
--    Use migrate-set-term-ids-apply.sql to actually apply the migration
-- 
-- Rules:
-- - If expiry_date is in 2025 → term_id = 'fall'
-- - If expiry_date is NOT in 2025 → term_id = 'fall/winter'
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- ============================================================================
-- CONFIGURATION CONSTANTS
-- ============================================================================
-- Update these date values if the migration rules change
-- These define the year boundaries for term assignment:
--   - Users with expiry_date in 2025 (>= 2025-01-01 AND < 2026-01-01) → 'fall'
--   - All other users → 'fall/winter'
--
-- To change the logic, update the dates below in all queries that reference them

-- Check if expiry_date column exists (it may have been removed in a later migration)
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'expiry_date'
  ) INTO column_exists;
  
  IF NOT column_exists THEN
    RAISE EXCEPTION 'expiry_date column does not exist in users table. This migration cannot run. Users may already have term_id set via a different migration path.';
  END IF;
END $$;

-- Check if migration has already been run
-- If all non-pending users have term_id set, this migration may have already completed
DO $$
DECLARE
  users_needing_update INTEGER;
  total_non_pending_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_needing_update
  FROM users
  WHERE term_id IS NULL AND role != 'pending';
  
  SELECT COUNT(*) INTO total_non_pending_users
  FROM users
  WHERE role != 'pending';
  
  IF users_needing_update = 0 AND total_non_pending_users > 0 THEN
    RAISE WARNING 'All non-pending users already have term_id set. This migration may have already been run.';
  ELSIF users_needing_update = 0 THEN
    RAISE WARNING 'No non-pending users found. Nothing to migrate.';
  ELSE
    RAISE NOTICE 'Migration will update % users out of % non-pending users.', users_needing_update, total_non_pending_users;
  END IF;
END $$;

-- First, create the terms if they don't exist
-- Note: You'll need to set appropriate start_date and end_date for these terms
INSERT INTO terms (term, start_date, end_date)
VALUES 
  ('fall', '2024-09-01', '2024-12-31'),
  ('fall/winter', '2024-09-01', '2025-04-30')
ON CONFLICT (term) DO NOTHING;

-- Validate that required terms exist before proceeding
DO $$
DECLARE
  fall_term_id INTEGER;
  fall_winter_term_id INTEGER;
BEGIN
  SELECT id INTO fall_term_id FROM terms WHERE term = 'fall';
  SELECT id INTO fall_winter_term_id FROM terms WHERE term = 'fall/winter';
  
  IF fall_term_id IS NULL THEN
    RAISE EXCEPTION 'Required term ''fall'' does not exist and could not be created.';
  END IF;
  
  IF fall_winter_term_id IS NULL THEN
    RAISE EXCEPTION 'Required term ''fall/winter'' does not exist and could not be created.';
  END IF;
  
  RAISE NOTICE 'Validation passed: Both required terms exist (fall: %, fall/winter: %)', 
    fall_term_id, fall_winter_term_id;
END $$;

-- Show which terms exist
SELECT id, term, start_date, end_date FROM terms WHERE term IN ('fall', 'fall/winter');

-- Show how many users will be affected
-- Constants: FALL_YEAR_START = '2025-01-01', FALL_YEAR_END = '2026-01-01'
WITH migration_constants AS (
  SELECT 
    '2025-01-01'::DATE as fall_year_start,
    '2026-01-01'::DATE as fall_year_end
)
SELECT 
  'Users to update' as info,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE expiry_date >= (SELECT fall_year_start FROM migration_constants) 
                         AND expiry_date < (SELECT fall_year_end FROM migration_constants)) as expiry_in_2025,
  COUNT(*) FILTER (WHERE expiry_date IS NULL 
                         OR expiry_date < (SELECT fall_year_start FROM migration_constants) 
                         OR expiry_date >= (SELECT fall_year_end FROM migration_constants)) as expiry_not_in_2025
FROM users
WHERE term_id IS NULL
  AND role != 'pending';

-- Show sample of what will be updated
-- Constants: FALL_YEAR_START = '2025-01-01', FALL_YEAR_END = '2026-01-01'
WITH migration_constants AS (
  SELECT 
    '2025-01-01'::DATE as fall_year_start,
    '2026-01-01'::DATE as fall_year_end,
    'fall'::VARCHAR(50) as fall_term_name,
    'fall/winter'::VARCHAR(50) as fall_winter_term_name
)
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  u.expiry_date,
  u.term_id as current_term_id,
  CASE 
    WHEN u.expiry_date >= c.fall_year_start AND u.expiry_date < c.fall_year_end 
    THEN c.fall_term_name
    ELSE c.fall_winter_term_name
  END as proposed_term,
  (SELECT id FROM terms WHERE term = CASE 
    WHEN u.expiry_date >= c.fall_year_start AND u.expiry_date < c.fall_year_end 
    THEN c.fall_term_name
    ELSE c.fall_winter_term_name
  END) as proposed_term_id
FROM users u
CROSS JOIN migration_constants c
WHERE u.term_id IS NULL
  AND u.role != 'pending'
ORDER BY u.expiry_date DESC NULLS LAST
LIMIT 10;

-- Update term_id based on expiry_date
-- Constants: FALL_YEAR_START = '2025-01-01', FALL_YEAR_END = '2026-01-01'
WITH migration_constants AS (
  SELECT 
    '2025-01-01'::DATE as fall_year_start,
    '2026-01-01'::DATE as fall_year_end,
    'fall'::VARCHAR(50) as fall_term_name,
    'fall/winter'::VARCHAR(50) as fall_winter_term_name
)
UPDATE users u
SET term_id = (
  SELECT t.id 
  FROM terms t
  CROSS JOIN migration_constants c
  WHERE t.term = CASE 
    WHEN u.expiry_date >= c.fall_year_start AND u.expiry_date < c.fall_year_end 
    THEN c.fall_term_name
    ELSE c.fall_winter_term_name
  END
)
WHERE u.term_id IS NULL
  AND u.role != 'pending';

-- Show summary (optimized with JOINs instead of subqueries)
SELECT 
  'Summary' as step,
  COUNT(*) FILTER (WHERE u.term_id IS NOT NULL) as users_with_term_id,
  COUNT(*) FILTER (WHERE u.term_id IS NULL AND u.role != 'pending') as users_still_null,
  COUNT(*) FILTER (WHERE u.term_id = t_fall.id) as users_with_fall,
  COUNT(*) FILTER (WHERE u.term_id = t_fall_winter.id) as users_with_fall_winter
FROM users u
CROSS JOIN (SELECT id FROM terms WHERE term = 'fall') t_fall
CROSS JOIN (SELECT id FROM terms WHERE term = 'fall/winter') t_fall_winter;

-- ⚠️  DRY-RUN MODE: This script ends with ROLLBACK
-- Review the SELECT output above to see what would be changed
-- 
-- To actually apply this migration:
--   1. Review all the SELECT output above
--   2. If everything looks correct, change ROLLBACK to COMMIT below
--   3. Or use migrate-set-term-ids-apply.sql which already has COMMIT
--
-- If something is wrong, just run ROLLBACK (or close connection)
ROLLBACK;

