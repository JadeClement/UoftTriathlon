const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// CORS is handled by main server middleware

// Get admin dashboard statistics
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get total members count
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM users WHERE is_active = true');
    
    // Get pending members count
    const pendingResult = await pool.query('SELECT COUNT(*) as pending FROM users WHERE role = $1 AND is_active = true', ['pending']);
    
    // Get active today count
    const today = new Date().toISOString().split('T')[0];
    const activeResult = await pool.query('SELECT COUNT(DISTINCT user_id) as active_today FROM login_history WHERE DATE(login_time) = $1', [today]);
    
    // Get new this week count
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const newResult = await pool.query('SELECT COUNT(*) as new_this_week FROM users WHERE DATE(created_at) >= $1', [weekAgo]);

    res.json({
      stats: {
        totalMembers: parseInt(totalResult.rows[0].total),
        pendingMembers: parseInt(pendingResult.rows[0].pending),
        activeToday: parseInt(activeResult.rows[0].active_today),
        newThisWeek: parseInt(newResult.rows[0].new_this_week)
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all members with pagination
router.get('/members', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', role = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE is_active = true';
    let params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramCount++;
    }

    if (role && role !== 'all') {
      paramCount++;
      whereClause += ` AND role = $${paramCount}`;
      params.push(role);
    }

    // Get total count
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
    
    // Get members
    const membersResult = await pool.query(`
      SELECT 
        id, email, name, role, created_at,
        join_date, expiry_date, phone_number, absences, charter_accepted
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, limit, offset]);

    res.json({
      members: membersResult.rows || [],
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
        totalMembers: parseInt(countResult.rows[0].total),
        hasMore: offset + membersResult.rows.length < countResult.rows[0].total
      }
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update member role
router.put('/members/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Check if this is the last administrator
    if (role !== 'administrator') {
      const adminCount = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true', ['administrator']);
      if (parseInt(adminCount.rows[0].count) <= 1) {
        const currentUser = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
        if (currentUser.rows[0]?.role === 'administrator') {
          return res.status(400).json({ error: 'Cannot remove the last administrator' });
        }
      }
    }

    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);

    // Create role change notification
    await pool.query(`
      INSERT INTO role_change_notifications (user_id, old_role, new_role)
      VALUES ($1, $2, $3)
    `, [id, req.body.oldRole || 'unknown', role]);

    // Send role change email notification
    console.log(`🔍 DEBUG: Starting role change email process for user ${id} from ${req.body.oldRole || 'unknown'} to ${role}`);
    try {
      const emailService = require('../services/emailService');
      console.log(`🔍 DEBUG: EmailService loaded successfully for role change`);
      
      const userDetails = await pool.query('SELECT name, email FROM users WHERE id = $1', [id]);
      console.log(`🔍 DEBUG: User details query result for role change:`, userDetails.rows);
      
      if (userDetails.rows.length > 0) {
        const { name, email } = userDetails.rows[0];
        const oldRole = req.body.oldRole || 'unknown';
        console.log(`🔍 DEBUG: Found user for role change - Name: ${name}, Email: ${email}, Old Role: ${oldRole}, New Role: ${role}`);
        
        const result = await emailService.sendRoleChangeNotification(email, name, oldRole, role);
        console.log(`🔍 DEBUG: Role change notification email result:`, result);
        console.log(`📧 Role change notification email sent to ${email} for role change from ${oldRole} to ${role}`);
      } else {
        console.log(`❌ DEBUG: No user found with id ${id} for role change`);
      }
    } catch (emailError) {
      console.error('❌ Failed to send role change email:', emailError);
      console.error('❌ DEBUG: Full error details for role change:', emailError.stack);
      // Don't fail the role update if email fails
    }

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update member charter acceptance
router.put('/members/:id/charter', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { charterAccepted } = req.body;

    if (typeof charterAccepted !== 'boolean') {
      return res.status(400).json({ error: 'charterAccepted must be a boolean' });
    }

    const result = await pool.query(
      'UPDATE users SET charter_accepted = $1, charter_accepted_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = $2',
      [charterAccepted, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Charter acceptance updated successfully' });
  } catch (error) {
    console.error('Update charter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// General member update endpoint
router.put('/members/:id/update', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone_number, role, charterAccepted, expiryDate } = req.body;
    
    console.log('🔧 Admin update member:', { id, name, email, phone_number, role, charterAccepted, expiryDate });

    // Check if this is the last administrator
    if (role && role !== 'administrator') {
      const adminCount = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true', ['administrator']);
      if (parseInt(adminCount.rows[0].count) <= 1) {
        const currentUser = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
        if (currentUser.rows[0]?.role === 'administrator') {
          return res.status(400).json({ error: 'Cannot remove the last administrator' });
        }
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      values.push(name);
    }

    if (email !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }
      paramCount++;
      updates.push(`email = $${paramCount}`);
      values.push(email);
    }

    if (phone_number !== undefined) {
      // Validate phone number format (10 digits)
      const phoneDigitsOnly = phone_number.replace(/\D/g, '');
      if (phoneDigitsOnly.length !== 10) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit phone number' });
      }
      paramCount++;
      updates.push(`phone_number = $${paramCount}`);
      values.push(phone_number);
    }

    if (role !== undefined) {
      paramCount++;
      updates.push(`role = $${paramCount}`);
      values.push(role);
    }

    if (charterAccepted !== undefined) {
      paramCount++;
      updates.push(`charter_accepted = $${paramCount}`);
      const charterValue = charterAccepted ? 1 : 0;
      values.push(charterValue);
      console.log('🔧 Charter update:', { charterAccepted, charterValue });
    }

    if (expiryDate !== undefined) {
      paramCount++;
      updates.push(`expiry_date = $${paramCount}`);
      // Convert empty string to null, otherwise use the date
      const expiryValue = expiryDate === '' ? null : expiryDate;
      values.push(expiryValue);
      console.log('🔧 Expiry date update:', { expiryDate, expiryValue });
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount + 1}`;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Send email notification if role was changed
    if (role !== undefined) {
      console.log(`🔍 DEBUG: Role was changed in update, sending email notification for role: ${role}`);
      try {
        const emailService = require('../services/emailService');
        const userDetails = await pool.query('SELECT name, email FROM users WHERE id = $1', [id]);
        
        if (userDetails.rows.length > 0) {
          const { name, email } = userDetails.rows[0];
          console.log(`🔍 DEBUG: Found user for role change email - Name: ${name}, Email: ${email}, New Role: ${role}`);
          
          if (role === 'member') {
            await emailService.sendMemberAcceptance(email, name);
            console.log(`📧 Member acceptance email sent to ${email}`);
          } else {
            // Send role change notification for other roles
            await emailService.sendRoleChangeNotification(email, name, 'unknown', role);
            console.log(`📧 Role change notification email sent to ${email} for role ${role}`);
          }
        } else {
          console.log(`❌ DEBUG: No user found with id ${id} for role change email`);
        }
      } catch (emailError) {
        console.error('❌ Failed to send role change email:', emailError);
        console.error('❌ DEBUG: Full error details for role change email:', emailError.stack);
        // Don't fail the update if email fails
      }
    }

    res.json({ message: 'Member updated successfully' });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate member (soft delete)
router.delete('/members/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if this is the last administrator
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].role === 'administrator') {
      const adminCount = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true', ['administrator']);
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last administrator' });
      }
    }

    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [id]);

    res.json({ message: 'Member deactivated successfully' });
  } catch (error) {
    console.error('Deactivate member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve pending member
router.post('/members/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role = 'member' } = req.body;

    // Validate role
    const validRoles = ['member', 'exec', 'administrator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user exists and is pending
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1 AND is_active = true', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].role !== 'pending') {
      return res.status(400).json({ error: 'User is not pending approval' });
    }

    // Update user role
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);

    // Create role change notification
    await pool.query(`
      INSERT INTO role_change_notifications (user_id, old_role, new_role)
      VALUES ($1, $2, $3)
    `, [id, 'pending', role]);

    // Send appropriate email based on role
    console.log(`🔍 DEBUG: Starting email process for user ${id} with role ${role}`);
    try {
      const emailService = require('../services/emailService');
      console.log(`🔍 DEBUG: EmailService loaded successfully`);
      
      const userDetails = await pool.query('SELECT name, email FROM users WHERE id = $1', [id]);
      console.log(`🔍 DEBUG: User details query result:`, userDetails.rows);
      
      if (userDetails.rows.length > 0) {
        const { name, email } = userDetails.rows[0];
        console.log(`🔍 DEBUG: Found user - Name: ${name}, Email: ${email}`);
        
        if (role === 'member') {
          console.log(`🔍 DEBUG: Sending member acceptance email to ${email}`);
          const result = await emailService.sendMemberAcceptance(email, name);
          console.log(`🔍 DEBUG: Member acceptance email result:`, result);
          console.log(`📧 Member acceptance email sent to ${email}`);
        } else {
          console.log(`🔍 DEBUG: Sending role change notification email to ${email} for role ${role}`);
          const result = await emailService.sendRoleChangeNotification(email, name, 'pending', role);
          console.log(`🔍 DEBUG: Role change notification email result:`, result);
          console.log(`📧 Role change notification email sent to ${email} for ${role} role`);
        }
      } else {
        console.log(`❌ DEBUG: No user found with id ${id}`);
      }
    } catch (emailError) {
      console.error('❌ Failed to send role change email:', emailError);
      console.error('❌ DEBUG: Full error details:', emailError.stack);
      // Don't fail the approval if email fails
    }

    res.json({ message: 'Member approved successfully', newRole: role });
  } catch (error) {
    console.error('Approve member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject pending member
router.post('/members/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Application rejected' } = req.body;

    // Check if user exists and is pending
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1 AND is_active = true', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].role !== 'pending') {
      return res.status(400).json({ error: 'User is not pending approval' });
    }

    // Deactivate the rejected user
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [id]);

    // Create role change notification
    await pool.query(`
      INSERT INTO role_change_notifications (user_id, old_role, new_role)
      VALUES ($1, $2, $3)
    `, [id, 'pending', 'rejected']);

    res.json({ message: 'Member rejected successfully', reason });
  } catch (error) {
    console.error('Reject member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Notify role change
router.post('/notify-role-change', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, oldRole, newRole } = req.body;

    if (!userId || !oldRole || !newRole) {
      return res.status(400).json({ error: 'User ID, old role, and new role are required' });
    }

    // Create role change notification
    await pool.query(`
      INSERT INTO role_change_notifications (user_id, old_role, new_role)
      VALUES ($1, $2, $3)
    `, [userId, oldRole, newRole]);

    res.json({ message: 'Role change notification created successfully' });
  } catch (error) {
    console.error('Create role change notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete member and all associated data
router.delete('/members/:id/permanent', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if this is the last administrator
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].role === 'administrator') {
      const adminCount = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true', ['administrator']);
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last administrator' });
      }
    }

    // Delete all associated data first (foreign key constraints will handle this)
    await pool.query('DELETE FROM workout_signups WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM workout_attendance WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM workout_waitlist WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM race_signups WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM login_history WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM role_change_notifications WHERE user_id = $1', [id]);
    
    // Delete forum posts (soft delete them first)
    await pool.query('UPDATE forum_posts SET is_deleted = true WHERE user_id = $1', [id]);
    
    // Finally delete the user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ message: 'Member permanently deleted successfully' });
  } catch (error) {
    console.error('Permanently delete member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout attendance data
router.get('/workout-attendance/:workoutId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { workoutId } = req.params;

    const attendanceResult = await pool.query(`
      SELECT 
        wa.id, wa.user_id, wa.attended, wa.recorded_at,
        u.name as user_name, u.email
      FROM workout_attendance wa
      JOIN users u ON wa.user_id = u.id
      WHERE wa.post_id = $1
      ORDER BY wa.recorded_at DESC
    `, [workoutId]);

    res.json({ attendance: attendanceResult.rows || [] });
  } catch (error) {
    console.error('Get workout attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit workout attendance
router.post('/workout-attendance/:workoutId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { workoutId } = req.params;
    const { attendanceData } = req.body;

    if (!attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({ error: 'Attendance data is required' });
    }

    // Get all signups for this workout
    const signupsResult = await pool.query(`
      SELECT ws.user_id, u.name, u.email
      FROM workout_signups ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.post_id = $1
    `, [workoutId]);

    const signups = signupsResult.rows;
    const attendedUserIds = attendanceData.map(item => item.userId);

    // Process attendance and absences
    for (const signup of signups) {
      const attended = attendedUserIds.includes(signup.user_id);
      
      // Insert or update attendance record
      await pool.query(`
        INSERT INTO workout_attendance (post_id, user_id, attended, recorded_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (post_id, user_id) 
        DO UPDATE SET attended = $3, recorded_at = CURRENT_TIMESTAMP
      `, [workoutId, signup.user_id, attended]);

      // Update absences count for users who signed up but didn't attend
      if (!attended) {
        await pool.query(`
          UPDATE users 
          SET absences = absences + 1 
          WHERE id = $1
        `, [signup.user_id]);
      }
    }

    res.json({ message: 'Attendance submitted successfully' });
  } catch (error) {
    console.error('Submit attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get race management data
router.get('/race-management', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const racesResult = await pool.query(`
      SELECT 
        r.id, r.name, r.date, r.location, r.description, r.created_at,
        COUNT(rs.user_id) as signup_count
      FROM races r
      LEFT JOIN race_signups rs ON r.id = rs.race_id
      WHERE r.is_deleted = false
      GROUP BY r.id
      ORDER BY r.date DESC
    `);

    res.json({ races: racesResult.rows || [] });
  } catch (error) {
    console.error('Get races error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete race (soft delete)
router.delete('/race-management/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('UPDATE races SET is_deleted = true WHERE id = $1', [id]);

    res.json({ message: 'Race deleted successfully' });
  } catch (error) {
    console.error('Delete race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send email route
router.post('/send-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { to, subject, message, html, template } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'Missing required fields: to, subject' });
    }

    // Import email service
    const emailService = require('../services/emailService');

    // If raw HTML provided, use it directly
    if (html) {
      const textFallback = message || html.replace(/<[^>]+>/g, ' ');
      const result = await emailService.sendEmail(to, subject, html, textFallback);
      if (result.success) return res.json({ message: 'Email sent successfully' });
      return res.status(500).json({ error: 'Failed to send email: ' + result.error });
    }

    // Structured template rendering
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const bannerTitle = template?.bannerTitle || `UofT Tri Club – ${dateStr}`;
    const title = template?.title || '';
    const intro = template?.intro || '';
    const bullets = Array.isArray(template?.bullets) ? template.bullets.filter(Boolean) : [];
    const body = template?.body || message || '';

    const escapeHtml = (s = '') => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    .container{font-family: Arial, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:0 auto; padding:20px}
    .banner{background:#dc2626; color:#fff; padding:22px 24px; border-radius:10px; text-align:center; margin-bottom:24px}
    .card{background:#f8fafc; padding:20px; border-radius:8px; margin-bottom:18px}
    .btn{background:#dc2626; color:#fff !important; padding:10px 18px; text-decoration:none; border-radius:6px; display:inline-block}
    .footer{color:#6b7280; font-size:13px; text-align:center; margin-top:24px; padding-top:16px; border-top:1px solid #e5e7eb}
    ul{margin:0; padding-left:20px}
  </style>
  </head>
  <body>
    <div class="container">
      <div class="banner"><h1 style="margin:0; font-size:22px;">${escapeHtml(bannerTitle)}</h1></div>
      ${title ? `<div class="card"><h2 style="margin:0 0 10px 0; color:#111827;">${escapeHtml(title)}</h2>${intro ? `<p style=\"margin:0\">${escapeHtml(intro)}</p>` : ''}</div>` : ''}
      ${bullets.length ? `<div class="card"><ul>${bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul></div>` : ''}
      ${body ? `<div class="card"><p style="white-space:pre-wrap; margin:0">${escapeHtml(body)}</p></div>` : ''}
      <div class="footer">UofT Triathlon Club | <a href="https://uoft-tri.club" style="color:#3b82f6; text-decoration:none;">uoft-tri.club</a></div>
    </div>
  </body>
</html>`;

    const textContent = [bannerTitle, title, intro, ...(bullets.length ? ['- ' + bullets.join('\n- ')] : []), body]
      .filter(Boolean)
      .join('\n\n');

    const result = await emailService.sendEmail(to, subject, htmlContent, textContent);
    if (result.success) {
      return res.json({ message: 'Email sent successfully' });
    }
    return res.status(500).json({ error: 'Failed to send email: ' + result.error });
  } catch (error) {
    console.error('Admin send email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send bulk email route
router.post('/send-bulk-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { subject, message, recipients } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Missing required fields: subject, message' });
    }

    // Check if at least one recipient group is selected
    const selectedGroups = Object.values(recipients).some(selected => selected);
    if (!selectedGroups) {
      return res.status(400).json({ error: 'Please select at least one recipient group' });
    }

    // Build query to get recipients based on selected groups
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (recipients.allMembers) {
      whereConditions.push(`role = $${++paramCount}`);
      queryParams.push('member');
    }
    if (recipients.execs) {
      whereConditions.push(`role = $${++paramCount}`);
      queryParams.push('exec');
    }
    if (recipients.admins) {
      whereConditions.push(`role = $${++paramCount}`);
      queryParams.push('administrator');
    }

    const whereClause = whereConditions.join(' OR ');
    const query = `SELECT email, name FROM users WHERE is_active = true AND (${whereClause})`;
    
    const result = await pool.query(query, queryParams);
    const recipientEmails = result.rows;

    if (recipientEmails.length === 0) {
      return res.status(400).json({ error: 'No recipients found for selected groups' });
    }

    // Import email service
    const emailService = require('../services/emailService');

    // Send emails in parallel with batching to respect AWS SES rate limits
    const BATCH_SIZE = 10; // Process 10 emails at a time
    const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Split recipients into batches
    const batches = [];
    for (let i = 0; i < recipientEmails.length; i += BATCH_SIZE) {
      batches.push(recipientEmails.slice(i, i + BATCH_SIZE));
    }

    console.log(`📧 Sending ${recipientEmails.length} emails in ${batches.length} batches of ${BATCH_SIZE}`);

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📧 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} emails)`);
      
      // Send all emails in this batch in parallel
      const batchPromises = batch.map(async (recipient) => {
        try {
          // Personalize message with recipient name
          const personalizedMessage = message.replace(/\[name\]/g, recipient.name);
          
          const result = await emailService.sendEmail(recipient.email, subject, personalizedMessage);
          
          if (result.success) {
            console.log(`✅ Bulk email sent to ${recipient.email}`);
            return { success: true, email: recipient.email };
          } else {
            console.error(`❌ Failed to send bulk email to ${recipient.email}:`, result.error);
            return { success: false, email: recipient.email, error: result.error };
          }
        } catch (error) {
          console.error(`❌ Error sending bulk email to ${recipient.email}:`, error);
          return { success: false, email: recipient.email, error: error.message };
        }
      });

      // Wait for all emails in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Count results
      batchResults.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`${result.email}: ${result.error}`);
        }
      });

      // Add delay between batches to respect rate limits (except for the last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Return results
    if (errorCount === 0) {
      res.json({ 
        message: 'All emails sent successfully',
        recipientCount: successCount
      });
    } else if (successCount > 0) {
      res.json({ 
        message: `Sent to ${successCount} recipients, ${errorCount} failed`,
        recipientCount: successCount,
        errors: errors.slice(0, 5) // Limit to first 5 errors
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send any emails',
        errors: errors.slice(0, 5)
      });
    }
  } catch (error) {
    console.error('Admin send bulk email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;