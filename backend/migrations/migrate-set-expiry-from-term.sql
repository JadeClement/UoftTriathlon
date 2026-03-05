-- Migration script to set expiry_date for users based on their term's end_date
-- 
-- This will update each user's expiry_date to match the end_date of their assigned term
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- Show current state: users with term_id and their current expiry_date vs term end_date
SELECT 
  u.id,
  u.name,
  u.email,
  u.term_id,
  t.term,
  t.end_date as term_end_date,
  u.expiry_date as current_expiry_date,
  CASE 
    WHEN u.expiry_date != t.end_date THEN 'Will be updated'
    ELSE 'Already matches'
  END as status
FROM users u
LEFT JOIN terms t ON u.term_id = t.id
WHERE u.term_id IS NOT NULL
  AND u.role != 'pending'
ORDER BY u.id
LIMIT 20;

-- Show summary of what will be updated
SELECT 
  'Summary' as info,
  COUNT(*) as total_users_with_term,
  COUNT(*) FILTER (WHERE u.expiry_date != t.end_date OR u.expiry_date IS NULL) as users_to_update,
  COUNT(*) FILTER (WHERE u.expiry_date = t.end_date) as users_already_matching
FROM users u
LEFT JOIN terms t ON u.term_id = t.id
WHERE u.term_id IS NOT NULL
  AND u.role != 'pending';

-- Update expiry_date to match term's end_date
UPDATE users u
SET expiry_date = t.end_date
FROM terms t
WHERE u.term_id = t.id
  AND u.role != 'pending'
  AND (u.expiry_date IS NULL OR u.expiry_date != t.end_date);

-- Show updated state
SELECT 
  u.id,
  u.name,
  u.email,
  t.term,
  t.end_date as term_end_date,
  u.expiry_date as new_expiry_date,
  CASE 
    WHEN u.expiry_date = t.end_date THEN '✅ Matches'
    ELSE '❌ Mismatch'
  END as status
FROM users u
LEFT JOIN terms t ON u.term_id = t.id
WHERE u.term_id IS NOT NULL
  AND u.role != 'pending'
ORDER BY u.id
LIMIT 20;

-- Review the changes before committing
-- If everything looks good, run: COMMIT;
-- If something is wrong, run: ROLLBACK;
ROLLBACK;

