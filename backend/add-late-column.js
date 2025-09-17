const { pool } = require('./database-pg');

async function addLateColumn() {
  try {
    console.log('🔄 Adding late column to workout_attendance table...');
    
    // Check if late column already exists
    const columnExists = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workout_attendance' 
      AND column_name = 'late'
    `);
    
    if (columnExists.rows.length > 0) {
      console.log('✅ Late column already exists');
      return;
    }
    
    // Add late column
    await pool.query(`
      ALTER TABLE workout_attendance 
      ADD COLUMN late BOOLEAN DEFAULT FALSE
    `);
    
    console.log('✅ Late column added to workout_attendance table');
    
  } catch (error) {
    console.error('❌ Error adding late column:', error);
  } finally {
    await pool.end();
  }
}

addLateColumn();
