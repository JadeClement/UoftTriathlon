-- Migration script to set term_id for users based on expiry_date
-- ⚠️  THIS VERSION APPLIES THE CHANGES (uses COMMIT instead of ROLLBACK)
--    Use migrate-set-term-ids.sql for a dry-run preview first
-- 
-- Rules:
-- - If expiry_date is in 2025 → term_id = 'fall'
-- - If expiry_date is NOT in 2025 → term_id = 'fall/winter'
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

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
    RAISE WARNING 'All non-pending users already have term_id set. This migration may have already been run. Proceeding anyway...';
  ELSIF users_needing_update = 0 THEN
    RAISE WARNING 'No non-pending users found. Nothing to migrate.';
  ELSE
    RAISE NOTICE 'Migration will update % users out of % non-pending users.', users_needing_update, total_non_pending_users;
  END IF;
END $$;

-- First, create the terms if they don't exist
-- Note: You'll need to set appropriate start_date and end_date for these terms
-- Adjust the dates below to match your actual term dates
INSERT INTO terms (term, start_date, end_date)
VALUES 
  ('fall', '2024-09-01', '2024-12-31'),
  ('fall/winter', '2024-09-01', '2025-04-30')
ON CONFLICT (term) DO NOTHING;

-- Show which terms exist
SELECT id, term, start_date, end_date FROM terms WHERE term IN ('fall', 'fall/winter');

-- Show how many users will be affected
SELECT 
  'Users to update' as info,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE expiry_date >= '2025-01-01' AND expiry_date < '2026-01-01') as expiry_in_2025,
  COUNT(*) FILTER (WHERE expiry_date IS NULL OR expiry_date < '2025-01-01' OR expiry_date >= '2026-01-01') as expiry_not_in_2025
FROM users
WHERE term_id IS NULL
  AND role != 'pending';

-- Show sample of what will be updated
SELECT 
  id,
  name,
  email,
  role,
  expiry_date,
  term_id as current_term_id,
  CASE 
    WHEN expiry_date >= '2025-01-01' AND expiry_date < '2026-01-01' THEN 'fall'
    ELSE 'fall/winter'
  END as proposed_term,
  (SELECT id FROM terms WHERE term = CASE 
    WHEN expiry_date >= '2025-01-01' AND expiry_date < '2026-01-01' THEN 'fall'
    ELSE 'fall/winter'
  END) as proposed_term_id
FROM users
WHERE term_id IS NULL
  AND role != 'pending'
ORDER BY expiry_date DESC NULLS LAST
LIMIT 10;

-- Update term_id based on expiry_date
UPDATE users u
SET term_id = (
  SELECT id FROM terms 
  WHERE term = CASE 
    WHEN u.expiry_date >= '2025-01-01' AND u.expiry_date < '2026-01-01' THEN 'fall'
    ELSE 'fall/winter'
  END
)
WHERE term_id IS NULL
  AND role != 'pending';

-- Show summary
SELECT 
  'Summary' as step,
  (SELECT COUNT(*) FROM users WHERE term_id IS NOT NULL) as users_with_term_id,
  (SELECT COUNT(*) FROM users WHERE term_id IS NULL AND role != 'pending') as users_still_null,
  (SELECT COUNT(*) FROM users WHERE term_id = (SELECT id FROM terms WHERE term = 'fall')) as users_with_fall,
  (SELECT COUNT(*) FROM users WHERE term_id = (SELECT id FROM terms WHERE term = 'fall/winter')) as users_with_fall_winter;

-- ⚠️  IMPORTANT: Review the SELECT output above before committing!
-- The transaction will COMMIT after this point, applying all changes permanently.
-- If something looks wrong, run ROLLBACK; before this line to abort.
--
-- Summary of what will be committed:
--   - Terms 'fall' and 'fall/winter' created (if they didn't exist)
--   - term_id set for users based on their expiry_date
COMMIT;

