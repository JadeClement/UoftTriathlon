// Migration script to remove created_at column from terms table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL 
    ? {
        // Production (Railway) - use DATABASE_URL
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        // Local development - use local database
        user: 'postgres',
        host: 'localhost',
        database: 'uofttriathlon',
        password: '', // No password for local development
        port: 5432,
      }
);

async function removeCreatedAtColumn() {
  try {
    console.log('🔧 Checking if created_at column exists in terms table...');
    
    // Check if created_at column exists
    const checkColumn = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'terms' AND column_name = 'created_at'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('✅ created_at column does not exist in terms table. Nothing to do.');
      await pool.end();
      process.exit(0);
    }
    
    console.log('📋 Found created_at column. Removing it...');
    
    // Remove created_at column
    await pool.query(`ALTER TABLE terms DROP COLUMN IF EXISTS created_at`);
    
    console.log('✅ created_at column removed from terms table');
    
    // Verify the column was removed
    const verify = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'terms'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Current terms table structure:');
    verify.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });
    
    console.log('\n✅ Migration complete!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

removeCreatedAtColumn();

