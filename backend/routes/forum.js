const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireMember } = require('../middleware/auth');
const emailService = require('../services/emailService');
const { sendWaitlistPromotionNotification } = require('../services/smsService');

const router = express.Router();

// CORS is handled by main server middleware

// Get all forum posts with optional filtering
router.get('/posts', authenticateToken, requireMember, async (req, res) => {
  try {
    const { type = '', search = '', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE is_deleted = false';
    let params = [];
    let paramCount = 0;

    if (type && type !== 'all') {
      paramCount++;
      whereClause += ` AND type = $${paramCount}`;
      params.push(type);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (title ILIKE $${paramCount} OR content ILIKE $${paramCount + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramCount++;
    }

    // Get total count
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM forum_posts ${whereClause}`, params);
    
    // Get posts with user info
    const postsResult = await pool.query(`
      SELECT 
        fp.id, fp.title, fp.content, fp.type, fp.workout_type, fp.workout_date, 
        fp.workout_time, fp.capacity, fp.event_date, fp.created_at,
        u.name as author_name, u.role as author_role, u.profile_picture_url as "authorProfilePictureUrl"
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      ${whereClause}
      ORDER BY fp.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, limit, offset]);
    
    const posts = postsResult.rows;

    // Get signup counts for workouts
    if (type === 'workout' || type === '') {
      const postIds = posts.filter(p => p.type === 'workout').map(p => p.id);
      if (postIds.length > 0) {
        const placeholders = postIds.map((_, index) => `$${index + 1}`).join(',');
        const signupCountsResult = await pool.query(`
          SELECT post_id, COUNT(*) as signup_count
          FROM workout_signups
          WHERE post_id IN (${placeholders})
          GROUP BY post_id
        `, postIds);
        
        // Add signup counts to posts
        posts.forEach(post => {
          if (post.type === 'workout') {
            const signupCount = signupCountsResult.rows.find(sc => sc.post_id === post.id);
            post.signup_count = signupCount ? signupCount.signup_count : 0;
          }
        });
      }
    }
    
    res.json({
      posts: posts || [],
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
        totalPosts: countResult.rows[0].total,
        hasMore: offset + posts.length < countResult.rows[0].total
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new forum post
router.post('/posts', authenticateToken, requireMember, async (req, res) => {
  try {
    const { title, content, type, workoutType, workoutDate, workoutTime, capacity, eventDate } = req.body;
    const userId = req.user.id;

    if (!content || !type) {
      return res.status(400).json({ error: 'Content and type are required' });
    }

    const result = await pool.query(`
      INSERT INTO forum_posts (
        user_id, title, content, type, workout_type, workout_date, 
        workout_time, capacity, event_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *
    `, [userId, title, content, type, workoutType, workoutDate, workoutTime, capacity, eventDate]);

    console.log('✅ Post created successfully, ID:', result.rows[0].id);
    
    // Get the full post with user information
    const fullPostResult = await pool.query(`
      SELECT fp.*, u.name as user_name, u.profile_picture_url as "userProfilePictureUrl"
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = $1
    `, [result.rows[0].id]);
    
    res.status(201).json({ 
      message: 'Post created successfully',
      post: fullPostResult.rows[0]
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update forum post
router.put('/posts/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, workoutType, workoutDate, workoutTime, capacity, eventDate } = req.body;
    const userId = req.user.id;

    // Check if user can edit this post (author or admin/exec)
    const postResult = await pool.query(
      'SELECT user_id, type FROM forum_posts WHERE id = $1 AND is_deleted = false', 
      [id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postResult.rows[0];

    // Only author or admin/exec can edit
    if (post.user_id !== userId && !['administrator', 'exec'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }

    await pool.query(`
      UPDATE forum_posts 
      SET title = $1, content = $2, workout_type = $3, workout_date = $4, 
          workout_time = $5, capacity = $6, event_date = $7
      WHERE id = $8
    `, [title, content, workoutType, workoutDate, workoutTime, capacity, eventDate, id]);

    console.log('✅ Post updated successfully');
    res.json({ message: 'Post updated successfully' });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete forum post (soft delete)
router.delete('/posts/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user can delete this post (author or admin/exec)
    const postResult = await pool.query(
      'SELECT user_id FROM forum_posts WHERE id = $1 AND is_deleted = false', 
      [id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postResult.rows[0];

    // Only author or admin/exec can delete
    if (post.user_id !== userId && !['administrator', 'exec'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    await pool.query('UPDATE forum_posts SET is_deleted = true WHERE id = $1', [id]);

    console.log('✅ Post deleted successfully');
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle workout signup
router.post('/workouts/:id/signup', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if workout exists and has capacity
    const workoutResult = await pool.query(
      'SELECT id, capacity FROM forum_posts WHERE id = $1 AND type = $2 AND is_deleted = false', 
      [id, 'workout']
    );

    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    const workout = workoutResult.rows[0];

    // Check if user is already signed up
    const existingSignupResult = await pool.query(
      'SELECT id FROM workout_signups WHERE user_id = $1 AND post_id = $2', 
      [userId, id]
    );

    if (existingSignupResult.rows.length > 0) {
      // Remove signup
      console.log('➖ Removing signup...');
      await pool.query('DELETE FROM workout_signups WHERE id = $1', [existingSignupResult.rows[0].id]);

      console.log('✅ Signup removed successfully');
      
      // Check if there are people on the waitlist to promote
      const waitlistResult = await pool.query(`
        SELECT ww.id, ww.user_id, u.name as user_name, u.email, u.phone_number 
        FROM workout_waitlist ww 
        JOIN users u ON ww.user_id = u.id 
        WHERE ww.workout_id = $1 
        ORDER BY ww.joined_at ASC 
        LIMIT 1
      `, [id]);

      if (waitlistResult.rows.length > 0) {
        const waitlistPerson = waitlistResult.rows[0];
        // Promote first person from waitlist
        console.log('🎉 Promoting person from waitlist, ID:', waitlistPerson.id, 'Name:', waitlistPerson.user_name);
        
        // Remove from waitlist and add to signups
        await pool.query('DELETE FROM workout_waitlist WHERE id = $1', [waitlistPerson.id]);
        console.log('✅ Removed from waitlist');
        
        // Add to signups
        await pool.query(
          'INSERT INTO workout_signups (user_id, post_id, signup_time) VALUES ($1, $2, CURRENT_TIMESTAMP)', 
          [waitlistPerson.user_id, id]
        );
        console.log('✅ Successfully promoted to signups');
        
        // Get workout details for notifications
        const workoutDetailsResult = await pool.query(
          'SELECT title, workout_date FROM forum_posts WHERE id = $1', 
          [id]
        );
        
        if (workoutDetailsResult.rows.length > 0) {
          const workoutDetails = workoutDetailsResult.rows[0];
          
          // Send email notification using new email service
          try {
            await emailService.sendWaitlistPromotion(
              waitlistPerson.email,
              waitlistPerson.user_name,
              workoutDetails.title || 'Workout',
              workoutDetails.workout_date,
              workoutDetails.workout_time,
              id // workout ID for the cancellation link
            );
            console.log('📧 Email sent successfully to:', waitlistPerson.email);
          } catch (error) {
            console.log('❌ Failed to send email to:', waitlistPerson.email, error.message);
          }

          // Send SMS notification (keeping existing SMS functionality)
          if (waitlistPerson.phone_number) {
            sendWaitlistPromotionNotification(
              waitlistPerson.email,
              waitlistPerson.phone_number,
              waitlistPerson.user_name,
              workoutDetails.title || 'Workout',
              workoutDetails.workout_date
            ).then(notificationResult => {
              if (notificationResult.sms) {
                console.log('📱 SMS sent successfully to:', waitlistPerson.phone_number);
              } else {
                console.log('❌ Failed to send SMS to:', waitlistPerson.phone_number);
              }
            }).catch((error) => {
              console.log('❌ SMS notification failed:', error.message);
            });
          } else {
            console.log('📱 No phone number available for SMS');
          }
        }
      }
      
      res.json({ 
        message: 'Signup removed successfully',
        signedUp: false
      });
    } else {
      // Add signup
      console.log('➕ Adding new signup...');
      const signupResult = await pool.query(
        'INSERT INTO workout_signups (user_id, post_id, signup_time) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id', 
        [userId, id]
      );

      console.log('✅ Signup added successfully, ID:', signupResult.rows[0].id);
      res.json({ 
        message: 'Signed up successfully',
        signedUp: true
      });
    }
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout details
router.get('/workouts/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;

    const workoutResult = await pool.query(`
      SELECT 
        fp.id, fp.title, fp.content, fp.workout_type, fp.workout_date, 
        fp.workout_time, fp.capacity, fp.created_at, fp.user_id,
        u.name as author_name, u.profile_picture_url as "authorProfilePictureUrl"
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = $1 AND fp.type = 'workout' AND fp.is_deleted = false
    `, [id]);

    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    res.json({ workout: workoutResult.rows[0] });
  } catch (error) {
    console.error('Get workout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout signups
router.get('/workouts/:id/signups', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;



    const signupsResult = await pool.query(`
      SELECT 
        ws.id, ws.user_id, ws.signup_time as signed_up_at,
        u.name as user_name, u.role as user_role, u.profile_picture_url as "userProfilePictureUrl"
      FROM workout_signups ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.post_id = $1
      ORDER BY ws.signup_time ASC
    `, [id]);



    res.json({ signups: signupsResult.rows || [] });
  } catch (error) {
    console.error('Get signups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join workout waitlist
router.post('/workouts/:id/waitlist', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log('🔍 Waitlist join attempt - Workout ID:', id, 'User ID:', userId, 'User object:', req.user);

    // Check if workout exists and has capacity
    const workoutResult = await pool.query(
      'SELECT id, capacity FROM forum_posts WHERE id = $1 AND type = $2 AND is_deleted = false', 
      [id, 'workout']
    );

    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    const workout = workoutResult.rows[0];

    // Check if user is already signed up
    const existingSignupResult = await pool.query(
      'SELECT id FROM workout_signups WHERE user_id = $1 AND post_id = $2', 
      [userId, id]
    );

    if (existingSignupResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already signed up for this workout' });
    }

    // Check if user is already on waitlist
    const existingWaitlistResult = await pool.query(
      'SELECT id FROM workout_waitlist WHERE user_id = $1 AND workout_id = $2', 
      [userId, id]
    );

    if (existingWaitlistResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already on waitlist' });
    }

    // Check current signup count
    const countResult = await pool.query(
      'SELECT COUNT(*) as current_count FROM workout_signups WHERE post_id = $1', 
      [id]
    );

    const currentCount = parseInt(countResult.rows[0].current_count);
    const capacity = workout.capacity || 0;

    if (capacity > 0 && currentCount < capacity) {
      // Still has capacity, add to signups instead
      const signupResult = await pool.query(
        'INSERT INTO workout_signups (user_id, post_id, signup_time) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id', 
        [userId, id]
      );

      console.log('✅ Added to signups (capacity available), ID:', signupResult.rows[0].id);
      res.json({ message: 'Added to signups successfully' });
    } else {
      // Add to waitlist
      console.log('➕ Adding to waitlist - User ID:', userId, 'Workout ID:', id);
      const waitlistResult = await pool.query(
        'INSERT INTO workout_waitlist (user_id, workout_id) VALUES ($1, $2) RETURNING id', 
        [userId, id]
      );

      console.log('✅ Waitlist entry added successfully, ID:', waitlistResult.rows[0].id);
      res.json({ message: 'Added to waitlist successfully' });
    }
  } catch (error) {
    console.error('Join waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave workout waitlist
router.delete('/workouts/:id/waitlist', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM workout_waitlist WHERE user_id = $1 AND workout_id = $2', 
      [userId, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Not on waitlist' });
    }

    res.json({ message: 'Removed from waitlist successfully' });
  } catch (error) {
    console.error('Leave waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout waitlist
router.get('/workouts/:id/waitlist', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;

    const waitlistResult = await pool.query(`
      SELECT 
        ww.id, ww.user_id, ww.joined_at,
        u.name as user_name, u.role as user_role, u.profile_picture_url as "userProfilePictureUrl"
      FROM workout_waitlist ww
      JOIN users u ON ww.user_id = u.id
      WHERE ww.workout_id = $1
      ORDER BY ww.joined_at ASC
    `, [id]);

    res.json({ waitlist: waitlistResult.rows || [] });
  } catch (error) {
    console.error('Get waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DEBUG: Get all signups for a specific workout (temporary)
router.get('/debug/workout/:id/signups', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;

    const signupsResult = await pool.query(`
      SELECT 
        ws.id,
        ws.user_id,
        ws.signup_time,
        u.name as user_name,
        u.email,
        u.role
      FROM workout_signups ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.post_id = $1
      ORDER BY ws.signup_time ASC
    `, [id]);

    res.json({ 
      workout_id: id,
      total_signups: signupsResult.rows.length,
      signups: signupsResult.rows || [] 
    });
  } catch (error) {
    console.error('Debug signups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DEBUG: Get all forum posts (temporary)
router.get('/debug/posts', authenticateToken, requireMember, async (req, res) => {
  try {
    const postsResult = await pool.query(`
      SELECT 
        id, title, content, type, workout_type, workout_date, 
        workout_time, capacity, event_date, created_at, user_id, is_deleted
      FROM forum_posts
      ORDER BY created_at DESC
    `);

    res.json({ 
      total_posts: postsResult.rows.length,
      posts: postsResult.rows || [] 
    });
  } catch (error) {
    console.error('Debug posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
