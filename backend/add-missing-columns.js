const { pool } = require('./database-pg');

async function addMissingColumns() {
  try {
    console.log('🔧 Adding missing columns to existing database...');
    
    // Add join_date column if it doesn't exist
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS join_date DATE');
      console.log('✅ Added join_date column');
    } catch (error) {
      console.log('⚠️ join_date column already exists or error:', error.message);
    }
    
    // Add payment_confirmed column if it doesn't exist
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT FALSE');
      console.log('✅ Added payment_confirmed column');
    } catch (error) {
      console.log('⚠️ payment_confirmed column already exists or error:', error.message);
    }
    
    // Add bio column if it doesn't exist
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT');
      console.log('✅ Added bio column');
    } catch (error) {
      console.log('⚠️ bio column already exists or error:', error.message);
    }
    
    // Add reset_token columns if they don't exist
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)');
      console.log('✅ Added reset_token column');
    } catch (error) {
      console.log('⚠️ reset_token column already exists or error:', error.message);
    }
    
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP');
      console.log('✅ Added reset_token_expiry column');
    } catch (error) {
      console.log('⚠️ reset_token_expiry column already exists or error:', error.message);
    }
    
    console.log('✅ All missing columns added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding missing columns:', error);
  } finally {
    await pool.end();
    console.log('✅ Database connection closed');
  }
}

// Run the script
addMissingColumns();
