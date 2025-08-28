const { pool } = require('./database-pg');

async function getSequenceName(tableName, idColumn = 'id') {
  const { rows } = await pool.query(
    'SELECT pg_get_serial_sequence($1, $2) AS seq',
    [tableName, idColumn]
  );
  return rows[0] && rows[0].seq ? rows[0].seq : null;
}

async function fixSequenceForTable(tableName, idColumn = 'id') {
  try {
    // Find the sequence name dynamically
    let seqName = await getSequenceName(tableName, idColumn);

    // Fallback to conventional name if pg_get_serial_sequence returns null
    if (!seqName) {
      const conventional = `${tableName}_${idColumn}_seq`;
      // Verify the conventional sequence exists
      const check = await pool.query(
        `SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = $1 LIMIT 1`,
        [conventional]
      );
      if (check.rowCount > 0) seqName = conventional;
    }

    if (!seqName) {
      console.warn(`⚠️  No sequence found for ${tableName}.${idColumn}. Skipping.`);
      return;
    }

    const { rows } = await pool.query(
      `SELECT COALESCE(MAX(${idColumn}), 0) AS max_id FROM ${tableName}`
    );
    const nextVal = Number(rows[0].max_id) + 1;

    // Use setval to bump the sequence
    await pool.query(`SELECT setval($1, $2, false)`, [seqName, nextVal]);
    console.log(`✅ ${seqName} set to ${nextVal} (table: ${tableName})`);
  } catch (err) {
    console.error(`❌ Error fixing sequence for ${tableName}:`, err.message);
  }
}

async function main() {
  // Tables that use a serial/identity id column
  const tables = [
    'users',
    'forum_posts',
    'workout_signups',
    'workout_attendance',
    'races',
    'race_signups',
    'login_history',
    'role_change_notifications',
    'workout_waitlist'
  ];

  try {
    for (const table of tables) {
      await fixSequenceForTable(table, 'id');
    }
  } finally {
    await pool.end();
    console.log('✅ Finished fixing sequences and closed DB connection');
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌ Unhandled error:', e);
    process.exit(1);
  });
}
