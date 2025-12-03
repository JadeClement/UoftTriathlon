const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireAdmin, requireRole, requireCoach } = require('../middleware/auth');
const ExcelJS = require('exceljs');

// Function to convert markdown-like formatting to HTML
const formatText = (text) => {
  if (!text) return '';

  const linkifyMarkdown = (s) => s.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/gi, (_m, label, url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    const display = (label && label.trim().length > 0) ? label : url;
    return `<a href="${href}" style="color: #3b82f6; text-decoration: none;">${display}</a>`;
  });

  return linkifyMarkdown(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/\n• /g, '<br/><br/>• ') // Add extra space before bullet points
    .replace(/\n\d+\. /g, '<br/>$&') // Add single space before numbered bullets
    .replace(/\n/g, '<br/>'); // Line breaks
};

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
// Allow exec and admin to view members; restrict mutating routes to admin below
router.get('/members', authenticateToken, requireRole('exec'), async (req, res) => {
  try {
    console.log('🔍 Admin members endpoint called by user:', req.user?.email, 'role:', req.user?.role);
    const { page = 1, limit = 50, search = '', role = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE u.is_active = true';
    let params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramCount++;
    }

    if (role && role !== 'all') {
      paramCount++;
      whereClause += ` AND u.role = $${paramCount}`;
      params.push(role);
    }

    // Get total count (using users table for count)
    const countWhereClause = whereClause.replace(/u\./g, '');
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM users ${countWhereClause}`, params);
    console.log('🔍 Total members count:', countResult.rows[0].total);
    
    // Get members with term information
    // JOIN is needed to get t.term (term name) for display in the UI
    const membersResult = await pool.query(`
      SELECT 
        u.id, u.email, u.name, u.role, u.created_at,
        u.join_date, u.phone_number, u.absences, u.charter_accepted, u.sport,
        t.term
      FROM users u
      LEFT JOIN terms t ON u.term_id = t.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, limit, offset]);

    console.log('🔍 Members query returned:', membersResult.rows.length, 'members');
    console.log('🔍 Sample member:', membersResult.rows[0]);

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

    // Get current role and join_date
    const currentUser = await pool.query('SELECT role, join_date FROM users WHERE id = $1', [id]);
    const oldRole = currentUser.rows[0]?.role || req.body.oldRole || 'unknown';
    const currentJoinDate = currentUser.rows[0]?.join_date;

    // Set join_date only if:
    // 1. User is transitioning from 'pending' to any role, AND
    // 2. join_date is currently NULL
    // This preserves the original join_date if they change roles later (e.g., member -> exec)
    const shouldSetJoinDate = oldRole === 'pending' && !currentJoinDate;
    
    if (shouldSetJoinDate) {
      await pool.query('UPDATE users SET role = $1, join_date = CURRENT_DATE WHERE id = $2', [role, id]);
    } else {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    }

    // Create role change notification
    await pool.query(`
      INSERT INTO role_change_notifications (user_id, old_role, new_role)
      VALUES ($1, $2, $3)
    `, [id, oldRole, role]);

    // Send role change email notification
    console.log(`🔍 DEBUG: Starting role change email process for user ${id} from ${oldRole} to ${role}`);
    try {
      const emailService = require('../services/emailService');
      console.log(`🔍 DEBUG: EmailService loaded successfully for role change`);
      
      const userDetails = await pool.query('SELECT name, email FROM users WHERE id = $1', [id]);
      console.log(`🔍 DEBUG: User details query result for role change:`, userDetails.rows);
      
      if (userDetails.rows.length > 0) {
        const { name, email } = userDetails.rows[0];
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
    const { name, email, phone_number, role, charterAccepted, sport } = req.body;
    
    console.log('🔧 Admin update member:', { id, name, email, phone_number, role, charterAccepted });

    // Get the current role before updating to check if it actually changed
    let currentRole = null;
    if (role !== undefined) {
      const currentUserResult = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
      currentRole = currentUserResult.rows[0]?.role;
      console.log(`🔍 DEBUG: Role update requested - Current: ${currentRole}, New: ${role}`);
    }

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

    // Note: expiry_date removed - expiry is now determined by term.end_date

    if (sport !== undefined) {
      // Validate sport
      if (!['triathlon', 'duathlon', 'run_only'].includes(sport)) {
        return res.status(400).json({ error: 'Invalid sport. Must be triathlon, duathlon, or run_only' });
      }
      paramCount++;
      updates.push(`sport = $${paramCount}`);
      values.push(sport);
      console.log('🔧 Sport update:', { sport });
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

    // Send email notification if role was actually changed
    if (role !== undefined && currentRole !== null) {
      // Only send notification if the role actually changed
      if (currentRole !== role) {
        console.log(`🔍 DEBUG: Role actually changed from ${currentRole} to ${role}, sending email notification`);
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
              await emailService.sendRoleChangeNotification(email, name, currentRole, role);
              console.log(`📧 Role change notification email sent to ${email} for role change from ${currentRole} to ${role}`);
            }
          } else {
            console.log(`❌ DEBUG: No user found with id ${id} for role change email`);
          }
        } catch (emailError) {
          console.error('❌ Failed to send role change email:', emailError);
          console.error('❌ DEBUG: Full error details for role change email:', emailError.stack);
          // Don't fail the update if email fails
        }
      } else {
        console.log(`ℹ️ DEBUG: Role unchanged (${currentRole}), skipping email notification`);
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

    // Update user role and set join_date if it's not already set
    // join_date should be the first time they're approved (pending -> any role)
    // If they change roles later (member -> exec), keep the original join_date
    await pool.query(`
      UPDATE users 
      SET role = $1, 
          join_date = COALESCE(join_date, CURRENT_DATE)
      WHERE id = $2
    `, [role, id]);

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

// Send email route (execs and admins) - supports file attachments
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

router.post('/send-email', authenticateToken, requireRole('exec'), upload.array('attachments', 10), async (req, res) => {
  try {
    // Handle both JSON (backward compatibility) and multipart/form-data
    const to = req.body.to;
    const subject = req.body.subject;
    const message = req.body.message;
    const template = req.body.template ? (typeof req.body.template === 'string' ? JSON.parse(req.body.template) : req.body.template) : null;

    if (!to || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, message' });
    }

    // Get attachments from multer
    const attachments = req.files || [];

    // Import email service
    const emailService = require('../services/emailService');

    // Simple HTML wrapper for individual emails
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .content { padding: 32px 24px; }
    .message { color: #475569; font-size: 16px; line-height: 1.6; }
    .footer { background: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 0; color: #64748b; font-size: 14px; }
    .footer a { color: #3b82f6; text-decoration: none; font-weight: 500; }
    @media (max-width: 600px) {
      .email-container { margin: 0; }
      .content, .footer { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="content">
      <div class="message">${formatText(message)}<br/><br/><em style="color: #6b7280; font-style: italic;">The UofT Tri Club Exec</em></div>
    </div>
    <div class="footer">
      <p>UofT Triathlon Club | <a href="https://uoft-tri.club">uoft-tri.club</a></p>
    </div>
  </div>
</body>
</html>`;

    // Send email with attachments if any
    const result = attachments.length > 0
      ? await emailService.sendEmailWithAttachments(to, subject, htmlContent, message, attachments, process.env.AWS_FROM_EMAIL || 'info@uoft-tri.club')
      : await emailService.sendEmail(to, subject, htmlContent, message, process.env.AWS_FROM_EMAIL || 'info@uoft-tri.club');
    
    if (result.success) {
      return res.json({ message: 'Email sent successfully' });
    }
    return res.status(500).json({ error: 'Failed to send email: ' + result.error });
  } catch (error) {
    console.error('Admin send email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send bulk email route (execs and admins) - supports file attachments
router.post('/send-bulk-email', authenticateToken, requireRole('exec'), upload.array('attachments', 10), async (req, res) => {
  try {
    // Handle both JSON (backward compatibility) and multipart/form-data
    const subject = req.body.subject;
    const message = req.body.message;
    const recipients = req.body.recipients ? (typeof req.body.recipients === 'string' ? JSON.parse(req.body.recipients) : req.body.recipients) : {};
    const template = req.body.template ? (typeof req.body.template === 'string' ? JSON.parse(req.body.template) : req.body.template) : null;
    const customEmails = req.body.customEmails;
    
    // Get attachments from multer
    const attachments = req.files || [];
    
    console.log('📎 Bulk email attachments received:', {
      count: attachments.length,
      files: attachments.map(f => ({ name: f.originalname, size: f.size, mimetype: f.mimetype }))
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Bulk email request body (sanitized):', { subject, template: !!template });
    }

    if (!subject) {
      return res.status(400).json({ error: 'Missing required field: subject' });
    }

    // Check if at least one recipient group is selected or custom emails provided
    const selectedGroups = Object.values(recipients).some(selected => selected);
    const hasCustomEmails = customEmails && customEmails.trim().length > 0;
    
    if (!selectedGroups && !hasCustomEmails) {
      return res.status(400).json({ error: 'Please select at least one recipient group or provide custom email addresses' });
    }

    let recipientEmails = [];

    // Get recipients from database if any groups are selected
    if (selectedGroups) {
      // Build query to get recipients based on selected groups
      let whereConditions = [];
      let queryParams = [];
      let paramCount = 0;

      if (recipients.members || recipients.allMembers) {
        whereConditions.push(`role = $${++paramCount}`);
        queryParams.push('member');
      }
      if (recipients.exec || recipients.execs) {
        whereConditions.push(`role = $${++paramCount}`);
        queryParams.push('exec');
      }
      if (recipients.admin || recipients.admins) {
        whereConditions.push(`role = $${++paramCount}`);
        queryParams.push('administrator');
      }

      if (whereConditions.length > 0) {
        const whereClause = whereConditions.join(' OR ');
        const query = `SELECT email, name, role, is_active FROM users WHERE is_active = true AND (${whereClause})`;
        
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔍 Bulk email query (debug)');
      }
        
        const result = await pool.query(query, queryParams);
        recipientEmails = result.rows;
        
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔍 Found database recipients:', recipientEmails.length);
      }
      }
    }

    // Add custom email addresses
    if (hasCustomEmails) {
      // Parse custom emails (split by comma or newline)
      const customEmailList = customEmails
        .split(/[,\n]/)
        .map(email => email.trim())
        .filter(email => email.length > 0);

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validCustomEmails = customEmailList.filter(email => emailRegex.test(email));
      const invalidEmails = customEmailList.filter(email => !emailRegex.test(email));

      if (invalidEmails.length > 0) {
        return res.status(400).json({ 
          error: `Invalid email addresses: ${invalidEmails.join(', ')}` 
        });
      }

      // Add custom emails to recipient list
      const customRecipients = validCustomEmails.map(email => ({
        email: email,
        name: 'External Recipient',
        role: 'custom',
        is_active: true
      }));

      recipientEmails = [...recipientEmails, ...customRecipients];
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔍 Added custom recipients:', customRecipients.length);
      }
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Total recipients:', recipientEmails.length);
    }

    if (recipientEmails.length === 0) {
      return res.status(400).json({ error: 'No recipients found' });
    }

    // Import email service
    const emailService = require('../services/emailService');

    // Prepare template content
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const bannerTitle = template?.bannerTitle || `University of Toronto Triathlon Club – ${dateStr}`;
    
    // Use the new simplified template body
    const body = template?.body || message || '';

    const escapeHtml = (s = '') => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Preserve author formatting (line breaks) for intro/body
    const preserveNewlines = (s = '') => String(s)
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br>');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: #dc2626; color: #ffffff; padding: 28px 22px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.3px; }
    .content { padding: 24px 22px; }
    .content p { margin: 0 0 14px 0; color: #475569; font-size: 16px; line-height: 1.6; }
    .content ol { margin: 0 0 14px 22px; padding: 0; }
    .content li { margin: 0 0 8px 0; color: #475569; font-size: 16px; line-height: 1.6; }
    .footer { background: #f1f5f9; padding: 18px 22px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 0; color: #64748b; font-size: 14px; }
    .footer a { color: #3b82f6; text-decoration: none; font-weight: 500; }
    .footer a:hover { text-decoration: underline; }
    @media (max-width: 600px) {
      .email-container { margin: 0; }
      .header { padding: 22px 18px; }
      .header h1 { font-size: 22px; }
      .content { padding: 18px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>${escapeHtml(bannerTitle)}</h1>
    </div>
    <div class="content">
      ${body 
        ? `<p>${(body.includes('<a ') || body.includes('<A ') || body.includes('</a>')) 
            // If the editor already produced HTML links, trust the provided anchor tags
            ? body 
            // Otherwise, treat as plain text/markdown and convert to safe HTML with links
            : formatText(escapeHtml(body))
          }<br/><br/><em style="color: #6b7280; font-style: italic;">The UofT Tri Club Exec</em></p>` 
        : ''}
    </div>
    <div class="footer">
      <p>UofT Triathlon Club | <a href="https://uoft-tri.club">uoft-tri.club</a></p>
    </div>
  </div>
</body>
</html>`;

    const textContent = [bannerTitle, body]
      .filter(Boolean)
      .join('\n\n');

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

    if (process.env.NODE_ENV !== 'production') {
      console.log(`📧 Sending ${recipientEmails.length} emails in ${batches.length} batches of ${BATCH_SIZE}`);
    }

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📧 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} emails)`);
      }
      
      // Send all emails in this batch in parallel
      const batchPromises = batch.map(async (recipient) => {
        try {
          // Personalize content with recipient name
          const personalizedHtml = htmlContent.replace(/\[name\]/g, recipient.name);
          const personalizedText = textContent.replace(/\[name\]/g, recipient.name);
          
          // Send email with attachments if any
          let result;
          if (attachments.length > 0) {
            console.log(`📧 Sending bulk email with ${attachments.length} attachment(s) to ${recipient.email}`);
            result = await emailService.sendEmailWithAttachments(recipient.email, subject, personalizedHtml, personalizedText, attachments, process.env.AWS_FROM_EMAIL || 'info@uoft-tri.club');
          } else {
            console.log(`📧 Sending bulk email without attachments to ${recipient.email}`);
            result = await emailService.sendEmail(recipient.email, subject, personalizedHtml, personalizedText, process.env.AWS_FROM_EMAIL || 'info@uoft-tri.club');
          }
          
          if (result.success) {
            
            return { success: true, email: recipient.email };
          } else {
            console.error(`❌ Failed to send bulk email to recipient:`, result.error);
            return { success: false, email: recipient.email, error: result.error };
          }
        } catch (error) {
          console.error(`❌ Error sending bulk email:`, error.message);
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
        if (process.env.NODE_ENV !== 'production') {
          console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        }
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

// Send ad-hoc SMS (Test Mode only for Phase 1)
router.post('/send-sms', authenticateToken, requireRole('exec'), async (req, res) => {
  try {
    const { to, message, testMode = true } = req.body || {};

    if (!message || String(message).trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!to || String(to).trim().length === 0) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // For Phase 1 we allow only test mode to avoid accidental blasts
    if (!testMode) {
      return res.status(400).json({ error: 'Only testMode is allowed in Phase 1' });
    }

    const smsService = require('../services/smsService');
    const result = await smsService.sendSMS(to.trim(), message.trim());

    if (result.success) {
      return res.json({ message: 'SMS sent', to: to.trim(), sid: result.sid });
    }

    return res.status(500).json({ error: result.error || 'Failed to send SMS' });
  } catch (error) {
    console.error('Admin send SMS error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attendance dashboard data
router.get('/attendance-dashboard', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { page = 1, limit = 20, type = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE p.type = 'workout' AND COALESCE(p.is_deleted, false) = false";
    let params = [];
    let paramCount = 0;

    // Filter by workout type
    if (type && type !== 'all') {
      paramCount++;
      whereClause += ` AND p.workout_type = $${paramCount}`;
      params.push(type);
    }

    // Filter by attendance status
    if (status === 'submitted') {
      whereClause += ` AND EXISTS (SELECT 1 FROM workout_attendance wa WHERE wa.post_id = p.id)`;
    } else if (status === 'pending') {
      whereClause += ` AND NOT EXISTS (SELECT 1 FROM workout_attendance wa WHERE wa.post_id = p.id)`;
    }

    // Get workouts with attendance status
    const workoutsQuery = `
      SELECT 
        p.id,
        p.title,
        p.workout_type,
        p.workout_date,
        p.workout_time,
        p.capacity,
        p.created_at,
        CASE 
          WHEN EXISTS (SELECT 1 FROM workout_attendance wa WHERE wa.post_id = p.id) 
          THEN 'submitted'
          ELSE 'pending'
        END as attendance_status,
        (
          SELECT COUNT(*) 
          FROM workout_attendance wa 
          WHERE wa.post_id = p.id AND wa.attended = true
        ) + (
          SELECT COUNT(*) 
          FROM workout_cancellations wc 
          WHERE wc.post_id = p.id AND wc.marked_absent = true
        ) as attended_count,
        (
          SELECT COUNT(*) 
          FROM workout_attendance wa 
          WHERE wa.post_id = p.id
        ) + (
          SELECT COUNT(*) 
          FROM workout_cancellations wc 
          WHERE wc.post_id = p.id AND wc.marked_absent = true
        ) as total_attendance_records,
        (
          SELECT COUNT(*) 
          FROM workout_attendance wa 
          WHERE wa.post_id = p.id AND wa.late = true
        ) as late_count,
        (
          SELECT COUNT(*) 
          FROM workout_cancellations wc 
          WHERE wc.post_id = p.id AND wc.marked_absent = true
        ) as cancelled_count,
        (
          SELECT wa.recorded_at 
          FROM workout_attendance wa 
          WHERE wa.post_id = p.id 
          ORDER BY wa.recorded_at DESC 
          LIMIT 1
        ) as last_attendance_submitted,
        (
          SELECT u.name
          FROM workout_attendance wa
          LEFT JOIN users u ON wa.submitted_by = u.id
          WHERE wa.post_id = p.id
          ORDER BY wa.recorded_at DESC
          LIMIT 1
        ) as submitted_by
      FROM forum_posts p
      ${whereClause}
      ORDER BY p.workout_date DESC, p.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(parseInt(limit), offset);
    const workoutsResult = await pool.query(workoutsQuery, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM forum_posts p
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      workouts: workoutsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get attendance dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get detailed attendance for a specific workout
router.get('/attendance-dashboard/:workoutId', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { workoutId } = req.params;

    // Get workout details
    const workoutQuery = `
      SELECT 
        p.id,
        p.title,
        p.workout_type,
        p.workout_date,
        p.workout_time,
        p.capacity,
        p.content
      FROM forum_posts p
      WHERE p.id = $1 AND p.type = 'workout' AND COALESCE(p.is_deleted, false) = false
    `;
    const workoutResult = await pool.query(workoutQuery, [workoutId]);

    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    const workout = workoutResult.rows[0];

    // Get signups for this workout
    const signupsQuery = `
      SELECT 
        ws.id,
        ws.user_id,
        ws.signup_time,
        u.name as user_name,
        u.email,
        u.role,
        NULL as profile_picture_url
      FROM workout_signups ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.post_id = $1
      ORDER BY ws.signup_time ASC
    `;
    const signupsResult = await pool.query(signupsQuery, [workoutId]);

    // Get attendance records - include both attendance records and cancellations
    // Only include records for users who were actually signed up (not just on waitlist)
    // This ensures we don't show attendance for people who were never actually signed up
    const attendanceQuery = `
      WITH all_attendance AS (
        SELECT 
          wa.id,
          wa.user_id,
          wa.attended,
          wa.late,
          wa.recorded_at,
          u.name as user_name,
          u.email,
          u.role,
        NULL as profile_picture_url,
          sub.name as submitted_by_name,
          CASE 
            WHEN wc.marked_absent = true THEN 'cancelled'
            ELSE 'attended'
          END as attendance_type
        FROM workout_attendance wa
        JOIN users u ON wa.user_id = u.id
        LEFT JOIN users sub ON wa.submitted_by = sub.id
        LEFT JOIN workout_cancellations wc ON wa.post_id = wc.post_id AND wa.user_id = wc.user_id
        INNER JOIN workout_signups ws ON wa.post_id = ws.post_id AND wa.user_id = ws.user_id
        WHERE wa.post_id = $1
        
        UNION ALL
        
        SELECT 
          wc.id + 1000000 as id, -- Offset to avoid ID conflicts
          wc.user_id,
          false as attended,
          false as late,
          wc.cancelled_at as recorded_at,
          u.name as user_name,
          u.email,
          u.role,
          NULL as profile_picture_url,
          NULL as submitted_by_name,
          'cancelled' as attendance_type
        FROM workout_cancellations wc
        JOIN users u ON wc.user_id = u.id
        INNER JOIN workout_signups ws ON wc.post_id = ws.post_id AND wc.user_id = ws.user_id
        WHERE wc.post_id = $1 AND wc.marked_absent = true
        AND NOT EXISTS (
          SELECT 1 FROM workout_attendance wa2 
          WHERE wa2.post_id = wc.post_id AND wa2.user_id = wc.user_id
        )
      )
      SELECT * FROM all_attendance
      ORDER BY recorded_at DESC
    `;
    const attendanceResult = await pool.query(attendanceQuery, [workoutId]);

    // Get attendance summary - include both attendance records and cancellations
    const summaryQuery = `
      WITH all_records AS (
        SELECT 
          wa.user_id,
          wa.attended,
          wa.late,
          wa.recorded_at,
          wc.marked_absent as cancelled_absent
        FROM workout_attendance wa
        LEFT JOIN workout_cancellations wc ON wa.post_id = wc.post_id AND wa.user_id = wc.user_id
        WHERE wa.post_id = $1
        
        UNION ALL
        
        SELECT 
          wc.user_id,
          false as attended,
          false as late,
          wc.cancelled_at as recorded_at,
          wc.marked_absent as cancelled_absent
        FROM workout_cancellations wc
        WHERE wc.post_id = $1 AND wc.marked_absent = true
        AND NOT EXISTS (
          SELECT 1 FROM workout_attendance wa2 
          WHERE wa2.post_id = wc.post_id AND wa2.user_id = wc.user_id
        )
      )
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN attended = true THEN 1 END) as attended_count,
        COUNT(CASE WHEN attended = false AND (cancelled_absent = false OR cancelled_absent IS NULL) THEN 1 END) as absent_count,
        COUNT(CASE WHEN attended = false AND cancelled_absent = true THEN 1 END) as cancelled_count,
        COUNT(CASE WHEN late = true THEN 1 END) as late_count,
        MIN(recorded_at) as first_submitted,
        MAX(recorded_at) as last_submitted
      FROM all_records
    `;
    const summaryResult = await pool.query(summaryQuery, [workoutId]);

    // Log attendance details for debugging
    const cancelledUsers = attendanceResult.rows.filter(record => record.attendance_type === 'cancelled');
    if (cancelledUsers.length > 0) {
      console.log(`📋 ATTENDANCE DASHBOARD - Cancelled Users Found:`, {
        workoutId,
        workoutTitle: workout.title,
        cancelledCount: cancelledUsers.length,
        cancelledUsers: cancelledUsers.map(user => ({
          userId: user.user_id,
          userName: user.user_name,
          cancelledAt: user.recorded_at
        }))
      });
    }

    console.log(`📊 ATTENDANCE SUMMARY:`, {
      workoutId,
      workoutTitle: workout.title,
      totalRecords: summaryResult.rows[0].total_records,
      attendedCount: summaryResult.rows[0].attended_count,
      absentCount: summaryResult.rows[0].absent_count,
      cancelledCount: summaryResult.rows[0].cancelled_count,
      lateCount: summaryResult.rows[0].late_count
    });

    res.json({
      workout,
      signups: signupsResult.rows,
      attendance: attendanceResult.rows,
      summary: summaryResult.rows[0]
    });
  } catch (error) {
    console.error('Get workout attendance details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// Merch export endpoint - must be defined before module export (moved above if needed)
router.get('/merch/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get filter parameter (all, archived, not_archived) - defaults to all for export
    const filter = req.query.filter || 'all';
    
    // Build query based on filter
    let query = `SELECT first_name, last_name, email, item, size, quantity, created_at
                 FROM merch_orders`;
    
    if (filter === 'archived') {
      query += ' WHERE archived = true';
    } else if (filter === 'not_archived') {
      query += ' WHERE archived = false OR archived IS NULL';
    }
    // If filter is 'all', no WHERE clause needed
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Merch Orders');

    worksheet.columns = [
      { header: 'First Name', key: 'first_name', width: 20 },
      { header: 'Last Name', key: 'last_name', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Item', key: 'item', width: 30 },
      { header: 'Size', key: 'size', width: 12 },
      { header: 'Quantity', key: 'quantity', width: 10 }
    ];

    for (const row of result.rows) {
      worksheet.addRow(row);
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filterSuffix = filter === 'archived' ? '_archived' : filter === 'not_archived' ? '_not_archived' : '';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="merch_orders${filterSuffix}_${dateStr}.xlsx"`);

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Export merch orders error:', error);
    return res.status(500).json({ error: 'Failed to generate Excel export' });
  }
});