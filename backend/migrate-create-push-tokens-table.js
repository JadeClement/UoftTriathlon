/**
 * Migration: Create push_device_tokens table
 * 
 * This migration ensures the push_device_tokens table exists.
 * Run this if the table wasn't created during normal initialization.
 */

require('dotenv').config();
const { pool } = require('./database-pg');

async function createPushDeviceTokensTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creating push_device_tokens table...');
    
    await client.query('BEGIN');
    
    // Create push_device_tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_device_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, token)
      )
    `);
    console.log('✅ push_device_tokens table created');
    
    // Create index on user_id for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user_id 
      ON push_device_tokens(user_id)
    `);
    console.log('✅ Index on push_device_tokens.user_id created');
    
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  createPushDeviceTokensTable()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = createPushDeviceTokensTable;

