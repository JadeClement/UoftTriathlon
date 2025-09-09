const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireMember } = require('../middleware/auth');

const router = express.Router();

// CORS is handled by main server middleware
// Get all races
router.get('/', authenticateToken, requireMember, async (req, res) => {
  console.log('🏁 Races route: GET / reached successfully!');
  console.log('🏁 Races route: User authenticated:', !!req.user);
  console.log('🏁 Races route: User role:', req.user?.role);
  
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

    // Get signup details for each race to check if current user is signed up
    const racesWithSignups = await Promise.all(
      racesResult.rows.map(async (race) => {
        const signupsResult = await pool.query(`
          SELECT 
            rs.id, rs.user_id, rs.signup_time,
            u.name as user_name, u.role as user_role
          FROM race_signups rs
          JOIN users u ON rs.user_id = u.id
          WHERE rs.race_id = $1
          ORDER BY rs.signup_time ASC
        `, [race.id]);

        return {
          ...race,
          signups: signupsResult.rows || []
        };
      })
    );

    res.json({ races: racesWithSignups || [] });
  } catch (error) {
    console.error('Get races error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get race by ID
router.get('/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;

    const raceResult = await pool.query(`
      SELECT 
        r.id, r.name, r.date, r.location, r.description, r.created_at,
        COUNT(rs.user_id) as signup_count
      FROM races r
      LEFT JOIN race_signups rs ON r.id = rs.race_id
      WHERE r.id = $1 AND r.is_deleted = false
      GROUP BY r.id
    `, [id]);

    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    const race = raceResult.rows[0];

    // Get signups for this race
    const signupsResult = await pool.query(`
      SELECT 
        rs.id, rs.user_id, rs.signup_time,
        u.name as user_name, u.role as user_role, u.profile_picture_url as "userProfilePictureUrl"
      FROM race_signups rs
      JOIN users u ON rs.user_id = u.id
      WHERE rs.race_id = $1
      ORDER BY rs.signup_time ASC
    `, [id]);

    // Check if current user is signed up
    const isSignedUp = signupsResult.rows.some(signup => signup.user_id === req.user.id);

    res.json({ 
      race,
      signups: signupsResult.rows || [],
      isSignedUp
    });
  } catch (error) {
    console.error('Get race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new race
router.post('/', authenticateToken, requireMember, async (req, res) => {
  try {
    const { name, date, location, description } = req.body;
    const userId = req.user.id;

    if (!name || !date) {
      return res.status(400).json({ error: 'Name and date are required' });
    }

    const result = await pool.query(`
      INSERT INTO races (name, date, location, description, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING id
    `, [name, date, location || null, description || null]);

    console.log('✅ Race created successfully, ID:', result.rows[0].id);
    res.status(201).json({ 
      message: 'Race created successfully',
      raceId: result.rows[0].id
    });
  } catch (error) {
    console.error('Create race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update race
router.put('/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, location, description } = req.body;
    const userId = req.user.id;

    // Check if user can edit this race (admin/exec only)
    if (!['administrator', 'exec'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized to edit races' });
    }

    const result = await pool.query(`
      UPDATE races 
      SET name = $1, date = $2, location = $3, description = $4
      WHERE id = $5 AND is_deleted = false
    `, [name, date, location || null, description || null, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    console.log('✅ Race updated successfully');
    res.json({ message: 'Race updated successfully' });
  } catch (error) {
    console.error('Update race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete race (soft delete)
router.delete('/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user can delete this race (admin/exec only)
    if (!['administrator', 'exec'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized to delete races' });
    }

    const result = await pool.query('UPDATE races SET is_deleted = true WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    console.log('✅ Race deleted successfully');
    res.json({ message: 'Race deleted successfully' });
  } catch (error) {
    console.error('Delete race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign up for race
router.post('/:id/signup', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if race exists
    const raceResult = await pool.query('SELECT id FROM races WHERE id = $1 AND is_deleted = false', [id]);
    if (raceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Race not found' });
    }

    // Check if user is already signed up
    const existingSignup = await pool.query('SELECT id FROM race_signups WHERE user_id = $1 AND race_id = $2', [userId, id]);
    if (existingSignup.rows.length > 0) {
      return res.status(400).json({ error: 'Already signed up for this race' });
    }

    // Add signup
    await pool.query('INSERT INTO race_signups (user_id, race_id, signup_time) VALUES ($1, $2, CURRENT_TIMESTAMP)', [userId, id]);

    console.log('✅ Race signup added successfully');
    res.json({ message: 'Signed up for race successfully' });
  } catch (error) {
    console.error('Race signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel race signup
router.delete('/:id/signup', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query('DELETE FROM race_signups WHERE user_id = $1 AND race_id = $2', [userId, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Not signed up for this race' });
    }

    console.log('✅ Race signup cancelled successfully');
    res.json({ message: 'Race signup cancelled successfully' });
  } catch (error) {
    console.error('Cancel race signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
