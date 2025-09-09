const { pool } = require('./database-pg');

async function runMigration() {
  try {
    console.log('🔧 Running migration on production database...');
    
    // Check if workout_id column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workout_waitlist' 
      AND column_name = 'workout_id'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('📋 Found workout_id column, renaming to post_id...');
      
      // Rename the column
      await pool.query('ALTER TABLE workout_waitlist RENAME COLUMN workout_id TO post_id');
      console.log('✅ Column renamed successfully');
      
      // Update the foreign key constraint
      await pool.query('ALTER TABLE workout_waitlist DROP CONSTRAINT IF EXISTS workout_waitlist_workout_id_fkey');
      await pool.query('ALTER TABLE workout_waitlist ADD CONSTRAINT workout_waitlist_post_id_fkey FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE');
      console.log('✅ Foreign key constraint updated');
      
      // Update the unique constraint
      await pool.query('ALTER TABLE workout_waitlist DROP CONSTRAINT IF EXISTS workout_waitlist_user_id_workout_id_key');
      await pool.query('ALTER TABLE workout_waitlist ADD CONSTRAINT workout_waitlist_user_id_post_id_key UNIQUE (user_id, post_id)');
      console.log('✅ Unique constraint updated');
      
      // Drop old index and create new one
      await pool.query('DROP INDEX IF EXISTS idx_workout_waitlist_workout_id');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_workout_waitlist_post_id ON workout_waitlist(post_id)');
      console.log('✅ Index updated');
      
    } else {
      console.log('✅ Column already renamed or doesn\'t exist');
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error running migration:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
