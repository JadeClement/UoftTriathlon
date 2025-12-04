const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireCoach, requireMember } = require('../middleware/auth');

const router = express.Router();

// Get workouts filtered by sport and optional date (for linking to test events)
router.get('/workouts/search', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { sport, date } = req.query;
    
    if (!sport) {
      return res.status(400).json({ error: 'Sport parameter is required' });
    }

    // Map test event sport to workout types
    const workoutTypeMap = {
      'swim': ['swim'],
      'bike': ['spin', 'outdoor-ride', 'brick'],
      'run': ['run']
    };

    const workoutTypes = workoutTypeMap[sport.toLowerCase()] || [];
    
    if (workoutTypes.length === 0) {
      return res.json({ workouts: [] });
    }

    let query = `
      SELECT 
        fp.id,
        fp.title,
        fp.workout_type,
        fp.workout_date,
        fp.workout_time
      FROM forum_posts fp
      WHERE fp.type = 'workout'
        AND fp.is_deleted = false
        AND fp.workout_type = ANY($1::text[])
    `;
    
    const params = [workoutTypes];
    
    if (date) {
      query += ` AND fp.workout_date = $2`;
      params.push(date);
    }
    
    query += ` ORDER BY fp.workout_date DESC, fp.workout_time DESC LIMIT 50`;
    
    const result = await pool.query(query, params);
    res.json({ workouts: result.rows || [] });
  } catch (error) {
    console.error('Get workouts search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all test events
router.get('/', authenticateToken, requireCoach, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        te.id,
        te.title,
        te.sport,
        te.date,
        te.workout,
        te.workout_post_id,
        te.created_by,
        te.created_at,
        te.updated_at,
        u.name as created_by_name,
        fp.title as workout_post_title
      FROM test_events te
      LEFT JOIN users u ON te.created_by = u.id
      LEFT JOIN forum_posts fp ON te.workout_post_id = fp.id
      ORDER BY te.date DESC, te.created_at DESC
    `);
    res.json({ testEvents: result.rows || [] });
  } catch (error) {
    console.error('Get test events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get test event by workout_post_id (for workout detail page)
router.get('/by-workout/:workoutId', authenticateToken, requireMember, async (req, res) => {
  try {
    const { workoutId } = req.params;
    const workoutIdInt = parseInt(workoutId, 10);
    
    if (isNaN(workoutIdInt)) {
      return res.status(400).json({ error: 'Invalid workout ID' });
    }

    console.log('🔍 Fetching test event for workout ID:', workoutIdInt);

    const testEventResult = await pool.query(`
      SELECT 
        te.id,
        te.title,
        te.sport,
        te.date,
        te.workout,
        te.workout_post_id,
        te.created_by,
        te.created_at,
        te.updated_at,
        u.name as created_by_name
      FROM test_events te
      LEFT JOIN users u ON te.created_by = u.id
      WHERE te.workout_post_id = $1
    `, [workoutIdInt]);
    
    console.log('🔍 Test event query result:', testEventResult.rows.length, 'events found');

    if (testEventResult.rows.length === 0) {
      return res.json({ testEvent: null });
    }

    // Get records for this test event
    // Handle both 'notes' and 'description' column names for backwards compatibility
    // Filter: show results from users with results_public=true + user's own results + all for coaches/admins
    const userId = req.user.id;
    const userRole = req.user.role;
    const isCoachOrAdmin = ['coach', 'administrator'].includes(userRole);
    
    let recordsResult;
    try {
      let whereClause = `WHERE r.test_event_id = $1`;
      const params = [testEventResult.rows[0].id];
      
      if (!isCoachOrAdmin) {
        // For regular members: show results from users with results_public=true OR their own results
        whereClause = `WHERE r.test_event_id = $1 AND (u.results_public = true OR r.user_id = $2)`;
        params.push(userId);
      }
      
      recordsResult = await pool.query(`
        SELECT 
          r.id,
          r.user_id,
          r.test_event_id,
          r.title,
          r.result,
          r.notes,
          r.created_at,
          r.updated_at,
          r.created_by,
          u.name as user_name,
          u.email as user_email,
          u.results_public,
          creator.name as created_by_name
        FROM records r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN users creator ON r.created_by = creator.id
        ${whereClause}
        ORDER BY r.created_at DESC
      `, params);
    } catch (error) {
      // If 'notes' column doesn't exist, try 'description' instead
      if (error.code === '42703') {
        let whereClause = `WHERE r.test_event_id = $1`;
        const params = [testEventResult.rows[0].id];
        
        if (!isCoachOrAdmin) {
          whereClause = `WHERE r.test_event_id = $1 AND (u.results_public = true OR r.user_id = $2)`;
          params.push(userId);
        }
        
        recordsResult = await pool.query(`
          SELECT 
            r.id,
            r.user_id,
            r.test_event_id,
            r.title,
            r.result,
            r.description as notes,
            r.created_at,
            r.updated_at,
            r.created_by,
            u.name as user_name,
            u.email as user_email,
            u.results_public,
            creator.name as created_by_name
          FROM records r
          JOIN users u ON r.user_id = u.id
          LEFT JOIN users creator ON r.created_by = creator.id
          ${whereClause}
          ORDER BY r.created_at DESC
        `, params);
      } else {
        throw error;
      }
    }

    res.json({
      testEvent: testEventResult.rows[0],
      records: recordsResult.rows || []
    });
  } catch (error) {
    console.error('Get test event by workout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single test event with records
router.get('/:id', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { id } = req.params;

    // Get test event
    const testEventResult = await pool.query(`
      SELECT 
        te.id,
        te.title,
        te.sport,
        te.date,
        te.workout,
        te.workout_post_id,
        te.created_by,
        te.created_at,
        te.updated_at,
        u.name as created_by_name,
        fp.title as workout_post_title
      FROM test_events te
      LEFT JOIN users u ON te.created_by = u.id
      LEFT JOIN forum_posts fp ON te.workout_post_id = fp.id
      WHERE te.id = $1
    `, [id]);

    if (testEventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Test event not found' });
    }

    // Get records for this test event
    const recordsResult = await pool.query(`
      SELECT 
        r.id,
        r.user_id,
        r.test_event_id,
        r.title,
        r.result,
        r.notes,
        r.created_at,
        r.updated_at,
        r.created_by,
        u.name as user_name,
        u.email as user_email,
        creator.name as created_by_name
      FROM records r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users creator ON r.created_by = creator.id
      WHERE r.test_event_id = $1
      ORDER BY r.created_at DESC
    `, [id]);

    res.json({
      testEvent: testEventResult.rows[0],
      records: recordsResult.rows || []
    });
  } catch (error) {
    console.error('Get test event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new test event
router.post('/', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { title, sport, date, workout, workout_post_id } = req.body;

    if (!title || !sport || !date || !workout) {
      return res.status(400).json({ error: 'Title, sport, date, and workout are required' });
    }

    if (!['swim', 'bike', 'run'].includes(sport)) {
      return res.status(400).json({ error: 'Sport must be swim, bike, or run' });
    }

    const result = await pool.query(`
      INSERT INTO test_events (title, sport, date, workout, workout_post_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [title, sport, date, workout, workout_post_id || null, req.user.id]);

    res.status(201).json({ 
      message: 'Test event created successfully',
      testEvent: result.rows[0]
    });
  } catch (error) {
    console.error('Create test event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update test event
router.put('/:id', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, sport, date, workout, workout_post_id } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (title !== undefined) {
      paramCount++;
      updates.push(`title = $${paramCount}`);
      values.push(title);
    }

    if (sport !== undefined) {
      if (!['swim', 'bike', 'run'].includes(sport)) {
        return res.status(400).json({ error: 'Sport must be swim, bike, or run' });
      }
      paramCount++;
      updates.push(`sport = $${paramCount}`);
      values.push(sport);
    }

    if (date !== undefined) {
      paramCount++;
      updates.push(`date = $${paramCount}`);
      values.push(date);
    }

    if (workout !== undefined) {
      paramCount++;
      updates.push(`workout = $${paramCount}`);
      values.push(workout);
    }

    if (workout_post_id !== undefined) {
      paramCount++;
      updates.push(`workout_post_id = $${paramCount}`);
      values.push(workout_post_id || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE test_events SET ${updates.join(', ')} WHERE id = $${paramCount}`;
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Test event not found' });
    }

    res.json({ message: 'Test event updated successfully' });
  } catch (error) {
    console.error('Update test event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete test event
router.delete('/:id', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM test_events WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Test event not found' });
    }

    res.json({ message: 'Test event deleted successfully' });
  } catch (error) {
    console.error('Delete test event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

