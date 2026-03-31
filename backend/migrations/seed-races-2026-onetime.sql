-- One-time seed: 2026 race calendar (Ontario / regional club list).
-- Applied automatically on API startup once via migrateSeedRaces2026() (schema_migrations.seed-races-2026).
-- Requires races columns event, link (added earlier in database-pg initializeDatabase).
-- Safe to re-run: skips rows that already exist with the same name and date (non-deleted).
-- Dates are primary race day or first day of a multi-day event; confirm on official sites before race week.
-- Duplicates in the source list (e.g. Gravenhurst x2) are stored once. "Ironman 70.3" (non-Muskoka) -> Mont-Tremblant.

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'Milton Tri', '2026-06-07'::date, 'Milton, ON', NULL,
  'Sprint / Olympic / Try-A-Tri', 'https://trisportcanada.com/races/milton/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'Milton Tri' AND r.date = '2026-06-07'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'Gravenhurst Tri', '2026-06-13'::date, 'Gravenhurst, ON', NULL,
  'Sprint / Olympic / Duathlon', 'https://multisportcanada.com/gravenhurst-2/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'Gravenhurst Tri' AND r.date = '2026-06-13'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'Ride to Conquer Cancer', '2026-06-13'::date, 'Southern Ontario (Toronto area)', NULL,
  'Charity cycling (2-day)', 'https://ride2conquer.ca/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'Ride to Conquer Cancer' AND r.date = '2026-06-13'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'Guelph Lake 1', '2026-06-20'::date, 'Guelph, ON (Guelph Lake Conservation Area)', NULL,
  'Sprint / Olympic / Try-A-Tri', 'https://trisportcanada.com/races/guelph-lake-1/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'Guelph Lake 1' AND r.date = '2026-06-20'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'Journey to Conquer Cancer', '2026-06-21'::date, 'Toronto, ON', NULL,
  'Walk / Run fundraiser', 'https://thepmcf.ca/our-events/journey-to-conquer-cancer/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'Journey to Conquer Cancer' AND r.date = '2026-06-21'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'EyeRide', '2026-06-20'::date, 'Starts Vaughan, ON (Greater Toronto Area)', NULL,
  'Charity cycling (65 km / 130 km)', 'https://www.eyeride.ca/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'EyeRide' AND r.date = '2026-06-20'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'Rose City Tri', '2026-06-27'::date, 'Welland, ON', NULL,
  'Sprint / Olympic / Duathlon', 'https://multisportcanada.com/welland-2/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'Rose City Tri' AND r.date = '2026-06-27'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'IRONMAN 70.3 Mont-Tremblant', '2026-06-21'::date, 'Mont-Tremblant, QC', NULL,
  '70.3', 'https://www.ironman.com/im703-mont-tremblant', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'IRONMAN 70.3 Mont-Tremblant' AND r.date = '2026-06-21'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'Challenge Quebec', '2026-06-27'::date, 'Québec City, QC', NULL,
  'Sprint / Olympic / Middle / Full', 'https://www.capquebec.com/en/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'Challenge Quebec' AND r.date = '2026-06-27'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'IRONMAN 70.3 Muskoka', '2026-07-05'::date, 'Huntsville, ON', NULL,
  '70.3', 'https://www.ironman.com/im703-muskoka', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'IRONMAN 70.3 Muskoka' AND r.date = '2026-07-05'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'Bracebridge Tri', '2026-07-11'::date, 'Bracebridge, ON', NULL,
  'Sprint / Olympic / Duathlon', 'https://multisportcanada.com/bracebridge-2/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'Bracebridge Tri' AND r.date = '2026-07-11'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'IRONMAN 70.3 Musselman', '2026-07-12'::date, 'Geneva, NY, USA', NULL,
  '70.3', 'https://www.ironman.com/im703-musselman', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'IRONMAN 70.3 Musselman' AND r.date = '2026-07-12'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'Owen Sound Tri', '2026-08-16'::date, 'Owen Sound, ON (Kelso Beach Park)', NULL,
  'Sprint / Olympic / Duathlon', 'https://trisportcanada.com/races/owen-sound/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'Owen Sound Tri' AND r.date = '2026-08-16'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'IRONMAN 70.3 Oregon', '2026-07-19'::date, 'Salem, OR, USA', NULL,
  '70.3', 'https://www.ironman.com/im703-oregon', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'IRONMAN 70.3 Oregon' AND r.date = '2026-07-19'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'K-Town Tri', '2026-07-19'::date, 'Kingston, ON (CFB Kingston area)', NULL,
  'Sprint / Olympic / Duathlon / Enduro', 'https://www.multisportcanada.com/kingston/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'K-Town Tri' AND r.date = '2026-07-19'::date);

INSERT INTO races (name, date, location, description, event, link, is_deleted)
SELECT 'Toronto Triathlon Festival', '2026-07-26'::date, 'Toronto, ON', NULL,
  'Sprint / Olympic', 'https://by.supertri.com/toronto-triathlon/', false
WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.is_deleted = false AND r.name = 'Toronto Triathlon Festival' AND r.date = '2026-07-26'::date);
