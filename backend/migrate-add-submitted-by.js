require('dotenv').config();
const { Pool } = require('pg');

// This script adds the submitted_by column to the production database
// Run this with: DATABASE_URL=your_production_url node migrate-add-submitted-by.js

async function addSubmittedByColumn() {
  let pool;
  
  try {
    console.log('🔧 Connecting to production database...');
    
    // Use the production DATABASE_URL from environment
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to production database');

    // Check if column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workout_attendance' 
      AND column_name = 'submitted_by'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ submitted_by column already exists');
      return;
    }

    // Add the column
    console.log('🔧 Adding submitted_by column...');
    await pool.query(`
      ALTER TABLE workout_attendance 
      ADD COLUMN submitted_by INTEGER REFERENCES users(id)
    `);
    
    console.log('✅ submitted_by column added successfully');

    // Verify the column was added
    const verifyColumn = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'workout_attendance' 
      AND column_name = 'submitted_by'
    `);
    
    if (verifyColumn.rows.length > 0) {
      console.log('✅ Column verified:', verifyColumn.rows[0]);
    } else {
      console.log('❌ Column not found after creation');
    }

    // Check existing records
    const recordCount = await pool.query('SELECT COUNT(*) FROM workout_attendance');
    console.log(`📊 Found ${recordCount.rows[0].count} existing attendance records`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

addSubmittedByColumn();
