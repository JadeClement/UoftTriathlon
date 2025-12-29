require('dotenv').config();
const { pool } = require('../database-pg');
const emailService = require('./emailService');
const { sendWaitlistPromotionNotification } = require('./smsService');
const { sendPushNotification, sendBulkPushNotifications } = require('./pushSender');

/**
 * Notification Service
 * 
 * This service handles checking user notification preferences and sending notifications
 * when events occur (workouts posted, events posted, forum replies, waitlist promotions).
 * 
 * Push notifications are implemented using native push (FCM for Android, APNs for iOS).
 * FCM/APNs configuration is required for push notifications to work.
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
      console.log(`📱 Token ${index + 1} from database:`, {
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
      console.log(`📱 No device tokens found for user ${userId}`);
      return false;
    }

    console.log(`📱 Sending push notification to user ${userId} with ${tokens.length} device(s):`, notification);

    // Send notifications to all user's devices
    const results = await sendBulkPushNotifications(tokens, notification);
    
    console.log(`📱 Push notification results for user ${userId}:`, results);
    
    // Return true if at least one notification was sent successfully
    return results.sent > 0;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return false;
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
        waitlist_promotions
      FROM notification_preferences
      WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences (all false)
      return {
        spinBrickWorkouts: false,
        swimWorkouts: false,
        runWorkouts: false,
        events: false,
        forumReplies: false,
        waitlistPromotions: false
      };
    }

    const prefs = result.rows[0];
    return {
      spinBrickWorkouts: prefs.spin_brick_workouts || false,
      swimWorkouts: prefs.swim_workouts || false,
      runWorkouts: prefs.run_workouts || false,
      events: prefs.events || false,
      forumReplies: prefs.forum_replies || false,
      waitlistPromotions: prefs.waitlist_promotions || false
    };
  } catch (error) {
    console.error('❌ Error fetching notification preferences:', error);
    // Return default preferences on error
    return {
      spinBrickWorkouts: false,
      swimWorkouts: false,
      runWorkouts: false,
      events: false,
      forumReplies: false,
      waitlistPromotions: false
    };
  }
}

/**
 * Get all users who have a specific notification preference enabled
 * @param {string} preferenceType - One of: 'spinBrickWorkouts', 'swimWorkouts', 'runWorkouts', 'events', 'forumReplies', 'waitlistPromotions'
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
      'waitlistPromotions': 'waitlist_promotions'
    };

    const columnName = columnMap[preferenceType];
    if (!columnName) {
      console.error(`❌ Invalid preference type: ${preferenceType}`);
      return [];
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.phone_number
      FROM users u
      INNER JOIN notification_preferences np ON u.id = np.user_id
      WHERE np.${columnName} = true
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
    if (workoutType === 'bike' || workoutType === 'spin' || workoutType === 'brick') {
      preferenceType = 'spinBrickWorkouts';
    } else if (workoutType === 'swim') {
      preferenceType = 'swimWorkouts';
    } else if (workoutType === 'run') {
      preferenceType = 'runWorkouts';
    } else {
      console.log(`⚠️ Unknown workout type: ${workoutType}, skipping notifications`);
      return;
    }

    // Get users who want notifications for this workout type
    const users = await getUsersWithPreference(preferenceType);
    
    console.log(`📢 Notifying ${users.length} users about new ${workoutType} workout: ${workoutData.title}`);

    // Send push notifications to users
    for (const user of users) {
      await sendPushNotificationToUser(user.id, {
        title: `New ${workoutType} Workout: ${workoutData.title}`,
        body: workoutData.content?.substring(0, 100) || '',
        data: { type: 'workout', workoutId: workoutData.id }
      });
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
    
    console.log(`📢 Notifying ${users.length} users about new event: ${eventData.title}`);

    // Send push notifications to users
    for (const user of users) {
      await sendPushNotificationToUser(user.id, {
        title: `New Event: ${eventData.title}`,
        body: eventData.content?.substring(0, 100) || '',
        data: { type: 'event', eventId: eventData.id }
      });
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
      console.log(`📢 User ${userId} has forum reply notifications disabled, skipping`);
      return;
    }

    // Get user info
    const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      console.log(`⚠️ User ${userId} not found, skipping forum reply notification`);
      return;
    }

    console.log(`📢 Notifying user ${userId} about forum reply on post: ${replyData.postTitle}`);

    // Send push notification
    await sendPushNotificationToUser(userId, {
      title: `New reply on: ${replyData.postTitle}`,
      body: replyData.replyContent?.substring(0, 100) || '',
      data: { type: 'forum', postId: replyData.postId }
    });

    // Optional: Send email notification for forum replies
    // Uncomment if you want email notifications for forum replies:
    // const user = userResult.rows[0];
    // await emailService.sendEmail(
    //   user.email,
    //   `New reply on: ${replyData.postTitle}`,
    //   `...`
    // );
  } catch (error) {
    console.error('❌ Error sending forum reply notification:', error);
  }
}

/**
 * Send waitlist promotion notification (already has email/SMS, but we should check preferences)
 * @param {Object} userData - { id, email, phone, name }
 * @param {Object} workoutData - { id, title, workoutDate, workoutTime }
 */
async function notifyWaitlistPromotion(userData, workoutData) {
  try {
    // Check if user has waitlist promotion preference enabled
    const preferences = await getUserNotificationPreferences(userData.id);
    
    if (!preferences.waitlistPromotions) {
      console.log(`📢 User ${userData.id} has waitlist promotion notifications disabled, skipping`);
      return;
    }

    console.log(`📢 Notifying user ${userData.name} about waitlist promotion for: ${workoutData.title}`);

    // Send email/SMS notification (already implemented)
    await sendWaitlistPromotionNotification(
      userData.email,
      userData.phone,
      userData.name,
      workoutData.title,
      workoutData.workoutDate,
      workoutData.workoutTime
    );

    // Send push notification
    await sendPushNotificationToUser(userData.id, {
      title: `You're in! ${workoutData.title}`,
      body: `You've been promoted from the waitlist for this workout.`,
      data: { type: 'workout', workoutId: workoutData.id }
    });
  } catch (error) {
    console.error('❌ Error sending waitlist promotion notification:', error);
  }
}

module.exports = {
  getUserNotificationPreferences,
  getUsersWithPreference,
  getUserDeviceTokens,
  sendPushNotificationToUser,
  notifyWorkoutPosted,
  notifyEventPosted,
  notifyForumReply,
  notifyWaitlistPromotion
};

