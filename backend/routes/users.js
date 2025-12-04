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

module.exports = router;

