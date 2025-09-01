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

// Get workout by ID with signups and waitlist
router.get('/workouts/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;

    // Get workout post
    const workoutResult = await pool.query(`
      SELECT 
        fp.id, fp.title, fp.content, fp.workout_type, fp.workout_date, 
        fp.workout_time, fp.capacity, fp.created_at,
        u.name as author_name, u.role as author_role
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = $1 AND fp.type = 'workout' AND fp.is_deleted = false
    `, [id]);

    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    const workout = workoutResult.rows[0];

    // Fix invalid workout_time values
    if (workout.workout_time && (workout.workout_time === 'Invalid Date' || workout.workout_time === 'null')) {
      workout.workout_time = null;
    }

    // Get signups
    const signupsResult = await pool.query(`
      SELECT 
        ws.id, ws.user_id, ws.signup_time,
        u.name as user_name, u.role as user_role, u.profile_picture_url as "userProfilePictureUrl"
      FROM workout_signups ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.post_id = $1
      ORDER BY ws.signup_time ASC
    `, [id]);

    // Get waitlist
    const waitlistResult = await pool.query(`
      SELECT 
        ww.id, ww.user_id, ww.joined_at,
        u.name as user_name, u.role as user_role, u.profile_picture_url as "userProfilePictureUrl"
      FROM workout_waitlist ww
      JOIN users u ON ww.user_id = u.id
      WHERE ww.workout_id = $1
      ORDER BY ww.joined_at ASC
    `, [id]);

    res.json({
      workout,
      signups: signupsResult.rows || [],
      waitlist: waitlistResult.rows || []
    });
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
        ws.id, ws.user_id, ws.signup_time,
        u.name as user_name, u.role as user_role, u.profile_picture_url as "userProfilePictureUrl"
      FROM workout_signups ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.post_id = $1
      ORDER BY ws.signup_time ASC
    `, [id]);

    res.json({ signups: signupsResult.rows || [] });
  } catch (error) {
    console.error('Get workout signups error:', error);
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
    console.error('Get workout waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get event by ID
router.get('/events/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;

    // Get event post
    const eventResult = await pool.query(`
      SELECT 
        fp.id, fp.title, fp.content, fp.event_date, fp.created_at,
        u.name as author_name, u.role as author_role
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = $1 AND fp.type = 'event' AND fp.is_deleted = false
    `, [id]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Get RSVPs
    const rsvpsResult = await pool.query(`
      SELECT 
        er.id, er.user_id, er.status, er.rsvp_time,
        u.name as user_name, u.role as user_role, u.profile_picture_url as "userProfilePictureUrl"
      FROM event_rsvps er
      JOIN users u ON er.user_id = u.id
      WHERE er.post_id = $1
      ORDER BY er.rsvp_time ASC
    `, [id]);

    res.json({
      event,
      rsvps: rsvpsResult.rows || []
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout attendance
router.get('/workouts/:id/attendance', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;

    const attendanceResult = await pool.query(`
      SELECT 
        wa.id, wa.user_id, wa.attended, wa.recorded_at,
        u.name as user_name, u.role as user_role
      FROM workout_attendance wa
      JOIN users u ON wa.user_id = u.id
      WHERE wa.post_id = $1
      ORDER BY wa.recorded_at DESC
    `, [id]);

    res.json({ attendance: attendanceResult.rows || [] });
  } catch (error) {
    console.error('Get workout attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Like/unlike a post
router.post('/posts/:id/like', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const postResult = await pool.query('SELECT id FROM forum_posts WHERE id = $1 AND is_deleted = false', [id]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already liked the post
    const existingLike = await pool.query('SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2', [id, userId]);

    if (existingLike.rows.length > 0) {
      // Unlike: remove the like
      await pool.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [id, userId]);
      res.json({ message: 'Post unliked successfully', liked: false });
    } else {
      // Like: add the like
      await pool.query('INSERT INTO post_likes (post_id, user_id, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)', [id, userId]);
      res.json({ message: 'Post liked successfully', liked: true });
    }
  } catch (error) {
    console.error('Toggle post like error:', error);
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

// Clean up invalid workout_time values (admin only)
router.post('/admin/cleanup-workout-times', authenticateToken, requireMember, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ error: 'Only administrators can perform cleanup' });
    }

    // Update invalid workout_time values to NULL
    const result = await pool.query(`
      UPDATE forum_posts 
      SET workout_time = NULL 
      WHERE workout_time = 'Invalid Date' OR workout_time = 'null' OR workout_time = ''
    `);

    res.json({ 
      message: 'Workout time cleanup completed',
      rows_updated: result.rowCount
    });
  } catch (error) {
    console.error('Workout time cleanup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new workout post (exec and administrator only)
router.post('/workouts', authenticateToken, requireMember, async (req, res) => {
  try {
    // Check if user is exec or higher
    if (!['exec', 'administrator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only executives can create workout posts' });
    }

    const { title, workoutType, workoutDate, workoutTime, content, capacity } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Workout title is required' });
    }

    if (!workoutDate) {
      return res.status(400).json({ error: 'Workout date is required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    if (content.length > 1000) {
      return res.status(400).json({ error: 'Post content is too long (max 1000 characters)' });
    }

    // Validate and format workout time
    let formattedTime = null;
    if (workoutTime) {
      try {
        // Ensure workoutTime is in HH:MM format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(workoutTime)) {
          return res.status(400).json({ error: 'Workout time must be in HH:MM format (e.g., 14:30)' });
        }
        formattedTime = workoutTime;
      } catch (error) {
        console.error('Time formatting error:', error);
        return res.status(400).json({ error: 'Invalid workout time format' });
      }
    }

    // Insert the workout post
    const result = await pool.query(`
      INSERT INTO forum_posts (user_id, title, workout_type, workout_date, workout_time, content, type, capacity, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'workout', $7, CURRENT_TIMESTAMP)
      RETURNING id
    `, [req.user.id, title, workoutType, workoutDate, formattedTime, content.trim(), capacity || null]);

    const postId = result.rows[0].id;

    // Get the created post
    const postResult = await pool.query(`
      SELECT 
        fp.id, fp.content, fp.title, fp.workout_type, fp.workout_date, fp.workout_time, fp.created_at, fp.capacity,
        u.id as user_id, u.name as author_name, u.role as author_role
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = $1
    `, [postId]);

    res.status(201).json({
      message: 'Workout post created successfully',
      post: postResult.rows[0]
    });
  } catch (error) {
    console.error('Create workout post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
