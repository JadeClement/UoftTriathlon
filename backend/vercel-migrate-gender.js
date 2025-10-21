const { pool } = require('./database-pg');

async function addGenderColumnToVercel() {
  try {
    console.log('🔄 Adding gender column to Vercel merch_orders table...');
    
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
    console.log(`📊 Total orders in Vercel: ${countResult.rows[0].count}`);

    // Show sample orders
    const sampleResult = await pool.query('SELECT id, first_name, last_name, item, gender FROM merch_orders ORDER BY created_at DESC LIMIT 5');
    console.log('📋 Sample orders:', sampleResult.rows);

  } catch (error) {
    console.error('❌ Error adding gender column to Vercel:', error);
  } finally {
    await pool.end();
  }
}

// Run migration
addGenderColumnToVercel()
  .then(() => {
    console.log('✅ Vercel migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Vercel migration failed:', error);
    process.exit(1);
  });
