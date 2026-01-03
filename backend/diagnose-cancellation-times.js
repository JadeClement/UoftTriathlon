const { pool } = require('./database-pg');
const { combineDateTime, isWithinHours, getHoursUntil } = require('./utils/dateUtils');

async function diagnoseCancellationTimes() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Diagnosing workout cancellation time logic...\n');
    
    // Get server timezone
    const timezoneResult = await client.query("SHOW timezone");
    console.log(`📅 Server timezone: ${timezoneResult.rows[0].timezone}\n`);
    
    // Get current time from database
    const nowResult = await client.query("SELECT NOW() as db_now, CURRENT_TIMESTAMP as db_current_timestamp");
    console.log(`🕐 Database NOW(): ${nowResult.rows[0].db_now}`);
    console.log(`🕐 Database CURRENT_TIMESTAMP: ${nowResult.rows[0].db_current_timestamp}`);
    console.log(`🕐 JavaScript new Date(): ${new Date().toISOString()}\n`);
    
    // Get recent cancellations with workout details
    const cancellationsResult = await client.query(`
      SELECT 
        wc.post_id,
        wc.user_id,
        wc.cancelled_at,
        wc.within_12hrs,
        wc.marked_absent,
        fp.workout_date,
        fp.workout_time,
        fp.title as workout_title,
        u.name as user_name
      FROM workout_cancellations wc
      JOIN forum_posts fp ON wc.post_id = fp.id
      JOIN users u ON wc.user_id = u.id
      WHERE fp.type = 'workout'
      ORDER BY wc.cancelled_at DESC
      LIMIT 10
    `);
    
    console.log(`📊 Analyzing ${cancellationsResult.rows.length} recent cancellations:\n`);
    
    for (const cancel of cancellationsResult.rows) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Workout: ${cancel.workout_title} (ID: ${cancel.post_id})`);
      console.log(`User: ${cancel.user_name} (ID: ${cancel.user_id})`);
      console.log(`Workout Date: ${cancel.workout_date}`);
      console.log(`Workout Time: ${cancel.workout_time}`);
      console.log(`Cancelled At (DB): ${cancel.cancelled_at}`);
      
      // Calculate workout datetime using our utility
      const workoutDateTime = combineDateTime(cancel.workout_date, cancel.workout_time);
      console.log(`Workout DateTime (JS): ${workoutDateTime ? workoutDateTime.toISOString() : 'INVALID'}`);
      
      // Parse cancelled_at
      const cancelledAt = new Date(cancel.cancelled_at);
      console.log(`Cancelled At (JS): ${cancelledAt.toISOString()}`);
      
      // Calculate difference
      const diffMs = workoutDateTime - cancelledAt;
      const diffHours = diffMs / (1000 * 60 * 60);
      
      console.log(`\n📐 Calculations:`);
      console.log(`   Hours difference (workout - cancelled): ${diffHours.toFixed(2)}`);
      console.log(`   Stored within_12hrs: ${cancel.within_12hrs}`);
      console.log(`   Stored marked_absent: ${cancel.marked_absent}`);
      
      // What would isWithinHours calculate NOW?
      const nowWithin12hrs = workoutDateTime ? isWithinHours(workoutDateTime, 12) : false;
      const hoursUntilNow = workoutDateTime ? getHoursUntil(workoutDateTime) : 0;
      
      console.log(`\n⏰ Current time check (if cancelling NOW):`);
      console.log(`   Hours until workout: ${hoursUntilNow.toFixed(2)}`);
      console.log(`   Would be within 12hrs: ${nowWithin12hrs}`);
      
      // What should it have been at cancellation time?
      // We need to check if cancellation was within 12 hours of workout
      // This means: workout_time - cancelled_at should be between 0 and 12 hours
      const shouldBeWithin12hrs = diffHours >= 0 && diffHours <= 12;
      
      console.log(`\n✅ Expected calculation (at cancellation time):`);
      console.log(`   Should be within_12hrs: ${shouldBeWithin12hrs}`);
      console.log(`   Match with stored value: ${shouldBeWithin12hrs === cancel.within_12hrs ? '✅ CORRECT' : '❌ MISMATCH'}`);
      
      if (shouldBeWithin12hrs !== cancel.within_12hrs) {
        console.log(`\n⚠️  ISSUE DETECTED: Stored value doesn't match expected calculation!`);
      }
    }
    
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n🔍 Summary:`);
    console.log(`   - Server timezone: ${timezoneResult.rows[0].timezone}`);
    console.log(`   - Database timestamps are stored in: UTC (typically)`);
    console.log(`   - Workout times are interpreted as: Local time (America/Toronto)`);
    console.log(`   - Cancellation times are stored as: UTC (CURRENT_TIMESTAMP)`);
    console.log(`\n💡 Potential Issue:`);
    console.log(`   When comparing workout_datetime (local) to cancelled_at (UTC),`);
    console.log(`   we need to ensure both are in the same timezone for accurate comparison.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  diagnoseCancellationTimes()
    .then(() => {
      console.log('\n✅ Diagnosis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Diagnosis failed:', error);
      process.exit(1);
    });
}

module.exports = { diagnoseCancellationTimes };



