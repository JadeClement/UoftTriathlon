require('dotenv').config();
const { pool } = require('./database-pg');
const { combineDateTime, isWithinHours } = require('./utils/dateUtils');

/**
 * Migration script to fix historical cancellation timezone issues
 * 
 * This script:
 * 1. Recalculates within_12hrs for all existing cancellations using local-time logic
 * 2. Updates workout_cancellations table
 * 3. Fixes marked_absent flags
 * 4. Adjusts users.absences counts accordingly
 * 
 * Run with: node migrate-fix-cancellation-timezones.js
 */

async function fixCancellationTimezones() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting migration to fix cancellation timezones...');
    
    // Diagnostic: Check if table exists and has records
    const tableCheck = await client.query(`
      SELECT COUNT(*) as count FROM workout_cancellations
    `);
    console.log(`📊 Total records in workout_cancellations: ${tableCheck.rows[0].count}`);
    
    // Diagnostic: Check forum_posts
    const forumCheck = await client.query(`
      SELECT COUNT(*) as count FROM forum_posts WHERE type = 'workout'
    `);
    console.log(`📊 Total workout posts: ${forumCheck.rows[0].count}`);
    
    // Diagnostic: Check cancellations without JOIN
    const cancellationsOnly = await client.query(`
      SELECT COUNT(*) as count FROM workout_cancellations
    `);
    console.log(`📊 Cancellations (no JOIN): ${cancellationsOnly.rows[0].count}`);
    
    // Diagnostic: Check if cancellations have matching posts
    const joinCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM workout_cancellations wc
      LEFT JOIN forum_posts fp ON wc.post_id = fp.id
      WHERE fp.id IS NULL
    `);
    console.log(`📊 Cancellations without matching posts: ${joinCheck.rows[0].count}`);
    
    // Diagnostic: Show a sample of cancellations
    const sample = await client.query(`
      SELECT wc.*, fp.type, fp.title
      FROM workout_cancellations wc
      LEFT JOIN forum_posts fp ON wc.post_id = fp.id
      LIMIT 5
    `);
    if (sample.rows.length > 0) {
      console.log(`📊 Sample cancellations:`, sample.rows);
    }
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Get all cancellations with workout details
    const cancellationsResult = await client.query(`
      SELECT 
        wc.post_id,
        wc.user_id,
        wc.cancelled_at,
        wc.within_12hrs AS old_within_12hrs,
        wc.marked_absent AS old_marked_absent,
        fp.workout_date,
        fp.workout_time,
        fp.title AS workout_title
      FROM workout_cancellations wc
      JOIN forum_posts fp ON wc.post_id = fp.id
      WHERE fp.type = 'workout'
      ORDER BY wc.cancelled_at DESC
    `);
    
    const cancellations = cancellationsResult.rows;
    console.log(`📊 Found ${cancellations.length} cancellation records to process`);
    
    let updated = 0;
    let absencesAdded = 0;
    let absencesRemoved = 0;
    let errors = 0;
    
    for (const cancel of cancellations) {
      try {
        // Recalculate workout datetime using new local-time logic
        const workoutDateTime = combineDateTime(cancel.workout_date, cancel.workout_time);
        
        if (!workoutDateTime) {
          console.log(`⚠️  Skipping cancellation ${cancel.post_id}/${cancel.user_id}: Invalid workout date/time`);
          errors++;
          continue;
        }
        
        // Calculate time difference at cancellation time
        // We need to know if the cancellation was within 12 hours of the workout
        // So we need to reconstruct when the cancellation happened relative to the workout
        
        // cancelled_at is stored as a timestamp - we need to compare it to workout time
        const cancelledAt = new Date(cancel.cancelled_at);
        const diffMs = workoutDateTime - cancelledAt;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        // New calculation: within 12 hours means workout is 0-12 hours in the future from cancellation time
        const newWithin12hrs = diffHours >= 0 && diffHours <= 12;
        
        // Check if this is different from what's stored
        if (cancel.old_within_12hrs === newWithin12hrs) {
          // No change needed
          continue;
        }
        
        console.log(`🔄 Updating cancellation for workout ${cancel.post_id} (${cancel.workout_title}), user ${cancel.user_id}:`);
        console.log(`   Old within_12hrs: ${cancel.old_within_12hrs}, New: ${newWithin12hrs}`);
        console.log(`   Workout: ${cancel.workout_date} ${cancel.workout_time}, Cancelled: ${cancel.cancelled_at}`);
        console.log(`   Hours difference: ${diffHours.toFixed(2)}`);
        
        // Update the cancellation record
        await client.query(`
          UPDATE workout_cancellations
          SET within_12hrs = $1,
              marked_absent = $2
          WHERE post_id = $3 AND user_id = $4
        `, [newWithin12hrs, newWithin12hrs, cancel.post_id, cancel.user_id]);
        
        // Handle attendance record
        if (newWithin12hrs && !cancel.old_within_12hrs) {
          // Changed from false to true: need to mark absent and increment absences
          console.log(`   ➕ Marking as absent and incrementing absences`);
          
          // Create/update attendance record
          await client.query(`
            INSERT INTO workout_attendance (post_id, user_id, attended, recorded_at)
            VALUES ($1, $2, false, $3)
            ON CONFLICT (post_id, user_id) DO UPDATE SET
              attended = false,
              recorded_at = $3
          `, [cancel.post_id, cancel.user_id, cancel.cancelled_at]);
          
          // Increment user's absence count
          await client.query(`
            UPDATE users SET absences = absences + 1 WHERE id = $1
          `, [cancel.user_id]);
          
          absencesAdded++;
          
        } else if (!newWithin12hrs && cancel.old_within_12hrs) {
          // Changed from true to false: need to remove absence and decrement absences
          console.log(`   ➖ Removing absence and decrementing absences`);
          
          // Remove attendance record (or set attended = true if they actually attended)
          // We'll delete it since they cancelled early
          await client.query(`
            DELETE FROM workout_attendance
            WHERE post_id = $1 AND user_id = $2
          `, [cancel.post_id, cancel.user_id]);
          
          // Decrement user's absence count (but don't go below 0)
          await client.query(`
            UPDATE users 
            SET absences = GREATEST(0, absences - 1) 
            WHERE id = $1
          `, [cancel.user_id]);
          
          absencesRemoved++;
        }
        
        updated++;
        
      } catch (error) {
        console.error(`❌ Error processing cancellation ${cancel.post_id}/${cancel.user_id}:`, error.message);
        errors++;
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n✅ Migration completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total cancellations processed: ${cancellations.length}`);
    console.log(`   - Records updated: ${updated}`);
    console.log(`   - Absences added: ${absencesAdded}`);
    console.log(`   - Absences removed: ${absencesRemoved}`);
    console.log(`   - Errors: ${errors}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
fixCancellationTimezones()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });

