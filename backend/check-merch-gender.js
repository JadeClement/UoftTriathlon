const { pool } = require('./database-pg');

async function checkMerchGender() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking merch_orders table for gender values...\n');
    
    // Get all orders with non-null gender
    const withGender = await client.query(`
      SELECT 
        id,
        item,
        gender,
        created_at
      FROM merch_orders
      WHERE gender IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 50
    `);
    
    console.log(`📊 Orders with gender set (showing up to 50):`);
    console.log(`   Total: ${withGender.rows.length} records\n`);
    
    withGender.rows.forEach(row => {
      console.log(`   ID ${row.id}: "${row.item}" - Gender: ${row.gender} (${new Date(row.created_at).toLocaleDateString()})`);
    });
    
    // Check for swim caps and backpacks specifically
    const unisexItems = await client.query(`
      SELECT 
        id,
        item,
        gender,
        created_at
      FROM merch_orders
      WHERE (
        LOWER(item) LIKE '%swim cap%' OR
        LOWER(item) LIKE '%cap%' OR
        LOWER(item) LIKE '%backpack%' OR
        LOWER(item) LIKE '%bag%'
      )
      ORDER BY created_at DESC
      LIMIT 50
    `);
    
    console.log(`\n📦 Potential unisex items (swim caps, backpacks, bags):`);
    console.log(`   Total: ${unisexItems.rows.length} records\n`);
    
    unisexItems.rows.forEach(row => {
      const hasGender = row.gender ? `Gender: ${row.gender}` : 'Gender: NULL';
      console.log(`   ID ${row.id}: "${row.item}" - ${hasGender} (${new Date(row.created_at).toLocaleDateString()})`);
    });
    
    // Summary
    const summary = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE gender IS NOT NULL) as with_gender,
        COUNT(*) FILTER (WHERE gender IS NULL) as without_gender,
        COUNT(*) as total
      FROM merch_orders
    `);
    
    console.log(`\n📈 Summary:`);
    console.log(`   Total orders: ${summary.rows[0].total}`);
    console.log(`   With gender: ${summary.rows[0].with_gender}`);
    console.log(`   Without gender: ${summary.rows[0].without_gender}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  checkMerchGender()
    .then(() => {
      console.log('\n✅ Check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkMerchGender };



