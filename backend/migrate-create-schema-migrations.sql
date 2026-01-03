-- Migration to create schema_migrations table for tracking migration history
-- This enables proper migration versioning and prevents duplicate runs
--
-- Run this in your PostgreSQL database (psql or pgAdmin)

BEGIN;

-- ============================================================================
-- MIGRATION LOGGING
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration: create-schema-migrations';
  RAISE NOTICE 'Started at: %', NOW();
  RAISE NOTICE '========================================';
END $$;

-- Create schema_migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  applied_by VARCHAR(255),
  execution_time_ms INTEGER,
  rows_affected INTEGER,
  notes TEXT
);

-- Create index on migration_name for fast lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);

-- Insert this migration itself into the tracking table
INSERT INTO schema_migrations (migration_name, applied_by, notes)
VALUES ('create-schema-migrations', current_user, 'Initial migration tracking table')
ON CONFLICT (migration_name) DO NOTHING;

-- Show summary
SELECT 
  'Summary' as step,
  COUNT(*) as total_migrations,
  MAX(applied_at) as latest_migration
FROM schema_migrations;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration completed successfully';
  RAISE NOTICE 'Schema migrations tracking is now enabled';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

