-- Migration: Workout signup reminders
-- Description: lead-time preference (1, 12, or 24 hours; default 24)
--              and a log of reminders already sent
--
-- Run on Railway/Postgres (psql or dashboard query tool).
-- Server startup also applies this via database-pg.js.

BEGIN;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS workout_reminder_hours INTEGER NOT NULL DEFAULT 24;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_preferences_reminder_hours_check'
  ) THEN
    ALTER TABLE notification_preferences
      ADD CONSTRAINT notification_preferences_reminder_hours_check
      CHECK (workout_reminder_hours IN (1, 12, 24));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS workout_reminders_sent (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  hours_before INTEGER NOT NULL CHECK (hours_before IN (1, 12, 24)),
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_reminders_sent_post_id
  ON workout_reminders_sent(post_id);

COMMIT;
