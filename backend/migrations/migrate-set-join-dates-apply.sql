-- Migration script to set join_date for existing members
-- THIS VERSION APPLIES THE CHANGES (uses COMMIT instead of ROLLBACK)
-- Sets join_date to created_at for users who don't have a join_date set
-- This backfills join_date for existing members who were created before join_date logic was added
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- Show how many users will be affected
SELECT 
  'Users to update' as info,
  COUNT(*) as count
FROM users
WHERE join_date IS NULL 
  AND role != 'pending'
  AND created_at IS NOT NULL;

-- Show sample of what will be updated
SELECT 
  id,
  name,
  email,
  role,
  created_at,
  join_date as current_join_date,
  DATE(created_at) as proposed_join_date
FROM users
WHERE join_date IS NULL 
  AND role != 'pending'
  AND created_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Update join_date to created_at date for existing members
UPDATE users
SET join_date = DATE(created_at)
WHERE join_date IS NULL 
  AND role != 'pending'
  AND created_at IS NOT NULL;

-- Show summary
SELECT 
  'Summary' as step,
  (SELECT COUNT(*) FROM users WHERE join_date IS NOT NULL) as users_with_join_date,
  (SELECT COUNT(*) FROM users WHERE join_date IS NULL AND role != 'pending') as users_still_null,
  (SELECT COUNT(*) FROM users WHERE role = 'pending') as pending_users;

-- IMPORTANT: Review the output above before committing!
-- If everything looks good, the transaction will commit
-- If something is wrong, you can still ROLLBACK before this point
COMMIT;

