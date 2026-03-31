#!/usr/bin/env node
/**
 * One-time: set races.end_date for multi-day events (same as API initializeDatabase).
 *
 *   cd backend && node scripts/run-migrate-races-multi-day-end-dates.js
 *
 * Or apply SQL manually:
 *   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/migrate-races-multi-day-end-dates-onetime.sql
 *   INSERT INTO schema_migrations (migration_name, applied_by, notes)
 *   VALUES ('migrate-races-multi-day-end-dates', current_user, 'manual psql');
 */
const { pool, migrateRacesMultiDayEndDates } = require('../database-pg');

async function main() {
  await migrateRacesMultiDayEndDates();
  await pool.end();
  console.log('✅ Done');
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
