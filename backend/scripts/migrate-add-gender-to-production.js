const { Pool } = require('pg');

// Production database connection
// Replace these with your actual production database credentials
const pool = new Pool({
  // Option 1: If you have a DATABASE_URL for production
  // connectionString: process.env.PRODUCTION_DATABASE_URL,
  
  // Option 2: If you have individual connection parameters
  user: 'your_production_user',
  host: 'your_production_host',
  database: 'tri-prod-db', // or whatever your production database name is
  password: 'your_production_password',
  port: 5432,
  ssl: { rejectUnauthorized: false } // Usually needed for production
});

async function addGenderColumnToProduction() {
  try {
    console.log('🔄 Adding gender column to production merch_orders table...');
    
    // Add gender column if it doesn't exist
    await pool.query(`
      ALTER TABLE merch_orders
      ADD COLUMN IF NOT EXISTS gender VARCHAR(1) DEFAULT 'M';
    `);
    console.log('✅ Gender column added to merch_orders table');

    // Update existing records with a default gender if it's null
    const updateResult = await pool.query(`
      UPDATE merch_orders
      SET gender = 'M'
      WHERE gender IS NULL;
    `);
    console.log(`✅ Updated ${updateResult.rowCount} existing records with default gender`);

    // Check total orders
    const countResult = await pool.query('SELECT COUNT(*) as count FROM merch_orders');
    console.log(`📊 Total orders in production: ${countResult.rows[0].count}`);

    // Show sample orders
    const sampleResult = await pool.query('SELECT id, first_name, last_name, item, gender FROM merch_orders ORDER BY created_at DESC LIMIT 5');
    console.log('📋 Sample orders:', sampleResult.rows);

  } catch (error) {
    console.error('❌ Error adding gender column to production:', error);
  } finally {
    await pool.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  addGenderColumnToProduction()
    .then(() => {
      console.log('✅ Production migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Production migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addGenderColumnToProduction };
