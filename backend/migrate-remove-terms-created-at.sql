-- Migration script to remove created_at column from terms table
-- 
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- Check if created_at column exists
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'terms' AND column_name = 'created_at';

-- Remove created_at column if it exists
ALTER TABLE terms DROP COLUMN IF EXISTS created_at;

-- Verify the column was removed
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'terms'
ORDER BY ordinal_position;

-- Review the changes before committing
-- If everything looks good, run: COMMIT;
-- If something is wrong, run: ROLLBACK;
ROLLBACK;

