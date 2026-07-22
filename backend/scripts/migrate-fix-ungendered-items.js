const { pool } = require('../database-pg');

async function fixUngenderedItems() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔄 Fixing gender values for swim caps and backpacks...');
    
    // First, show what will be updated
    const previewResult = await client.query(`
      SELECT 
        id,
        item,
        gender,
        created_at
      FROM merch_orders
      WHERE gender IS NOT NULL
        AND (
          LOWER(item) LIKE '%swim cap%' OR
          LOWER(item) LIKE '%cap - swim%' OR
          LOWER(item) LIKE '%backpack%' OR
          LOWER(item) LIKE '%bag%'
        )
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Found ${previewResult.rows.length} records to update:`);
    previewResult.rows.forEach(row => {
      console.log(`   - ID ${row.id}: "${row.item}" (gender: ${row.gender})`);
    });
    
    if (previewResult.rows.length === 0) {
      console.log('✅ No records need updating');
      await client.query('ROLLBACK');
      return;
    }
    
    // Update the records
    const updateResult = await client.query(`
      UPDATE merch_orders
      SET gender = NULL
      WHERE gender IS NOT NULL
        AND (
          LOWER(item) LIKE '%swim cap%' OR
          LOWER(item) LIKE '%cap - swim%' OR
          LOWER(item) LIKE '%backpack%' OR
          LOWER(item) LIKE '%bag%'
        )
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} records`);
    
    // Verify
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as count
      FROM merch_orders
      WHERE gender IS NULL
        AND (
          LOWER(item) LIKE '%swim cap%' OR
          LOWER(item) LIKE '%cap - swim%' OR
          LOWER(item) LIKE '%backpack%' OR
          LOWER(item) LIKE '%bag%'
        )
    `);
    
    console.log(`✅ Verification: ${verifyResult.rows[0].count} unisex items now have NULL gender`);
    
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

// Run if called directly
if (require.main === module) {
  fixUngenderedItems()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixUngenderedItems };



