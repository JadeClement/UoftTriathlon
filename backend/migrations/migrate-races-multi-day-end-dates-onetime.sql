-- One-time: set races.end_date for known multi-day events (rows still NULL end_date).
-- Applied once via migrateRacesMultiDayEndDates() (schema_migrations.migrate-races-multi-day-end-dates).
--
-- Rules:
--   1) Event text hints: 2-day / two-day / multi-day → end_date = date + 1 day (Sat–Sun style).
--   2) Curated rows where the calendar date is the first day but the festival lasts longer.
--
-- Does not change races.date. Re-run manually only if you clear the schema_migrations row.

UPDATE races
SET end_date = (date + INTERVAL '1 day')::date
WHERE is_deleted = false
  AND end_date IS NULL
  AND event IS NOT NULL
  AND event ~* '2-day|two-day|two day|multi-day';

-- Challenge Québec (Cap Québec): festival Jun 26–28, 2026; seed uses primary day 2026-06-27.
UPDATE races
SET end_date = '2026-06-28'::date
WHERE is_deleted = false
  AND end_date IS NULL
  AND name = 'Challenge Quebec'
  AND date = '2026-06-27'::date;
