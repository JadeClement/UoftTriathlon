#!/usr/bin/env node
/**
 * Apply migration seed-races-2026 (2026 race calendar) using the same logic as API startup.
 *
 * Production: redeploy the backend — initializeDatabase() runs this automatically once.
 *
 * Manual:
 *   cd backend && node scripts/run-seed-races-2026.js
 *   cd backend && node scripts/run-seed-races-2026.js --sync-schema   # local DB behind on schema
 */
const { pool, initializeDatabase, migrateSeedRaces2026 } = require('../database-pg');

function logDbTarget() {
  const raw = process.env.DATABASE_URL;
  if (raw) {
    try {
      const normalized = raw.replace(/^postgres(ql)?:/i, 'http:');
      const { hostname } = new URL(normalized);
      console.log(`📊 Using DATABASE_URL → host ${hostname}`);
    } catch {
      console.log('📊 DATABASE_URL is set');
    }
  } else {
    console.log('📊 No DATABASE_URL — local Postgres (database-pg defaults)');
    console.log('   Use Railway public DATABASE_URL from the dashboard to hit production.');
  }
}

async function main() {
  logDbTarget();

  if (process.argv.includes('--sync-schema')) {
    console.log('🔧 Running full initializeDatabase()...');
    await initializeDatabase();
  } else {
    await migrateSeedRaces2026();
  }

  await pool.end();
  console.log('✅ Done');
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
