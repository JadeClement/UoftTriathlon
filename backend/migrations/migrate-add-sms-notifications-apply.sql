-- Migration: Add Twilio SMS notification support
-- Description: phone_verified on users, sms_enabled on notification_preferences,
--              phone_verification_codes table for OTP opt-in
--
-- Run on Railway/Postgres (psql or dashboard query tool)

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_user_id
  ON phone_verification_codes(user_id);

COMMIT;
