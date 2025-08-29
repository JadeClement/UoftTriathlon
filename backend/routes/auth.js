const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../database-pg');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Add CORS headers for auth routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://uoft-triathlon.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});
// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    if (!name || !email || !password || !phoneNumber) {
      return res.status(400).json({ error: 'Name, email, password, and phone number are required' });
    }

    // Check if user already exists with this email
    const existingUserByEmail = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUserByEmail.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Check if user already exists with this phone number
    const existingUserByPhone = await pool.query('SELECT id FROM users WHERE phone_number = $1', [phoneNumber]);
    if (existingUserByPhone.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this phone number already exists. Please use a different phone number or contact support if you believe this is an error.' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(`
      INSERT INTO users (name, email, password_hash, phone_number, role, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING id, name, email, phone_number, role
    `, [name, email, hashedPassword, phoneNumber, 'pending']);

    const user = result.rows[0];

    // Generate JWT token
    console.log('🔒 Registration Route: JWT_SECRET from env:', !!process.env.JWT_SECRET);
    console.log('🔒 Registration Route: JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'undefined');
    console.log('🔒 Registration Route: Using JWT_SECRET:', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 10) + '...' : 'undefined');
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Check if it's a unique constraint violation
    if (error.code === '23505' && error.constraint === 'users_phone_number_unique') {
      return res.status(400).json({ 
        error: 'A user with this phone number already exists. Please use a different phone number or contact support if you believe this is an error.' 
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Record login history
    await pool.query(`
      INSERT INTO login_history (user_id, ip_address, user_agent, login_time)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, [user.id, req.ip || 'unknown', req.get('User-Agent') || 'unknown']);

    // Generate JWT token
    console.log('🔒 Login Route: JWT_SECRET from env:', !!process.env.JWT_SECRET);
    console.log('🔒 Login Route: JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'undefined');
    console.log('🔒 Login Route: Using JWT_SECRET:', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 10) + '...' : 'undefined');
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        charter_accepted: user.charter_accepted,
        profile_picture_url: user.profile_picture_url,
        phone_number: user.phone_number
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(`
      SELECT id, name, email, role, created_at, phone_number, profile_picture_url, charter_accepted, bio
      FROM users 
      WHERE id = $1 AND is_active = true
    `, [req.user.id]);

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

// Profile update moved to /api/users/profile

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    // Get current user
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    const userResult = await pool.query('SELECT id, name FROM users WHERE email = $1 AND is_active = true', [email]);
    if (userResult.rows.length === 0) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const user = userResult.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now, UTC

    // Store reset token in database
    await pool.query(`
      UPDATE users 
      SET reset_token = $1, reset_token_expiry = $2
      WHERE id = $3
    `, [resetToken, resetTokenExpiry, user.id]);

    // Build reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Send email with reset link
    try {
      const { sendPasswordResetEmail } = require('../utils/mailer');
      const info = await sendPasswordResetEmail({ to: email, name: user.name, resetLink });
      console.log('✉️  Password reset email sent:', info && (info.messageId || info.response || info.accepted));
    } catch (mailError) {
      console.error('✉️  Failed to send password reset email:', mailError);
      // Do not leak email send failures to client for security; still respond with success message
    }

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user email from reset token (for auto-login after password reset)
router.get('/get-user-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find user with valid reset token
    const userResult = await pool.query(`
      SELECT email 
      FROM users 
      WHERE reset_token = $1 AND reset_token_expiry > CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
    `, [token]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = userResult.rows[0];
    res.json({ email: user.email });
  } catch (error) {
    console.error('Get user email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Find user with valid reset token
    const userResult = await pool.query(`
      SELECT id, email, reset_token_expiry 
      FROM users 
      WHERE reset_token = $1 AND reset_token_expiry > CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
    `, [token]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = userResult.rows[0];

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token
    await pool.query(`
      UPDATE users 
      SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL
      WHERE id = $2
    `, [hashedPassword, user.id]);

    // Return success with user email for auto-login
    res.json({ 
      message: 'Password reset successfully',
      email: user.email 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;
