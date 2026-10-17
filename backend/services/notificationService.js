require('dotenv').config();
const { pool } = require('../database-pg');
const emailService = require('./emailService');
const smsService = require('./smsService');
const { sendPushNotification, sendBulkPushNotifications } = require('./pushSender');
const logger = require('../utils/logger');

/**
 * Notification Service
 *
 * Category preferences (Settings) control WHAT users are notified about.
 * - Push (iOS/Android): sent when the category is on (native apps).
 * - SMS (Twilio): sent only when sms_enabled is opted in, phone is verified,
 *   and the category is on. Available on web and as an extra option on apps.
 * Emails (e.g. waitlist "you're in") are always sent and are not gated by prefs.
 */

/**
 * Get device tokens for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of device tokens with platform info
 */
async function getUserDeviceTokens(userId) {
  try {
    const result = await pool.query(
      `SELECT token, platform FROM push_device_tokens WHERE user_id = $1`,
      [userId]
    );
    
    // Log token details for debugging
    result.rows.forEach((row, index) => {
      logger.debug(`📱 Token ${index + 1} from database:`, {
        platform: row.platform,
        tokenLength: row.token ? row.token.length : 0,
        tokenPreview: row.token ? row.token.substring(0, 32) + '...' : 'null',
        tokenFull: row.token, // Log full token for debugging
        isHex: row.token ? /^[0-9a-f]+$/i.test(row.token) : false
      });
    });
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching device tokens:', error);
    return [];
  }
}

/**
 * Send push notification to a user
 * @param {number} userId - User ID
 * @param {Object} notification - { title, body, data }
 * @returns {Promise<boolean>} True if sent successfully to at least one device
 */
async function sendPushNotificationToUser(userId, notification) {
  try {
    // Get user's device tokens
    const tokens = await getUserDeviceTokens(userId);
    
    if (tokens.length === 0) {
      logger.debug(`📱 No device tokens found for user ${userId}`);
      return false;
    }

    logger.debug(`📱 Sending push notification to user ${userId} with ${tokens.length} device(s):`, notification);

    // Send notifications to all user's devices
    const results = await sendBulkPushNotifications(tokens, notification);
    
    logger.debug(`📱 Push notification results for user ${userId}:`, results);
    
    // Return true if at least one notification was sent successfully
    return results.sent > 0;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return false;
  }
}

/**
 * Build a short SMS body from title + body (SMS length limits).
 */
function formatSmsBody(title, body) {
  const text = body ? `${title}: ${body}` : title;
  const prefix = 'UofT Tri: ';
  const max = 300 - prefix.length;
  const trimmed = text.length > max ? `${text.slice(0, max - 1)}…` : text;
  return `${prefix}${trimmed}`;
}

/**
 * Send SMS to a user if they opted in, verified phone, and SMS is configured.
 * @param {Object} user - { id, phone_number?, phoneNumber? }
 * @param {Object} notification - { title, body }
 * @param {Object} [options]
 * @param {boolean} [options.alreadyCheckedEligible] - skip preference/phone lookup
 */
async function sendSmsNotificationToUser(user, notification, options = {}) {
  try {
    if (!smsService.isConfigured()) {
      return false;
    }

    let phone = user.phone_number || user.phoneNumber || user.phone;
    let eligible = options.alreadyCheckedEligible === true;

    if (!eligible) {
      const result = await pool.query(
        `SELECT u.phone_number, u.phone_verified, COALESCE(np.sms_enabled, false) AS sms_enabled
         FROM users u
         LEFT JOIN notification_preferences np ON np.user_id = u.id
         WHERE u.id = $1`,
        [user.id]
      );
      if (result.rows.length === 0) return false;
      const row = result.rows[0];
      if (!row.sms_enabled || !row.phone_verified || !row.phone_number) {
        return false;
      }
      phone = row.phone_number;
      eligible = true;
    }

    if (!phone) return false;

    const body = formatSmsBody(notification.title || 'Notification', notification.body || '');
    const result = await smsService.sendSms(phone, body);
    return result.success;
  } catch (error) {
    console.error(`❌ Error sending SMS to user ${user.id}:`, error);
    return false;
  }
}

/**
 * Send push + optional SMS for a category notification.
 */
async function sendCategoryNotificationToUser(user, notification) {
  await sendPushNotificationToUser(user.id, notification);

  const hasEligibilityFields = typeof user.sms_enabled === 'boolean';
  const smsEligible =
    user.sms_enabled === true &&
    user.phone_verified === true &&
    Boolean(user.phone_number || user.phoneNumber || user.phone);

  if (smsEligible) {
    await sendSmsNotificationToUser(user, notification, { alreadyCheckedEligible: true });
  } else if (!hasEligibilityFields) {
    await sendSmsNotificationToUser(user, notification);
  }
}

/**
 * Get notification preferences for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User's notification preferences
 */
async function getUserNotificationPreferences(userId) {
  try {
    const result = await pool.query(
      `SELECT 
        spin_brick_workouts,
        swim_workouts,
        run_workouts,
        events,
        forum_replies,
        waitlist_promotions,
        COALESCE(sms_enabled, false) AS sms_enabled,
        COALESCE(workout_reminder_hours, 24) AS workout_reminder_hours,
        COALESCE(news_bulletins, true) AS news_bulletins
      FROM notification_preferences
      WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Categories default opted-in for push; SMS is always opt-in
      return {
        spinBrickWorkouts: true,
        swimWorkouts: true,
        runWorkouts: true,
        events: true,
        forumReplies: true,
        waitlistPromotions: true,
        smsEnabled: false,
        workoutReminderHours: 24,
        newsBulletins: true
      };
    }

    const prefs = result.rows[0];
    const reminderHours = Number(prefs.workout_reminder_hours);
    return {
      spinBrickWorkouts: prefs.spin_brick_workouts || false,
      swimWorkouts: prefs.swim_workouts || false,
      runWorkouts: prefs.run_workouts || false,
      events: prefs.events || false,
      forumReplies: prefs.forum_replies || false,
      waitlistPromotions: prefs.waitlist_promotions || false,
      smsEnabled: prefs.sms_enabled || false,
      workoutReminderHours: [1, 12, 24].includes(reminderHours) ? reminderHours : 24,
      newsBulletins: prefs.news_bulletins !== false
    };
  } catch (error) {
    console.error('❌ Error fetching notification preferences:', error);
    // Default to opted-in categories on error so we don't silently drop pushes
    return {
      spinBrickWorkouts: true,
      swimWorkouts: true,
      runWorkouts: true,
      events: true,
      forumReplies: true,
      waitlistPromotions: true,
      smsEnabled: false,
      workoutReminderHours: 24,
      newsBulletins: true
    };
  }
}

/**
 * Get all users who have a specific notification preference enabled
 * @param {string} preferenceType - One of: 'spinBrickWorkouts', 'swimWorkouts', 'runWorkouts', 'events', 'forumReplies', 'waitlistPromotions', 'newsBulletins'
 * @returns {Promise<Array>} Array of user objects with id, email, name
 */
async function getUsersWithPreference(preferenceType) {
  try {
    // Map preference type to database column name
    const columnMap = {
      'spinBrickWorkouts': 'spin_brick_workouts',
      'swimWorkouts': 'swim_workouts',
      'runWorkouts': 'run_workouts',
      'events': 'events',
      'forumReplies': 'forum_replies',
      'waitlistPromotions': 'waitlist_promotions',
      'newsBulletins': 'news_bulletins'
    };

    const columnName = columnMap[preferenceType];
    if (!columnName) {
      console.error(`❌ Invalid preference type: ${preferenceType}`);
      return [];
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.phone_number,
              COALESCE(u.phone_verified, false) AS phone_verified,
              COALESCE(np.sms_enabled, false) AS sms_enabled
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE COALESCE(np.${columnName}, true) = true
      AND u.role IN ('member', 'coach', 'exec', 'administrator')`,
      []
    );

    return result.rows;
  } catch (error) {
    console.error(`❌ Error fetching users with preference ${preferenceType}:`, error);
    return [];
  }
}

/**
 * Send workout post notification to users who have the appropriate preference enabled
 * @param {string} workoutType - 'bike', 'swim', 'run', 'spin', 'brick'
 * @param {Object} workoutData - { id, title, workoutDate, workoutTime, content }
 */
async function notifyWorkoutPosted(workoutType, workoutData) {
  try {
    // Determine which preference to check based on workout type
    let preferenceType;
    if (workoutType === 'bike' || workoutType === 'spin' || workoutType === 'brick' || workoutType === 'outdoor-ride') {
      preferenceType = 'spinBrickWorkouts';
    } else if (workoutType === 'swim') {
      preferenceType = 'swimWorkouts';
    } else if (workoutType === 'run') {
      preferenceType = 'runWorkouts';
    } else {
      logger.debug(`⚠️ Unknown workout type: ${workoutType}, skipping notifications`);
      return;
    }

    // Get users who want notifications for this workout type
    const users = await getUsersWithPreference(preferenceType);
    
    logger.debug(`📢 Notifying ${users.length} users about new ${workoutType} workout: ${workoutData.title}`);

    const notification = {
      title: `New ${workoutType} Workout: ${workoutData.title}`,
      body: workoutData.content?.substring(0, 100) || '',
      data: { type: 'workout', workoutId: workoutData.id }
    };

    for (const user of users) {
      await sendCategoryNotificationToUser(user, notification);
    }
  } catch (error) {
    console.error('❌ Error sending workout post notifications:', error);
  }
}

/**
 * Send event post notification to users who have events preference enabled
 * @param {Object} eventData - { id, title, eventDate, content }
 */
async function notifyEventPosted(eventData) {
  try {
    const users = await getUsersWithPreference('events');
    
    logger.debug(`📢 Notifying ${users.length} users about new event: ${eventData.title}`);

    const notification = {
      title: `New Event: ${eventData.title}`,
      body: eventData.content?.substring(0, 100) || '',
      data: { type: 'event', eventId: eventData.id }
    };

    for (const user of users) {
      await sendCategoryNotificationToUser(user, notification);
    }
  } catch (error) {
    console.error('❌ Error sending event post notifications:', error);
  }
}

/**
 * Send forum reply notification to a specific user
 * @param {number} userId - User ID to notify
 * @param {Object} replyData - { postId, postTitle, replyAuthor, replyContent }
 */
async function notifyForumReply(userId, replyData) {
  try {
    // Check if user has forum replies preference enabled
    const preferences = await getUserNotificationPreferences(userId);
    
    if (!preferences.forumReplies) {
      logger.debug(`📢 User ${userId} has forum reply notifications disabled, skipping`);
      return;
    }

    // Get user info
    const userResult = await pool.query(
      `SELECT email, name, phone_number,
              COALESCE(phone_verified, false) AS phone_verified
       FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      logger.debug(`⚠️ User ${userId} not found, skipping forum reply notification`);
      return;
    }

    const userRow = userResult.rows[0];
    logger.debug(`📢 Notifying user ${userId} about forum reply on post: ${replyData.postTitle}`);

    const notification = {
      title: `New reply on: ${replyData.postTitle}`,
      body: replyData.replyContent?.substring(0, 100) || '',
      data: { type: 'forum', postId: replyData.postId }
    };

    await sendCategoryNotificationToUser(
      {
        id: userId,
        phone_number: userRow.phone_number,
        phone_verified: userRow.phone_verified,
        sms_enabled: preferences.smsEnabled
      },
      notification
    );
  } catch (error) {
    console.error('❌ Error sending forum reply notification:', error);
  }
}

/**
 * Notify all users signed up for a workout about a new forum reply
 * Only notifies users who have forum_replies preference enabled
 * @param {number} postId - Forum post ID (workout post)
 * @param {Object} replyData - { postTitle, replyAuthor, replyContent }
 */
async function notifyWorkoutReplyToSignups(postId, replyData) {
  try {
    // Get all users signed up for this workout
    const signupsResult = await pool.query(
      `SELECT DISTINCT ws.user_id 
       FROM workout_signups ws
       WHERE ws.post_id = $1`,
      [postId]
    );

    if (signupsResult.rows.length === 0) {
      logger.debug(`📢 No users signed up for workout ${postId}, skipping reply notifications`);
      return;
    }

    const signedUpUserIds = signupsResult.rows.map(row => row.user_id);
    logger.debug(`📢 Found ${signedUpUserIds.length} users signed up for workout ${postId}`);

    // Get users who have forum_replies preference enabled
    const usersWithPreference = await pool.query(
      `SELECT u.id, u.email, u.name, u.phone_number,
              COALESCE(u.phone_verified, false) AS phone_verified,
              COALESCE(np.sms_enabled, false) AS sms_enabled
       FROM users u
       LEFT JOIN notification_preferences np ON u.id = np.user_id
       WHERE u.id = ANY($1::int[])
       AND COALESCE(np.forum_replies, true) = true
       AND u.role IN ('member', 'coach', 'exec', 'administrator')`,
      [signedUpUserIds]
    );

    if (usersWithPreference.rows.length === 0) {
      logger.debug(`📢 No users with forum_replies preference enabled for workout ${postId}`);
      return;
    }

    logger.debug(`📢 Notifying ${usersWithPreference.rows.length} users about forum reply on workout ${postId}: ${replyData.postTitle}`);

    // Send notifications to each user (non-blocking)
    const notificationPromises = usersWithPreference.rows.map(user => 
      notifyForumReply(user.id, replyData).catch(error => {
        console.error(`❌ Error notifying user ${user.id} about forum reply:`, error);
      })
    );

    await Promise.all(notificationPromises);
    logger.debug(`✅ Forum reply notifications sent to ${usersWithPreference.rows.length} users`);
  } catch (error) {
    console.error('❌ Error notifying workout signups about forum reply:', error);
  }
}

/**
 * Send waitlist promotion notification
 * Email: Always sent (user must know they got in)
 * Push/SMS: Only if waitlist_promotions preference enabled (SMS also needs sms_enabled + verified phone)
 * @param {Object} userData - { id, email, phone, name }
 * @param {Object} workoutData - { id, title, workoutDate, workoutTime }
 */
async function notifyWaitlistPromotion(userData, workoutData) {
  try {
    logger.debug(`📢 Notifying user ${userData.name} about waitlist promotion for: ${workoutData.title}`);

    // Always send email - user needs to know they got in (not controlled by app preferences)
    await emailService.sendWaitlistPromotion(
      userData.email,
      userData.name,
      workoutData.title,
      workoutData.workoutDate,
      workoutData.workoutTime,
      null
    );

    const preferences = await getUserNotificationPreferences(userData.id);
    if (preferences.waitlistPromotions) {
      const notification = {
        title: `You're in! ${workoutData.title}`,
        body: `You've been promoted from the waitlist for this workout.`,
        data: { type: 'workout', workoutId: workoutData.id }
      };

      await sendPushNotificationToUser(userData.id, notification);

      if (preferences.smsEnabled) {
        await sendSmsNotificationToUser(
          { id: userData.id, phone_number: userData.phone || userData.phone_number },
          notification
        );
      }
    }
  } catch (error) {
    console.error('❌ Error sending waitlist promotion notification:', error);
  }
}

/**
 * Push members when a bulletin is posted on News.
 * Push only — this preference does not send SMS.
 * @param {Object} bulletin - { id, title, preview }
 */
async function notifyNewsBulletin(bulletin) {
  try {
    const users = await getUsersWithPreference('newsBulletins');
    if (users.length === 0) {
      logger.debug('📢 No users to notify for news bulletin');
      return;
    }

    const notification = {
      title: bulletin.title || 'New club bulletin',
      body: bulletin.preview || 'A new bulletin is on News.',
      data: {
        type: 'bulletin',
        bulletinId: String(bulletin.id),
      },
    };

    logger.debug(`📢 Sending bulletin push to ${users.length} users for bulletin ${bulletin.id}`);
    await Promise.all(users.map((user) =>
      sendPushNotificationToUser(user.id, notification).catch((error) => {
        console.error(`❌ Bulletin push failed for user ${user.id}:`, error);
      })
    ));
  } catch (error) {
    console.error('❌ Error sending bulletin notifications:', error);
  }
}

module.exports = {
  getUserNotificationPreferences,
  getUsersWithPreference,
  getUserDeviceTokens,
  sendPushNotificationToUser,
  sendSmsNotificationToUser,
  notifyWorkoutPosted,
  notifyEventPosted,
  notifyForumReply,
  notifyWorkoutReplyToSignups,
  notifyWaitlistPromotion,
  notifyNewsBulletin
};
