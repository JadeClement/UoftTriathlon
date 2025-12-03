-- Migration script to set term_id for users based on expiry_date
-- 
-- Rules:
-- - If expiry_date is in 2025 → term_id = 'fall'
-- - If expiry_date is NOT in 2025 → term_id = 'fall/winter'
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- First, create the terms if they don't exist
-- Note: You'll need to set appropriate start_date and end_date for these terms
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

-- Review the changes before committing
-- If everything looks good, run: COMMIT;
-- If something is wrong, run: ROLLBACK;
ROLLBACK;

