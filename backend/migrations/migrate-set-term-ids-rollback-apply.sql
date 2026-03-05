-- Reverse migration script to clear term_id set by migrate-set-term-ids
-- ⚠️  THIS VERSION APPLIES THE CHANGES (uses COMMIT instead of ROLLBACK)
--    Use migrate-set-term-ids-rollback.sql for a dry-run preview first
-- 
-- This migration will:
-- - Set term_id to NULL for users who were updated by migrate-set-term-ids
-- - Only affects users with term_id matching 'fall' or 'fall/winter' terms
-- - Preserves term_id for users who had it set before this migration
--
-- ⚠️  WARNING: This is a destructive operation. Use with caution.
--    Consider backing up your database before running.
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- ============================================================================
-- MIGRATION LOGGING
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Reverse Migration: set-term-ids-rollback (APPLY)';
  RAISE NOTICE 'Started at: %', NOW();
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- VALIDATION
-- ============================================================================

-- Check which users would be affected
DO $$
DECLARE
  users_to_rollback INTEGER;
  fall_term_id INTEGER;
  fall_winter_term_id INTEGER;
BEGIN
  -- Get term IDs
  SELECT id INTO fall_term_id FROM terms WHERE term = 'fall';
  SELECT id INTO fall_winter_term_id FROM terms WHERE term = 'fall/winter';
  
  IF fall_term_id IS NULL OR fall_winter_term_id IS NULL THEN
    RAISE EXCEPTION 'Required terms (fall or fall/winter) do not exist. Cannot determine which users to rollback.';
  END IF;
  
  -- Count users that would be affected
  SELECT COUNT(*) INTO users_to_rollback
  FROM users
  WHERE term_id IN (fall_term_id, fall_winter_term_id)
    AND role != 'pending';
  
  RAISE NOTICE '[METRICS] Users that will have term_id cleared: %', users_to_rollback;
  
  IF users_to_rollback = 0 THEN
    RAISE WARNING 'No users found with fall or fall/winter term_id. Nothing to rollback.';
  END IF;
END $$;

-- Show sample of what will be rolled back
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  u.term_id as current_term_id,
  t.term as current_term_name,
  NULL::INTEGER as proposed_term_id
FROM users u
JOIN terms t ON u.term_id = t.id
WHERE u.term_id IN (
  SELECT id FROM terms WHERE term IN ('fall', 'fall/winter')
)
AND u.role != 'pending'
ORDER BY u.id
LIMIT 10;

-- Show summary before rollback
SELECT 
  'Before Rollback' as step,
  COUNT(*) FILTER (WHERE u.term_id IS NOT NULL) as users_with_term_id,
  COUNT(*) FILTER (WHERE u.term_id IN (SELECT id FROM terms WHERE term IN ('fall', 'fall/winter'))) as users_with_fall_terms,
  COUNT(*) FILTER (WHERE u.term_id IS NULL AND u.role != 'pending') as users_without_term_id
FROM users u;

-- ============================================================================
-- ROLLBACK OPERATION
-- ============================================================================

DO $$
DECLARE
  rollback_start_time TIMESTAMP;
BEGIN
  rollback_start_time := clock_timestamp();
  RAISE NOTICE '[%] Starting ROLLBACK operation...', rollback_start_time;
END $$;

-- Clear term_id for users with fall or fall/winter terms
UPDATE users u
SET term_id = NULL
WHERE u.term_id IN (
  SELECT id FROM terms WHERE term IN ('fall', 'fall/winter')
)
AND u.role != 'pending';

-- Log rollback results using GET DIAGNOSTICS pattern
DO $$
DECLARE
  rows_updated INTEGER;
  users_still_with_term INTEGER;
  users_now_null INTEGER;
  rollback_end_time TIMESTAMP;
BEGIN
  -- Get actual row count from UPDATE (approximate)
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  SELECT 
    COUNT(*) FILTER (WHERE term_id IS NOT NULL),
    COUNT(*) FILTER (WHERE term_id IS NULL AND role != 'pending')
  INTO users_still_with_term, users_now_null
  FROM users;
  
  rollback_end_time := clock_timestamp();
  
  RAISE NOTICE '[%] ROLLBACK operation completed', rollback_end_time;
  RAISE NOTICE '[METRICS] Rows updated: %', rows_updated;
  RAISE NOTICE '[METRICS] Users still with term_id: %', users_still_with_term;
  RAISE NOTICE '[METRICS] Users now with NULL term_id: %', users_now_null;
END $$;

-- Show summary after rollback
SELECT 
  'After Rollback' as step,
  COUNT(*) FILTER (WHERE u.term_id IS NOT NULL) as users_with_term_id,
  COUNT(*) FILTER (WHERE u.term_id IN (SELECT id FROM terms WHERE term IN ('fall', 'fall/winter'))) as users_with_fall_terms,
  COUNT(*) FILTER (WHERE u.term_id IS NULL AND u.role != 'pending') as users_without_term_id
FROM users u;

-- Final summary log
DO $$
DECLARE
  migration_end_time TIMESTAMP;
BEGIN
  migration_end_time := clock_timestamp();
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '[%] Rollback Summary', migration_end_time;
  RAISE NOTICE '========================================';
END $$;

-- ⚠️  IMPORTANT: Review the SELECT output above before committing!
-- The transaction will COMMIT after this point, applying all changes permanently.
-- If something looks wrong, run ROLLBACK; before this line to abort.
--
-- Summary of what will be committed:
--   - term_id set to NULL for users with 'fall' or 'fall/winter' terms
COMMIT;

