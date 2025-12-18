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
-- MIGRATION LOGGING
-- ============================================================================
-- Create logging function for structured output
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration: set-term-ids (DRY-RUN)';
  RAISE NOTICE 'Started at: %', NOW();
  RAISE NOTICE '========================================';
END $$;

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

-- Verify indexes exist for optimal UPDATE performance
DO $$
DECLARE
  has_term_id_index BOOLEAN;
  has_role_index BOOLEAN;
  has_expiry_date_index BOOLEAN;
BEGIN
  -- Check for index on term_id (used in WHERE clause)
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' 
    AND indexname LIKE '%term_id%'
  ) INTO has_term_id_index;
  
  -- Check for index on role (used in WHERE clause)
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' 
    AND indexname LIKE '%role%'
  ) INTO has_role_index;
  
  -- Check for index on expiry_date (used in CASE expression)
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' 
    AND indexname LIKE '%expiry_date%'
  ) INTO has_expiry_date_index;
  
  RAISE NOTICE '[INDEX CHECK] term_id index: %', CASE WHEN has_term_id_index THEN 'EXISTS' ELSE 'MISSING (may impact performance)' END;
  RAISE NOTICE '[INDEX CHECK] role index: %', CASE WHEN has_role_index THEN 'EXISTS' ELSE 'MISSING (may impact performance)' END;
  RAISE NOTICE '[INDEX CHECK] expiry_date index: %', CASE WHEN has_expiry_date_index THEN 'EXISTS' ELSE 'MISSING (may impact performance)' END;
  
  IF NOT has_term_id_index OR NOT has_role_index THEN
    RAISE WARNING '[PERFORMANCE] Consider adding indexes: CREATE INDEX idx_users_term_id_role ON users(term_id, role) WHERE role != ''pending'';';
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
DO $$
DECLARE
  update_start_time TIMESTAMP;
BEGIN
  update_start_time := clock_timestamp();
  RAISE NOTICE '[%] Starting UPDATE operation (DRY-RUN - will be rolled back)...', update_start_time;
END $$;

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

-- Log update results (using GET DIAGNOSTICS would require a function, so we count instead)
DO $$
DECLARE
  rows_that_would_update INTEGER;
  update_end_time TIMESTAMP;
BEGIN
  -- Count how many rows would be affected (since this is dry-run, we check before the rollback)
  SELECT COUNT(*) INTO rows_that_would_update
  FROM users u
  WHERE u.term_id IS NULL 
    AND u.role != 'pending'
    AND u.expiry_date IS NOT NULL;
  
  update_end_time := clock_timestamp();
  RAISE NOTICE '[%] UPDATE operation completed (DRY-RUN)', update_end_time;
  RAISE NOTICE '[METRICS] Estimated rows that would be updated: %', rows_that_would_update;
END $$;

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

-- Final migration summary log
DO $$
DECLARE
  total_with_term_id INTEGER;
  total_still_null INTEGER;
  total_fall INTEGER;
  total_fall_winter INTEGER;
  migration_end_time TIMESTAMP;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE term_id IS NOT NULL),
    COUNT(*) FILTER (WHERE term_id IS NULL AND role != 'pending'),
    COUNT(*) FILTER (WHERE term_id = (SELECT id FROM terms WHERE term = 'fall')),
    COUNT(*) FILTER (WHERE term_id = (SELECT id FROM terms WHERE term = 'fall/winter'))
  INTO total_with_term_id, total_still_null, total_fall, total_fall_winter
  FROM users;
  
  migration_end_time := clock_timestamp();
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '[%] Migration Summary (DRY-RUN)', migration_end_time;
  RAISE NOTICE '[METRICS] Users with term_id: %', total_with_term_id;
  RAISE NOTICE '[METRICS] Users still null: %', total_still_null;
  RAISE NOTICE '[METRICS] Users with fall term: %', total_fall;
  RAISE NOTICE '[METRICS] Users with fall/winter term: %', total_fall_winter;
  RAISE NOTICE '========================================';
END $$;

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

