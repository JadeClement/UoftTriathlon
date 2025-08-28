const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireMember } = require('../middleware/auth');

const router = express.Router();

// Get all members (admin only)
router.get('/', authenticateToken, requireMember, (req, res) => {
  try {
    db.all(`
      SELECT 
        id, email, name, role, created_at, last_login,
        join_date, payment_confirmed
      FROM users
      WHERE is_active = 1
      ORDER BY created_at DESC
    `, (err, members) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ members });
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get member by ID
router.get('/:id', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    db.get(`
      SELECT 
        id, email, name, role, created_at, last_login,
        join_date, payment_confirmed,
        emergency_contact, phone, address
      FROM users
      WHERE id = ? AND is_active = 1
    `, [id], (err, member) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      res.json({ member });
    });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update member profile
router.put('/:id', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;
    const { name, emergencyContact, phone, address } = req.body;

    // Check if user is updating their own profile or is admin
    if (req.user.id != id && req.user.role !== 'administrator') {
      return res.status(403).json({ error: 'Can only update your own profile' });
    }

    // Update user info
    db.run(`
      UPDATE users SET name = ? WHERE id = ?
    `, [name, id], function(err) {
      if (err) {
        console.error('Error updating user:', err);
        return res.status(500).json({ error: 'Error updating user' });
      }

      // Update member info
      db.run(`
        UPDATE users 
        SET emergency_contact = ?, phone = ?, address = ?
        WHERE id = ?
      `, [emergencyContact, phone, address, id], (err) => {
        if (err) {
          console.error('Error updating member:', err);
          return res.status(500).json({ error: 'Error updating member' });
        }

        res.json({ message: 'Profile updated successfully' });
      });
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout signups for a member
router.get('/:id/workouts', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is viewing their own workouts or is admin
    if (req.user.id != id && req.user.role !== 'administrator') {
      return res.status(403).json({ error: 'Can only view your own workouts' });
    }

    db.all(`
      SELECT * FROM workout_signups 
      WHERE user_id = ? 
      ORDER BY workout_date DESC, workout_time ASC
    `, [id], (err, workouts) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ workouts });
    });
  } catch (error) {
    console.error('Get workouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign up for a workout
router.post('/:id/workouts', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;
    const { workoutType, workoutDate, workoutTime, location } = req.body;

    // Check if user is signing up for themselves
    if (req.user.id != id) {
      return res.status(403).json({ error: 'Can only sign up for yourself' });
    }

    // Check if already signed up for this workout
    db.get(`
      SELECT id FROM workout_signups 
      WHERE user_id = ? AND workout_type = ? AND workout_date = ?
    `, [id, workoutType, workoutDate], (err, existing) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (existing) {
        return res.status(409).json({ error: 'Already signed up for this workout' });
      }

      // Sign up for workout
      db.run(`
        INSERT INTO workout_signups (user_id, workout_type, workout_date, workout_time, location)
        VALUES (?, ?, ?, ?, ?)
      `, [id, workoutType, workoutDate, workoutTime, location], function(err) {
        if (err) {
          console.error('Error signing up for workout:', err);
          return res.status(500).json({ error: 'Error signing up for workout' });
        }

        res.status(201).json({ 
          message: 'Successfully signed up for workout',
          signupId: this.lastID
        });
      });
    });
  } catch (error) {
    console.error('Workout signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel workout signup
router.delete('/:id/workouts/:workoutId', authenticateToken, requireMember, (req, res) => {
  try {
    const { id, workoutId } = req.params;

    // Check if user is canceling their own signup
    if (req.user.id != id) {
      return res.status(403).json({ error: 'Can only cancel your own signups' });
    }

    db.run(`
      DELETE FROM workout_signups 
      WHERE id = ? AND user_id = ?
    `, [workoutId, id], function(err) {
      if (err) {
        console.error('Error canceling workout:', err);
        return res.status(500).json({ error: 'Error canceling workout' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Workout signup not found' });
      }

      res.json({ message: 'Workout signup canceled successfully' });
    });
  } catch (error) {
    console.error('Cancel workout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get upcoming workouts
router.get('/workouts/upcoming', authenticateToken, requireMember, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    db.all(`
      SELECT 
        ws.*,
        u.name as member_name,
        u.email as member_email
      FROM workout_signups ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.workout_date >= ?
      ORDER BY ws.workout_date ASC, ws.workout_time ASC
    `, [today], (err, workouts) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ workouts });
    });
  } catch (error) {
    console.error('Get upcoming workouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
