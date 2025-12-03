const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireMember } = require('../middleware/auth');

const router = express.Router();

// Get all records (optionally filtered by test_event_id)
router.get('/', authenticateToken, requireMember, async (req, res) => {
  try {
    const { test_event_id } = req.query;
    
    let query = `
      SELECT 
        r.id,
        r.user_id,
        r.test_event_id,
        r.title,
        r.result,
        r.description,
        r.created_at,
        r.updated_at,
        r.created_by,
        u.name as user_name,
        u.email as user_email,
        creator.name as created_by_name,
        te.title as test_event_title,
        te.sport as test_event_sport,
        te.date as test_event_date
      FROM records r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users creator ON r.created_by = creator.id
      JOIN test_events te ON r.test_event_id = te.id
    `;
    
    const params = [];
    if (test_event_id) {
      query += ` WHERE r.test_event_id = $1`;
      params.push(test_event_id);
    }
    
    query += ` ORDER BY r.created_at DESC`;
    
    const result = await pool.query(query, params);
    res.json({ records: result.rows || [] });
  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new record
router.post('/', authenticateToken, requireMember, async (req, res) => {
  try {
    const { test_event_id, title, result, description, user_id } = req.body;

    if (!test_event_id || !title) {
      return res.status(400).json({ error: 'test_event_id and title are required' });
    }

    // Verify test event exists
    const testEventCheck = await pool.query('SELECT id, title FROM test_events WHERE id = $1', [test_event_id]);
    if (testEventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Test event not found' });
    }

    // Determine which user_id to use (coach/admin can add for others)
    let targetUserId = user_id || req.user.id;
    
    // If user_id is provided and different from current user, check permissions
    if (user_id && user_id !== req.user.id) {
      if (!['coach', 'exec', 'administrator'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only coaches and admins can add records for other users' });
      }
    }

    const insertResult = await pool.query(`
      INSERT INTO records (user_id, test_event_id, title, result, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [targetUserId, test_event_id, title, result || null, description || null, req.user.id]);

    res.status(201).json({ 
      message: 'Record created successfully',
      record: insertResult.rows[0]
    });
  } catch (error) {
    console.error('Create record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update record
router.put('/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, result, description } = req.body;

    // Check if record exists and user has permission
    const recordCheck = await pool.query('SELECT user_id FROM records WHERE id = $1', [id]);
    if (recordCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const recordUserId = recordCheck.rows[0].user_id;
    const isOwner = recordUserId === req.user.id;
    const isAdmin = ['coach', 'exec', 'administrator'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only edit your own records' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (title !== undefined) {
      paramCount++;
      updates.push(`title = $${paramCount}`);
      values.push(title);
    }

    if (result !== undefined) {
      paramCount++;
      updates.push(`result = $${paramCount}`);
      values.push(result);
    }

    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE records SET ${updates.join(', ')} WHERE id = $${paramCount}`;
    const updateResult = await pool.query(query, values);

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({ message: 'Record updated successfully' });
  } catch (error) {
    console.error('Update record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete record
router.delete('/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if record exists and user has permission
    const recordCheck = await pool.query('SELECT user_id FROM records WHERE id = $1', [id]);
    if (recordCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const recordUserId = recordCheck.rows[0].user_id;
    const isOwner = recordUserId === req.user.id;
    const isAdmin = ['coach', 'exec', 'administrator'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own records' });
    }

    const result = await pool.query('DELETE FROM records WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Delete record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

