require('dotenv').config();
const { pool } = require('../database-pg');
const emailService = require('./emailService');
const { sendWaitlistPromotionNotification } = require('./smsService');

/**
 * Notification Service
 * 
 * This service handles checking user notification preferences and sending notifications
 * when events occur (workouts posted, events posted, forum replies, waitlist promotions).
 * 
 * Currently, push notifications are not implemented (Phase 1.4 or 2.3).
 * For now, we check preferences and send email/SMS where applicable.
 * Push notifications will be added later when Web Push API or native push is set up.
 */

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
      `SELECT u.id, u.email, u.name, u.phone
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

    // TODO: When push notifications are implemented (Phase 1.4 or 2.3), send push notifications here
    // For now, we just log that notifications would be sent
    // When ready, uncomment and implement:
    // for (const user of users) {
    //   await sendPushNotification(user.id, {
    //     title: `New ${workoutType} Workout: ${workoutData.title}`,
    //     body: workoutData.content?.substring(0, 100) || '',
    //     data: { type: 'workout', workoutId: workoutData.id }
    //   });
    // }

    // For now, log the notifications that would be sent
    if (users.length > 0) {
      console.log(`📢 Would send ${users.length} push notifications for ${workoutType} workout (push notifications not yet implemented)`);
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

    // TODO: When push notifications are implemented, send push notifications here
    // For now, we just log that notifications would be sent
    if (users.length > 0) {
      console.log(`📢 Would send ${users.length} push notifications for event (push notifications not yet implemented)`);
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

    // TODO: When push notifications are implemented, send push notification here
    // For now, we just log that a notification would be sent
    console.log(`📢 Would send push notification for forum reply (push notifications not yet implemented)`);

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

    // TODO: When push notifications are implemented, also send push notification here
    console.log(`📢 Would also send push notification for waitlist promotion (push notifications not yet implemented)`);
  } catch (error) {
    console.error('❌ Error sending waitlist promotion notification:', error);
  }
}

module.exports = {
  getUserNotificationPreferences,
  getUsersWithPreference,
  notifyWorkoutPosted,
  notifyEventPosted,
  notifyForumReply,
  notifyWaitlistPromotion
};

