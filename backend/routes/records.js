const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireMember } = require('../middleware/auth');

const router = express.Router();

// Get all records (optionally filtered by test_event_id)
router.get('/', authenticateToken, requireMember, async (req, res) => {
  try {
    const { test_event_id, user_id } = req.query;
    
    const params = [];
    const conditions = [];

    const buildBaseQuery = (notesColumn) => `
      SELECT 
        r.id,
        r.user_id,
        r.test_event_id,
        r.title,
        r.result,
        r.${notesColumn} as notes,
        r.created_at,
        r.updated_at,
        r.created_by,
        u.name as user_name,
        u.email as user_email,
        u.results_public,
        creator.name as created_by_name,
        te.title as test_event_title,
        te.sport as test_event_sport,
        te.date as test_event_date,
        te.workout as test_event_workout
      FROM records r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users creator ON r.created_by = creator.id
      JOIN test_events te ON r.test_event_id = te.id
    `;

    if (test_event_id) {
      params.push(test_event_id);
      conditions.push(`r.test_event_id = $${params.length}`);
    }
    
    if (user_id) {
      params.push(user_id);
      conditions.push(`r.user_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = ` ORDER BY r.created_at DESC`;

    let result;
    try {
      // Primary: assume "notes" column exists
      let query = buildBaseQuery('notes') + whereClause + orderClause;
      result = await pool.query(query, params);
    } catch (err) {
      if (err.code === '42703') {
        // Fallback: older DBs might have "description" instead
        let query = buildBaseQuery('description') + whereClause + orderClause;
        result = await pool.query(query, params);
      } else {
        throw err;
      }
    }

    res.json({ records: result.rows || [] });
  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new record
router.post('/', authenticateToken, requireMember, async (req, res) => {
  try {
    const { test_event_id, title, result, notes, user_id } = req.body;

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
      if (!['coach', 'administrator'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only coaches and admins can add records for other users' });
      }
    }

    // Check if user already has a result for this test event
    const existingRecord = await pool.query(
      'SELECT id FROM records WHERE user_id = $1 AND test_event_id = $2',
      [targetUserId, test_event_id]
    );

    if (existingRecord.rows.length > 0) {
      return res.status(409).json({ 
        error: 'duplicate_record',
        message: 'Whoops! You already have a result for this test event. Please edit that one instead.'
      });
    }

    let insertResult;

    try {
      // Primary path: databases that use the new "notes" column
      insertResult = await pool.query(`
        INSERT INTO records (user_id, test_event_id, title, result, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [targetUserId, test_event_id, title, result || null, notes || null, req.user.id]);
    } catch (err) {
      // Backwards-compat: some databases may still have "description" instead of "notes"
      if (err.code === '42703') { // undefined_column
        insertResult = await pool.query(`
          INSERT INTO records (user_id, test_event_id, title, result, description, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [targetUserId, test_event_id, title, result || null, notes || null, req.user.id]);
      } else {
        throw err;
      }
    }

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
    const { title, result, notes } = req.body;

    // Check if record exists and user has permission
    const recordCheck = await pool.query('SELECT user_id FROM records WHERE id = $1', [id]);
    if (recordCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const recordUserId = recordCheck.rows[0].user_id;
    const isOwner = recordUserId === req.user.id;
    const isAdmin = ['coach', 'administrator'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only edit your own records' });
    }

    // Build update query dynamically
    const baseUpdates = [];
    const values = [];
    let paramCount = 0;

    if (title !== undefined) {
      paramCount++;
      baseUpdates.push(`title = $${paramCount}`);
      values.push(title);
    }

    if (result !== undefined) {
      paramCount++;
      baseUpdates.push(`result = $${paramCount}`);
      values.push(result);
    }

    // We'll handle notes/description below for compatibility
    const hasNotesUpdate = notes !== undefined;

    if (!hasNotesUpdate && baseUpdates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    const idParamIndex = paramCount;
    values.push(id);

    let updateResult;

    try {
      const updates = [...baseUpdates];
      if (hasNotesUpdate) {
        paramCount = values.length - 1; // reset to last index before id
        // notes param index is the last non-id param
        const notesParamIndex = hasNotesUpdate ? (values.length) : null;
        if (hasNotesUpdate) {
          // notes value was already pushed above? It wasn't; push now.
          values.splice(values.length - 1, 0, notes);
        }
        // recompute indices: title/result/notes are before id
        // For simplicity, rebuild from scratch when notes present
        const rebuiltValues = [];
        const rebuiltUpdates = [];
        let idx = 0;
        if (title !== undefined) {
          idx++;
          rebuiltUpdates.push(`title = $${idx}`);
          rebuiltValues.push(title);
        }
        if (result !== undefined) {
          idx++;
          rebuiltUpdates.push(`result = $${idx}`);
          rebuiltValues.push(result);
        }
        if (notes !== undefined) {
          idx++;
          rebuiltUpdates.push(`notes = $${idx}`);
          rebuiltValues.push(notes);
        }
        idx++;
        rebuiltUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
        rebuiltValues.push(id);

        const query = `UPDATE records SET ${rebuiltUpdates.join(', ')} WHERE id = $${idx}`;
        updateResult = await pool.query(query, rebuiltValues);
      } else {
        // No notes field to update, just use base updates
        const finalUpdates = [...baseUpdates, `updated_at = CURRENT_TIMESTAMP`];
        const query = `UPDATE records SET ${finalUpdates.join(', ')} WHERE id = $${idParamIndex}`;
        updateResult = await pool.query(query, values);
      }
    } catch (err) {
      if (err.code === '42703' && hasNotesUpdate) {
        // Fallback for databases that still use "description" instead of "notes"
        const rebuiltValues = [];
        const rebuiltUpdates = [];
        let idx = 0;
        if (title !== undefined) {
          idx++;
          rebuiltUpdates.push(`title = $${idx}`);
          rebuiltValues.push(title);
        }
        if (result !== undefined) {
          idx++;
          rebuiltUpdates.push(`result = $${idx}`);
          rebuiltValues.push(result);
        }
        if (notes !== undefined) {
          idx++;
          rebuiltUpdates.push(`description = $${idx}`);
          rebuiltValues.push(notes);
        }
        idx++;
        rebuiltUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
        rebuiltValues.push(id);

        const fallbackQuery = `UPDATE records SET ${rebuiltUpdates.join(', ')} WHERE id = $${idx}`;
        updateResult = await pool.query(fallbackQuery, rebuiltValues);
      } else {
        throw err;
      }
    }

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

