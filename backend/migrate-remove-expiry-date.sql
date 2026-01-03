-- Migration script to remove expiry_date column from users table
-- 
-- After this migration, expiry dates will be determined by term.end_date via JOIN
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- Check if expiry_date column exists
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'expiry_date';

-- Show current expiry_date values before removal (for reference)
SELECT 
  u.id,
  u.name,
  u.email,
  u.expiry_date,
  u.term_id,
  t.term,
  t.end_date as term_end_date
FROM users u
LEFT JOIN terms t ON u.term_id = t.id
WHERE u.expiry_date IS NOT NULL
ORDER BY u.id
LIMIT 20;

-- Remove expiry_date column
ALTER TABLE users DROP COLUMN IF EXISTS expiry_date;

-- Verify the column was removed
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'expiry_date';

-- Review the changes before committing
-- If everything looks good, run: COMMIT;
-- If something is wrong, run: ROLLBACK;
ROLLBACK;

