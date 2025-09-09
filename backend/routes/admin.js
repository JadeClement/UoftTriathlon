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
    const { name, email, phone_number, role, charterAccepted } = req.body;
    
    console.log('🔧 Admin update member:', { id, name, email, phone_number, role, charterAccepted });

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
      paramCount++;
      updates.push(`email = $${paramCount}`);
      values.push(email);
    }

    if (phone_number !== undefined) {
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

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount + 1}`;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
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
    const { userId, oldRole, newRole, message } = req.body;

    if (!userId || !oldRole || !newRole) {
      return res.status(400).json({ error: 'User ID, old role, and new role are required' });
    }

    // Create role change notification
    await pool.query(`
      INSERT INTO role_change_notifications (user_id, old_role, new_role, message)
      VALUES ($1, $2, $3, $4)
    `, [userId, oldRole, newRole, message || null]);

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

module.exports = router;