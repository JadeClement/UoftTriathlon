-- SQL script to create a test term with expired end_date
-- This will allow you to test the term expiry error message
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- Create a test term that expired yesterday
INSERT INTO terms (term, start_date, end_date)
VALUES ('fall', '2024-09-01', CURRENT_DATE - INTERVAL '1 day')
ON CONFLICT (term) DO UPDATE 
SET start_date = EXCLUDED.start_date, 
    end_date = EXCLUDED.end_date;

-- Or create a unique term name for testing (if 'fall' already exists)
-- Uncomment the line below and comment the one above if needed:
-- INSERT INTO terms (term, start_date, end_date)
-- VALUES ('test-expired', '2024-01-01', CURRENT_DATE - INTERVAL '1 day');

-- Verify the term was created
SELECT id, term, start_date, end_date, 
       CASE 
         WHEN end_date < CURRENT_DATE THEN 'EXPIRED'
         ELSE 'ACTIVE'
       END as status
FROM terms
WHERE term = 'fall' OR term = 'test-expired'
ORDER BY id DESC
LIMIT 1;

-- Review before committing
-- If everything looks good, run: COMMIT;
-- If something is wrong, run: ROLLBACK;
ROLLBACK;

