// Migration script to remove expiry_date column from users table
// After this migration, expiry dates will be determined by term.end_date via JOIN
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

async function removeExpiryDate() {
  try {
    console.log('🔧 Removing expiry_date column from users table...\n');
    
    // Check if expiry_date column exists
    const checkColumn = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'expiry_date'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('✅ expiry_date column does not exist. Nothing to do.');
      await pool.end();
      process.exit(0);
    }
    
    // Show current expiry_date values before removal (for reference)
    const currentValues = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.expiry_date,
        u.term_id,
        t.term,
        t.end_date as term_end_date
      FROM users u
      LEFT JOIN terms t ON u.term_id = t.id
      WHERE u.expiry_date IS NOT NULL
      ORDER BY u.id
      LIMIT 10
    `);
    
    if (currentValues.rows.length > 0) {
      console.log('📊 Sample of current expiry_date values (for reference):');
      currentValues.rows.forEach(row => {
        console.log(`   ${row.name} (${row.email}): expiry=${row.expiry_date}, term=${row.term || 'NULL'}, term_end=${row.term_end_date || 'NULL'}`);
      });
    }
    
    console.log('\n🔄 Removing expiry_date column...');
    
    // Remove expiry_date column
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS expiry_date`);
    
    console.log('✅ expiry_date column removed from users table');
    console.log('\n📝 Note: Expiry dates will now be determined by term.end_date via JOIN');
    
    console.log('\n✅ Migration complete!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

removeExpiryDate();

