// Migration script to set expiry_date for users based on their term's end_date
// This will update each user's expiry_date to match the end_date of their assigned term
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

async function setExpiryFromTerm() {
  try {
    console.log('🔧 Setting expiry_date for users based on their term\'s end_date...\n');
    
    // Show current state
    const currentState = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.term_id,
        t.term,
        t.end_date as term_end_date,
        u.expiry_date as current_expiry_date
      FROM users u
      LEFT JOIN terms t ON u.term_id = t.id
      WHERE u.term_id IS NOT NULL
        AND u.role != 'pending'
      ORDER BY u.id
      LIMIT 10
    `);
    
    if (currentState.rows.length > 0) {
      console.log('📊 Sample of current state:');
      currentState.rows.forEach(row => {
        const match = row.current_expiry_date === row.term_end_date ? '✅' : '❌';
        console.log(`   ${match} ${row.name} (${row.email}): term=${row.term}, term_end=${row.term_end_date}, current_expiry=${row.current_expiry_date || 'NULL'}`);
      });
    }
    
    // Show summary
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_users_with_term,
        COUNT(*) FILTER (WHERE u.expiry_date != t.end_date OR u.expiry_date IS NULL) as users_to_update,
        COUNT(*) FILTER (WHERE u.expiry_date = t.end_date) as users_already_matching
      FROM users u
      LEFT JOIN terms t ON u.term_id = t.id
      WHERE u.term_id IS NOT NULL
        AND u.role != 'pending'
    `);
    
    const stats = summary.rows[0];
    console.log(`\n📈 Summary:`);
    console.log(`   Total users with term_id: ${stats.total_users_with_term}`);
    console.log(`   Users to update: ${stats.users_to_update}`);
    console.log(`   Users already matching: ${stats.users_already_matching}`);
    
    if (stats.users_to_update === '0') {
      console.log('\n✅ All users already have expiry_date matching their term end_date. Nothing to update.');
      await pool.end();
      process.exit(0);
    }
    
    // Update expiry_date to match term's end_date
    console.log('\n🔄 Updating expiry_date...');
    const updateResult = await pool.query(`
      UPDATE users u
      SET expiry_date = t.end_date
      FROM terms t
      WHERE u.term_id = t.id
        AND u.role != 'pending'
        AND (u.expiry_date IS NULL OR u.expiry_date != t.end_date)
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} user(s)`);
    
    // Verify the update
    const verify = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        t.term,
        t.end_date as term_end_date,
        u.expiry_date as new_expiry_date
      FROM users u
      LEFT JOIN terms t ON u.term_id = t.id
      WHERE u.term_id IS NOT NULL
        AND u.role != 'pending'
      ORDER BY u.id
      LIMIT 10
    `);
    
    if (verify.rows.length > 0) {
      console.log('\n📊 Verification (sample):');
      verify.rows.forEach(row => {
        const match = row.new_expiry_date === row.term_end_date ? '✅' : '❌';
        console.log(`   ${match} ${row.name}: expiry_date=${row.new_expiry_date}, term_end_date=${row.term_end_date}`);
      });
    }
    
    console.log('\n✅ Migration complete!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

setExpiryFromTerm();

