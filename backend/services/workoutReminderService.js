const { pool } = require('../database-pg');
const logger = require('../utils/logger');
const { combineDateTime } = require('../utils/dateUtils');
const {
  isReminderDue,
  buildWorkoutReminder
} = require('../utils/workoutReminders');
const {
  sendPushNotificationToUser,
  sendSmsNotificationToUser
} = require('./notificationService');

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const START_DELAY_MS = 15 * 1000;
const ADVISORY_LOCK_KEY = 74122401;

let schedulerStarted = false;
let tickInFlight = false;

function parseSignedUpAt(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function findCandidateSignups() {
  const result = await pool.query(`
    SELECT
      ws.user_id,
      ws.post_id,
      fp.title,
      to_char(fp.workout_date, 'YYYY-MM-DD') AS workout_date,
      to_char(fp.workout_time, 'HH24:MI:SS') AS workout_time,
      (ws.signup_time AT TIME ZONE 'UTC') AS signed_up_at,
      u.phone_number,
      COALESCE(u.phone_verified, false) AS phone_verified,
      COALESCE(np.sms_enabled, false) AS sms_enabled,
      COALESCE(np.workout_reminder_hours, 24) AS reminder_hours
    FROM workout_signups ws
    JOIN forum_posts fp ON fp.id = ws.post_id
    JOIN users u ON u.id = ws.user_id
    LEFT JOIN notification_preferences np ON np.user_id = ws.user_id
    WHERE fp.type = 'workout'
      AND COALESCE(fp.is_deleted, false) = false
      AND fp.workout_date IS NOT NULL
      AND fp.workout_time IS NOT NULL
      AND COALESCE(u.is_active, true) = true
      AND u.role IN ('member', 'coach', 'exec', 'administrator')
      AND fp.workout_date >= ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto')::date)
      AND fp.workout_date <= ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto')::date + 2)
      AND NOT EXISTS (
        SELECT 1 FROM workout_reminders_sent wrs
        WHERE wrs.user_id = ws.user_id AND wrs.post_id = ws.post_id
      )
  `);
  return result.rows;
}

async function markReminderSent(userId, postId, hoursBefore) {
  await pool.query(
    `INSERT INTO workout_reminders_sent (user_id, post_id, hours_before)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, post_id) DO NOTHING`,
    [userId, postId, hoursBefore]
  );
}

async function deliverReminder(row, now) {
  const workoutStart = combineDateTime(row.workout_date, row.workout_time);
  const hoursBefore = Number(row.reminder_hours);
  const signedUpAt = parseSignedUpAt(row.signed_up_at);

  if (!isReminderDue({ workoutStart, signedUpAt, hoursBefore, now })) {
    return false;
  }

  const message = buildWorkoutReminder({
    title: row.title,
    workoutStart,
    now
  });
  const notification = {
    title: message.title,
    body: message.body,
    data: {
      type: 'workout',
      workoutId: String(row.post_id)
    }
  };

  const pushSent = await sendPushNotificationToUser(row.user_id, notification);

  let smsSent = false;
  const smsEligible = row.sms_enabled === true
    && row.phone_verified === true
    && Boolean(row.phone_number);
  if (smsEligible) {
    smsSent = await sendSmsNotificationToUser(
      {
        id: row.user_id,
        phone_number: row.phone_number,
        phone_verified: true,
        sms_enabled: true
      },
      notification,
      { alreadyCheckedEligible: true }
    );
  }

  if (!pushSent && !smsSent) {
    return false;
  }

  await markReminderSent(row.user_id, row.post_id, hoursBefore);
  logger.debug(`⏰ Workout reminder sent to user ${row.user_id} for workout ${row.post_id} (${hoursBefore}h)`);
  return true;
}

async function deliverDueReminders(now = new Date()) {
  const rows = await findCandidateSignups();
  let sent = 0;
  for (const row of rows) {
    try {
      const didSend = await deliverReminder(row, now);
      if (didSend) sent += 1;
    } catch (error) {
      logger.error(`❌ Workout reminder failed for user ${row.user_id} workout ${row.post_id}:`, error);
    }
  }
  if (sent > 0) {
    logger.debug(`⏰ Sent ${sent} workout reminder(s)`);
  }
  return { checked: rows.length, sent };
}

async function sendDueWorkoutReminders() {
  const client = await pool.connect();
  let locked = false;
  try {
    const lockResult = await client.query(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [ADVISORY_LOCK_KEY]
    );
    locked = lockResult.rows[0]?.locked === true;
    if (!locked) {
      logger.debug('⏰ Workout reminder job already running');
      return { checked: 0, sent: 0, skipped: true };
    }
    return await deliverDueReminders();
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
      } catch (error) {
        logger.error('❌ Failed to release workout reminder lock:', error);
      }
    }
    client.release();
  }
}

function startWorkoutReminderScheduler() {
  if (schedulerStarted || process.env.NODE_ENV === 'test') return;
  schedulerStarted = true;

  const tick = () => {
    if (tickInFlight) return;
    tickInFlight = true;
    sendDueWorkoutReminders()
      .catch((error) => {
        logger.error('❌ Workout reminder job failed:', error);
      })
      .finally(() => {
        tickInFlight = false;
      });
  };

  const startupTimer = setTimeout(tick, START_DELAY_MS);
  const intervalTimer = setInterval(tick, POLL_INTERVAL_MS);
  if (typeof startupTimer.unref === 'function') startupTimer.unref();
  if (typeof intervalTimer.unref === 'function') intervalTimer.unref();
  logger.debug('⏰ Workout reminder scheduler started');
}

module.exports = {
  sendDueWorkoutReminders,
  startWorkoutReminderScheduler
};
