-- Migration template for creating new migrations (APPLY VERSION)
-- Copy this file and rename it to migrate-{your-migration-name}-apply.sql
-- 
-- Description: [Brief description of what this migration does]
-- ⚠️  THIS VERSION APPLIES THE CHANGES (uses COMMIT instead of ROLLBACK)
--    Use migrate-{your-migration-name}.sql for a dry-run preview first
-- 
-- Rules/Logic: [Describe any business rules or logic]
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- ============================================================================
-- MIGRATION LOGGING
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration: {your-migration-name} (APPLY)';
  RAISE NOTICE 'Started at: %', NOW();
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- CONFIGURATION CONSTANTS (if needed)
-- ============================================================================
-- Update these values if the migration rules change

-- ============================================================================
-- VALIDATION CHECKS
-- ============================================================================

-- Check if required columns/tables exist
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'your_table' 
    AND column_name = 'your_column'
  ) INTO column_exists;
  
  IF NOT column_exists THEN
    RAISE EXCEPTION 'Required column does not exist. This migration cannot run.';
  END IF;
END $$;

-- Check if migration has already been run (optional)
DO $$
DECLARE
  rows_to_update INTEGER;
BEGIN
  SELECT COUNT(*) INTO rows_to_update
  FROM your_table
  WHERE your_condition;
  
  IF rows_to_update = 0 THEN
    RAISE WARNING 'No rows found to update. Migration may have already been run. Proceeding anyway...';
  ELSE
    RAISE NOTICE '[METRICS] Rows that will be updated: %', rows_to_update;
  END IF;
END $$;

-- Verify indexes exist for optimal performance (optional)
DO $$
DECLARE
  has_index BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'your_table' 
    AND indexname LIKE '%your_column%'
  ) INTO has_index;
  
  RAISE NOTICE '[INDEX CHECK] your_column index: %', 
    CASE WHEN has_index THEN 'EXISTS' ELSE 'MISSING (may impact performance)' END;
  
  IF NOT has_index THEN
    RAISE WARNING '[PERFORMANCE] Consider adding index: CREATE INDEX idx_your_table_your_column ON your_table(your_column);';
  END IF;
END $$;

-- ============================================================================
-- PREVIEW QUERIES
-- ============================================================================

-- Show how many rows will be affected
SELECT 
  'Rows to update' as info,
  COUNT(*) as count
FROM your_table
WHERE your_condition;

-- Show sample of what will be updated
SELECT 
  id,
  -- Add columns you want to preview
  current_value,
  proposed_value
FROM your_table
WHERE your_condition
ORDER BY id
LIMIT 10;

-- ============================================================================
-- MIGRATION OPERATION
-- ============================================================================

DO $$
DECLARE
  operation_start_time TIMESTAMP;
BEGIN
  operation_start_time := clock_timestamp();
  RAISE NOTICE '[%] Starting UPDATE operation...', operation_start_time;
END $$;

-- Your migration SQL here
-- UPDATE your_table
-- SET column = value
-- WHERE condition;

-- Log operation results using GET DIAGNOSTICS
DO $$
DECLARE
  rows_updated INTEGER;
  operation_end_time TIMESTAMP;
BEGIN
  -- Get row count from UPDATE
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  operation_end_time := clock_timestamp();
  
  RAISE NOTICE '[%] UPDATE operation completed', operation_end_time;
  RAISE NOTICE '[METRICS] Rows updated: %', rows_updated;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- Show summary
SELECT 
  'Summary' as step,
  COUNT(*) FILTER (WHERE condition) as affected_rows,
  COUNT(*) FILTER (WHERE other_condition) as other_count
FROM your_table;

-- Final migration summary log
DO $$
DECLARE
  total_affected INTEGER;
  migration_end_time TIMESTAMP;
BEGIN
  SELECT COUNT(*) INTO total_affected
  FROM your_table
  WHERE your_condition;
  
  migration_end_time := clock_timestamp();
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '[%] Migration Summary', migration_end_time;
  RAISE NOTICE '[METRICS] Total affected rows: %', total_affected;
  RAISE NOTICE '========================================';
END $$;

-- ⚠️  IMPORTANT: Review the SELECT output above before committing!
-- The transaction will COMMIT after this point, applying all changes permanently.
-- If something looks wrong, run ROLLBACK; before this line to abort.
--
-- Summary of what will be committed:
--   - [Describe what changes will be committed]
COMMIT;

