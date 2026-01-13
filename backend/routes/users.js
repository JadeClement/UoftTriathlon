const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../database-pg');
const { authenticateToken, allowOwnProfile, requireMember } = require('../middleware/auth');
const { isS3Enabled, uploadBufferToS3, deleteFromS3, getS3KeyFromUrl } = require('../utils/s3');

// Debug (non-sensitive) printout of S3 detection to help diagnose env on deploys
try {
  const haveAccessKey = Boolean(process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID);
  const haveSecretKey = Boolean(process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY);
  const region = process.env.AWS_S3_REGION || process.env.AWS_REGION || '(none)';
  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || '(none)';
  console.log('🧰 S3 detection:', { enabled: isS3Enabled(), haveAccessKey, haveSecretKey, region, bucket });
} catch (_) {}

const router = express.Router();

// Test route to verify the router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Users router is working!' });
});

// Test route with same middleware as profile
router.get('/test-auth', authenticateToken, allowOwnProfile, (req, res) => {
  res.json({ 
    message: 'Auth middleware working!', 
    userId: req.user.id,
    userRole: req.user.role
  });
});

// Configure multer for file uploads (memory when S3 enabled, disk otherwise)
const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'profile-pictures');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: isS3Enabled() ? memoryStorage : diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// CORS is handled by main server middleware
// Get user profile
router.get('/profile', authenticateToken, allowOwnProfile(), async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(`
      SELECT id, name, email, role, created_at, phone_number, profile_picture_url, charter_accepted, results_public
      FROM users 
      WHERE id = $1 AND is_active = true
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, allowOwnProfile(), async (req, res) => {
  try {
    console.log('🔍 Profile update route: Starting...');
    const userId = req.user.id;
    console.log('🔍 Profile update route: User ID:', userId);
    console.log('🔍 Backend received request body:', req.body);
    console.log('🔍 Backend received headers:', req.headers);
    
    const { name, email, phone_number, bio, results_public } = req.body;
    console.log('🔍 Profile update route: Extracted data:', { name, email, phone_number, bio });

    if (!name || !email) {
      console.log('❌ Backend validation failed:', { name, email, phone_number, bio });
      return res.status(400).json({ error: 'Name and email are required' });
    }

    console.log('🔍 Profile update route: Validation passed, checking email and phone uniqueness...');

    // Check if email is already taken by another user
    const existingUserByEmail = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
    if (existingUserByEmail.rows.length > 0) {
      console.log('❌ Email already taken by user ID:', existingUserByEmail.rows[0].id);
      return res.status(400).json({ error: 'Hey, that email is already taken by another user. Please choose a different email address.' });
    }

    // Check if phone number is already taken by another user
    if (phone_number) {
      const existingUserByPhone = await pool.query('SELECT id FROM users WHERE phone_number = $1 AND id != $2', [phone_number, userId]);
      if (existingUserByPhone.rows.length > 0) {
        console.log('❌ Phone number already taken by user ID:', existingUserByPhone.rows[0].id);
        return res.status(400).json({ error: 'Hey, that phone number is already taken by another user. Please choose a different phone number.' });
      }
    }

    console.log('🔍 Profile update route: Email and phone unique, updating database...');

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    updates.push(`name = $${++paramCount}`);
    values.push(name);
    
    updates.push(`email = $${++paramCount}`);
    values.push(email);
    
    updates.push(`phone_number = $${++paramCount}`);
    values.push(phone_number || null);
    
    updates.push(`bio = $${++paramCount}`);
    values.push(bio || null);

    if (results_public !== undefined) {
      updates.push(`results_public = $${++paramCount}`);
      values.push(results_public === true || results_public === 'true');
    }

    updates.push(`id = $${++paramCount}`);
    values.push(userId);

    // Update user profile
    await pool.query(`
      UPDATE users 
      SET ${updates.slice(0, -1).join(', ')}
      WHERE id = $${paramCount}
    `, values.slice(0, -1).concat([userId]));

    console.log('✅ Profile update route: Database update successful');
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('❌ Profile update route: Error occurred:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload profile picture
router.post('/profile-picture', authenticateToken, allowOwnProfile(), upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    let profilePictureUrl;

    if (isS3Enabled()) {
      const ext = path.extname(req.file.originalname || '.jpg').toLowerCase() || '.jpg';
      const key = `profile-pictures/profile-${userId}-${Date.now()}${ext}`;
      profilePictureUrl = await uploadBufferToS3(key, req.file.buffer, req.file.mimetype);
    } else {
      const filename = req.file.filename;
      profilePictureUrl = `/api/users/uploads/profile-pictures/${filename}`;
    }

    await pool.query('UPDATE users SET profile_picture_url = $1 WHERE id = $2', [profilePictureUrl, userId]);

    res.json({ message: 'Profile picture uploaded successfully', profilePictureUrl });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete profile picture
router.delete('/profile-picture', authenticateToken, allowOwnProfile(), async (req, res) => {
  try {
    const userId = req.user.id;

    // Get current profile picture URL
    const userResult = await pool.query('SELECT profile_picture_url FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentPictureUrl = userResult.rows[0].profile_picture_url;
    if (currentPictureUrl) {
      const s3Key = getS3KeyFromUrl(currentPictureUrl);
      if (s3Key && isS3Enabled()) {
        await deleteFromS3(s3Key);
      } else {
        const filename = currentPictureUrl.split('/').pop();
        const filepath = path.join(__dirname, '..', 'uploads', 'profile-pictures', filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      }
    }

    // Clear profile picture URL in database
    await pool.query('UPDATE users SET profile_picture_url = NULL WHERE id = $1', [userId]);

    res.json({ message: 'Profile picture deleted successfully' });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve profile pictures
router.get('/uploads/profile-pictures/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '..', 'uploads', 'profile-pictures', filename);
  
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({ error: 'Profile picture not found' });
  }
});

// Accept club charter
router.post('/accept-charter', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Allow pending and member users to accept charter
    if (req.user.role !== 'pending' && req.user.role !== 'member') {
      return res.status(403).json({ 
        error: 'Only pending and member users can accept the charter',
        required: 'pending or member',
        current: req.user.role
      });
    }

    await pool.query(`
      UPDATE users 
      SET charter_accepted = true, charter_accepted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);

    res.json({ message: 'Team charter accepted successfully' });
  } catch (error) {
    console.error('Accept charter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check for role change notifications
router.get('/role-change-notifications', authenticateToken, requireMember, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const notificationResult = await pool.query(`
      SELECT old_role, new_role, created_at, is_read
      FROM role_change_notifications 
      WHERE user_id = $1 AND is_read = false
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);
    
    if (notificationResult.rows.length > 0) {
      const notification = notificationResult.rows[0];
      res.json({
        hasNotification: true,
        oldRole: notification.old_role,
        newRole: notification.new_role,
        createdAt: notification.created_at
      });
    } else {
      res.json({ hasNotification: false });
    }
  } catch (error) {
    console.error('Role change notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark role change notification as read
router.post('/mark-role-notification-read', authenticateToken, requireMember, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await pool.query(`
      UPDATE role_change_notifications 
      SET is_read = true 
      WHERE user_id = $1 AND is_read = false
    `, [userId]);
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notification preferences
router.get('/notification-preferences', authenticateToken, allowOwnProfile(), async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(`
      SELECT 
        spin_brick_workouts,
        swim_workouts,
        run_workouts,
        events,
        forum_replies,
        waitlist_promotions
      FROM notification_preferences
      WHERE user_id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      // Return default preferences if none exist
      return res.json({
        preferences: {
          spin_brick_workouts: false,
          swim_workouts: false,
          run_workouts: false,
          events: false,
          forum_replies: false,
          waitlist_promotions: false
        }
      });
    }
    
    res.json({ preferences: result.rows[0] });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update notification preferences
router.put('/notification-preferences', authenticateToken, allowOwnProfile(), async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({ error: 'Preferences are required' });
    }
    
    // Check if preferences exist
    const checkResult = await pool.query(`
      SELECT user_id FROM notification_preferences WHERE user_id = $1
    `, [userId]);
    
    if (checkResult.rows.length === 0) {
      // Insert new preferences
      await pool.query(`
        INSERT INTO notification_preferences (
          user_id,
          spin_brick_workouts,
          swim_workouts,
          run_workouts,
          events,
          forum_replies,
          waitlist_promotions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        preferences.spin_brick_workouts || false,
        preferences.swim_workouts || false,
        preferences.run_workouts || false,
        preferences.events || false,
        preferences.forum_replies || false,
        preferences.waitlist_promotions || false
      ]);
    } else {
      // Update existing preferences
      await pool.query(`
        UPDATE notification_preferences
        SET
          spin_brick_workouts = $2,
          swim_workouts = $3,
          run_workouts = $4,
          events = $5,
          forum_replies = $6,
          waitlist_promotions = $7
        WHERE user_id = $1
      `, [
        userId,
        preferences.spin_brick_workouts || false,
        preferences.swim_workouts || false,
        preferences.run_workouts || false,
        preferences.events || false,
        preferences.forum_replies || false,
        preferences.waitlist_promotions || false
      ]);
    }
    
    res.json({ message: 'Notification preferences updated successfully' });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get calendar preferences
router.get('/calendar-preferences', authenticateToken, allowOwnProfile(), async (req, res) => {
  console.log('📅 GET /calendar-preferences: Request received');
  console.log('📅 Request user:', req.user ? { id: req.user.id, email: req.user.email } : 'No user');
  
  try {
    const userId = req.user.id;
    console.log('📅 Fetching preferences for user ID:', userId);
    
    const result = await pool.query(`
      SELECT 
        tuesday_swim,
        tuesday_track,
        thursday_swim,
        thursday_run,
        sunday_swim
      FROM calendar_preferences
      WHERE user_id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      // Return default preferences if none exist
      return res.json({
        preferences: {
          tuesday_swim: false,
          tuesday_track: false,
          thursday_swim: false,
          thursday_run: false,
          sunday_swim: false
        }
      });
    }
    
    res.json({ preferences: result.rows[0] });
  } catch (error) {
    console.error('Get calendar preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update calendar preferences
router.put('/calendar-preferences', authenticateToken, allowOwnProfile(), async (req, res) => {
  console.log('📅 PUT /calendar-preferences: Request received');
  console.log('📅 Request user:', req.user ? { id: req.user.id, email: req.user.email } : 'No user');
  console.log('📅 Request body:', JSON.stringify(req.body));
  
  try {
    const userId = req.user.id;
    const { preferences } = req.body;
    
    console.log('📅 User ID:', userId);
    console.log('📅 Preferences received:', JSON.stringify(preferences));
    
    if (!preferences) {
      console.log('📅 Error: No preferences in request body');
      return res.status(400).json({ error: 'Preferences are required' });
    }
    
    // Check if preferences exist
    console.log('📅 Checking if preferences exist for user:', userId);
    const checkResult = await pool.query(`
      SELECT user_id FROM calendar_preferences WHERE user_id = $1
    `, [userId]);
    
    console.log('📅 Check result:', checkResult.rows.length > 0 ? 'Preferences exist' : 'No preferences found');
    
    if (checkResult.rows.length === 0) {
      // Insert new preferences
      console.log('📅 Inserting new calendar preferences');
      const insertValues = [
        userId,
        preferences.tuesday_swim || false,
        preferences.tuesday_track || false,
        preferences.thursday_swim || false,
        preferences.thursday_run || false,
        preferences.sunday_swim || false
      ];
      console.log('📅 Insert values:', insertValues);
      
      await pool.query(`
        INSERT INTO calendar_preferences (
          user_id,
          tuesday_swim,
          tuesday_track,
          thursday_swim,
          thursday_run,
          sunday_swim
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, insertValues);
      
      console.log('📅 ✅ Calendar preferences inserted successfully');
    } else {
      // Update existing preferences
      console.log('📅 Updating existing calendar preferences');
      const updateValues = [
        userId,
        preferences.tuesday_swim || false,
        preferences.tuesday_track || false,
        preferences.thursday_swim || false,
        preferences.thursday_run || false,
        preferences.sunday_swim || false
      ];
      console.log('📅 Update values:', updateValues);
      
      await pool.query(`
        UPDATE calendar_preferences
        SET
          tuesday_swim = $2,
          tuesday_track = $3,
          thursday_swim = $4,
          thursday_run = $5,
          sunday_swim = $6
        WHERE user_id = $1
      `, updateValues);
      
      console.log('📅 ✅ Calendar preferences updated successfully');
    }
    
    res.json({ message: 'Calendar preferences updated successfully' });
  } catch (error) {
    console.error('📅 ❌ Update calendar preferences error:', error);
    console.error('📅 Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get workouts that match user's calendar preferences and haven't been synced
router.get('/calendar-workouts-to-sync', authenticateToken, allowOwnProfile(), async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's calendar preferences
    const prefsResult = await pool.query(`
      SELECT 
        tuesday_swim,
        tuesday_track,
        thursday_swim,
        thursday_run,
        sunday_swim
      FROM calendar_preferences
      WHERE user_id = $1
    `, [userId]);
    
    if (prefsResult.rows.length === 0) {
      return res.json({ workouts: [] });
    }
    
    const prefs = prefsResult.rows[0];
    
    // Build query to find workouts that match preferences
    // A workout matches if:
    // - It's a workout type post
    // - It has a workout_date and workout_time
    // - The day of week and workout_type match a preference
    // - It hasn't been synced to this user's calendar yet
    // - It's in the future or today
    
    const conditions = [];
    const params = [userId];
    let paramCount = 1;
    
    // Helper function to add day/type conditions
    const addCondition = (dayOfWeek, workoutType, prefValue) => {
      if (prefValue) {
        paramCount++;
        conditions.push(`(
          EXTRACT(DOW FROM workout_date) = $${paramCount}::integer
          AND workout_type = $${paramCount + 1}
        )`);
        params.push(dayOfWeek, workoutType);
        paramCount++;
      }
    };
    
    // PostgreSQL DOW: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
    addCondition(2, 'Swim', prefs.tuesday_swim); // Tuesday = 2
    addCondition(2, 'Track', prefs.tuesday_track); // Tuesday = 2
    addCondition(4, 'Swim', prefs.thursday_swim); // Thursday = 4
    addCondition(4, 'Run', prefs.thursday_run); // Thursday = 4
    addCondition(0, 'Swim', prefs.sunday_swim); // Sunday = 0
    
    if (conditions.length === 0) {
      return res.json({ workouts: [] });
    }
    
    const result = await pool.query(`
      SELECT 
        fp.id,
        fp.title,
        fp.workout_type,
        fp.workout_date,
        fp.workout_time,
        fp.content,
        fp.capacity
      FROM forum_posts fp
      WHERE fp.type = 'workout'
        AND fp.workout_date IS NOT NULL
        AND fp.workout_time IS NOT NULL
        AND fp.workout_date >= CURRENT_DATE
        AND (${conditions.join(' OR ')})
        AND NOT EXISTS (
          SELECT 1 FROM calendar_synced_workouts csw
          WHERE csw.user_id = $1 AND csw.workout_id = fp.id
        )
      ORDER BY fp.workout_date ASC, fp.workout_time ASC
    `, params);
    
    res.json({ workouts: result.rows });
  } catch (error) {
    console.error('Get calendar workouts to sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark workouts as synced to user's calendar
router.post('/calendar-mark-synced', authenticateToken, allowOwnProfile(), async (req, res) => {
  try {
    const userId = req.user.id;
    const { workoutIds } = req.body;
    
    if (!Array.isArray(workoutIds) || workoutIds.length === 0) {
      return res.status(400).json({ error: 'workoutIds array is required' });
    }
    
    // Insert all workout IDs as synced (using ON CONFLICT to handle duplicates)
    const values = workoutIds.map((id, index) => `($1, $${index + 2})`).join(', ');
    const params = [userId, ...workoutIds];
    
    await pool.query(`
      INSERT INTO calendar_synced_workouts (user_id, workout_id)
      VALUES ${values}
      ON CONFLICT (user_id, workout_id) DO NOTHING
    `, params);
    
    res.json({ message: 'Workouts marked as synced successfully' });
  } catch (error) {
    console.error('Mark workouts as synced error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Store push notification device token
router.post('/push-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, platform } = req.body;
    
    console.log(`📱 Received push token save request for user ${userId}, platform: ${platform}, token length: ${token ? token.length : 0}`);
    
    if (!token || !platform) {
      console.error('❌ Missing token or platform:', { token: !!token, platform: !!platform });
      return res.status(400).json({ error: 'Token and platform are required' });
    }
    
    // Validate and clean token format
    let cleanToken = token.trim();
    if (platform === 'ios') {
      // iOS tokens should be 64 hex characters
      if (cleanToken.length !== 64) {
        console.error(`❌ Invalid iOS token length: ${cleanToken.length} (expected 64)`);
        return res.status(400).json({ error: 'Invalid iOS token format: must be 64 hex characters' });
      }
      if (!/^[0-9a-f]{64}$/i.test(cleanToken)) {
        console.error(`❌ Invalid iOS token format: not hex. Token: ${cleanToken.substring(0, 20)}...`);
        return res.status(400).json({ error: 'Invalid iOS token format: must be hexadecimal' });
      }
      // Use lowercase for consistency
      cleanToken = cleanToken.toLowerCase();
    }
    
    // Check if token already exists for this user
    const existingToken = await pool.query(
      `SELECT id FROM push_device_tokens WHERE user_id = $1 AND token = $2`,
      [userId, cleanToken]
    );
    
    if (existingToken.rows.length > 0) {
      // Update timestamp
      await pool.query(
        `UPDATE push_device_tokens SET updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND token = $2`,
        [userId, cleanToken]
      );
      console.log(`✅ Device token updated for user ${userId}`);
      return res.json({ message: 'Device token updated successfully' });
    }
    
    // Insert new token
    await pool.query(
      `INSERT INTO push_device_tokens (user_id, token, platform) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id, token) 
       DO UPDATE SET updated_at = CURRENT_TIMESTAMP, platform = $3`,
      [userId, cleanToken, platform]
    );
    
    console.log(`✅ Device token saved successfully for user ${userId}, platform: ${platform}`);
    res.json({ message: 'Device token saved successfully' });
  } catch (error) {
    console.error('❌ Save push token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete push notification device token
router.delete('/push-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    await pool.query(
      `DELETE FROM push_device_tokens WHERE user_id = $1 AND token = $2`,
      [userId, token]
    );
    
    res.json({ message: 'Device token deleted successfully' });
  } catch (error) {
    console.error('Delete push token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Pause account (move to pending role without deleting data)
router.post('/profile/pause', authenticateToken, allowOwnProfile(), async (req, res) => {
  try {
    const userId = req.user.id;
    // Move user to pending role
    await pool.query(
      `UPDATE users 
       SET role = 'pending' 
       WHERE id = $1`,
      [userId]
    );
    res.json({ message: 'Account paused successfully' });
  } catch (error) {
    console.error('Pause account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete user account and all associated data
router.delete('/profile', authenticateToken, allowOwnProfile(), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;

    // Delete all associated data explicitly (even though CASCADE should handle it, being explicit is safer)
    await client.query('DELETE FROM workout_signups WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM workout_attendance WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM workout_waitlist WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM workout_cancellations WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM race_signups WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM login_history WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM role_change_notifications WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM push_device_tokens WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM post_likes WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM event_rsvps WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_popup_views WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM records WHERE user_id = $1', [userId]);
    
    // Soft delete forum posts (mark as deleted instead of hard delete to preserve thread structure)
    await client.query('UPDATE forum_posts SET is_deleted = true WHERE user_id = $1', [userId]);
    
    // Finally delete the user
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');
    res.json({ message: 'Account permanently deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

