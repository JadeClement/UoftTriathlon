// Quick script to create the terms table in PostgreSQL
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

async function createTermsTable() {
  try {
    console.log('🔧 Creating terms table...');
    
    // Create terms table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS terms (
        id SERIAL PRIMARY KEY,
        term VARCHAR(50) NOT NULL UNIQUE CHECK(term IN ('fall', 'winter', 'fall/winter', 'spring', 'summer', 'spring/summer')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL
      )
    `);
    console.log('✅ Terms table created');
    
    // Remove created_at column if it exists (migration)
    const checkCreatedAt = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'terms' AND column_name = 'created_at'
    `);
    
    if (checkCreatedAt.rows.length > 0) {
      console.log('🔧 Removing created_at column from terms table...');
      await pool.query(`ALTER TABLE terms DROP COLUMN created_at`);
      console.log('✅ created_at column removed from terms table');
    }
    
    // Check if term_id column exists in users table
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'term_id'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('🔧 Adding term_id column to users table...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN term_id INTEGER REFERENCES terms(id)
      `);
      console.log('✅ term_id column added to users table');
    } else {
      console.log('✅ term_id column already exists in users table');
    }
    
    console.log('✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTermsTable();

