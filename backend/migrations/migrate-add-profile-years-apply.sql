-- Adds joined_year / end_year to users for displayed team membership span.
-- joined_year defaults from account created_at; end_year defaults to current calendar year.

ALTER TABLE users ADD COLUMN IF NOT EXISTS joined_year INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS end_year INTEGER;

UPDATE users SET joined_year = EXTRACT(YEAR FROM created_at)::int WHERE joined_year IS NULL;
UPDATE users SET end_year = EXTRACT(YEAR FROM CURRENT_DATE)::int WHERE end_year IS NULL;
