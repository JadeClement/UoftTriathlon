const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireMember, requireAdmin, requireExec, requireCoach, requireRole } = require('../middleware/auth');
const emailService = require('../services/emailService');
const { sendWaitlistPromotionNotification } = require('../services/smsService');
const { combineDateTime, isWithinHours, getHoursUntil } = require('../utils/dateUtils');
const notificationService = require('../services/notificationService');

const router = express.Router();

// CORS is handled by main server middleware

// Custom middleware to allow members and coaches to create workouts, but only members for general posts
const requireMemberOrCoachForWorkouts = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRole = req.user.role || 'public';

  // For workout posts, allow members and coaches
  if (req.body.type === 'workout') {
    if (['member', 'coach', 'exec', 'administrator'].includes(userRole)) {
      return next();
    }
  } else {
    // For other posts, only allow members and above
    if (['member', 'coach', 'exec', 'administrator'].includes(userRole)) {
      return next();
    }
  }

  return res.status(403).json({
    error: 'Insufficient permissions',
    required: 'member or coach for workouts, member for other posts',
    current: userRole
  });
};

// Get all forum posts with optional filtering
router.get('/posts', authenticateToken, requireMember, async (req, res) => {
  try {
    const { type = '', search = '', page = 1, limit = 20, time = '', workout_type = '' } = req.query;
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

    // Optional time filter for workouts only: upcoming | past
    // Uses CURRENT_DATE to avoid timezone issues
    if (type === 'workout' && (time === 'upcoming' || time === 'past')) {
      if (time === 'upcoming') {
        whereClause += ' AND (workout_date IS NULL OR workout_date >= CURRENT_DATE)';
      } else if (time === 'past') {
        whereClause += ' AND workout_date < CURRENT_DATE';
      }
    }

    // Optional workout_type filter: accepts comma-separated list (e.g., "run,outdoor-ride,brick")
    // or single value (e.g., "bike" which maps to multiple types)
    if (type === 'workout' && workout_type && workout_type !== 'all') {
      // Handle special "bike" filter which includes multiple types
      if (workout_type === 'bike') {
        paramCount++;
        whereClause += ` AND workout_type = ANY($${paramCount}::text[])`;
        params.push(['spin', 'outdoor-ride', 'brick']);
      } else if (workout_type.includes(',')) {
        // Comma-separated list of workout types
        const types = workout_type.split(',').map(t => t.trim()).filter(t => t);
        if (types.length > 0) {
          paramCount++;
          whereClause += ` AND workout_type = ANY($${paramCount}::text[])`;
          params.push(types);
        }
      } else {
        // Single workout type
        paramCount++;
        whereClause += ` AND workout_type = $${paramCount}`;
        params.push(workout_type);
      }
    }

    // Get total count
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM forum_posts ${whereClause}`, params);
    
    // Get posts with user info
    const postsResult = await pool.query(`
      SELECT 
        fp.id, fp.title, fp.type, fp.workout_type, fp.workout_date, 
        fp.workout_time, fp.capacity, fp.event_date, fp.created_at,
        u.name as author_name, u.role as author_role, u.profile_picture_url as "authorProfilePictureUrl"
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      ${whereClause}
      ORDER BY 
        CASE WHEN fp.type = 'workout' AND fp.workout_date IS NOT NULL THEN fp.workout_date ELSE fp.created_at END DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, limit, offset]);
    
    const posts = postsResult.rows;

    // Get signup and waitlist counts for workouts
    if (type === 'workout' || type === '') {
      const postIds = posts.filter(p => p.type === 'workout').map(p => p.id);
      if (postIds.length > 0) {
        const placeholders = postIds.map((_, index) => `$${index + 1}`).join(',');
        const signupCountsResult = await pool.query(`
          SELECT post_id, COUNT(*)::int as signup_count
          FROM workout_signups
          WHERE post_id IN (${placeholders})
          GROUP BY post_id
        `, postIds);

        const waitlistCountsResult = await pool.query(`
          SELECT post_id, COUNT(*)::int as waitlist_count
          FROM workout_waitlist
          WHERE post_id IN (${placeholders})
          GROUP BY post_id
        `, postIds);
        
        // Add counts to posts
        posts.forEach(post => {
          if (post.type === 'workout') {
            const signupCount = signupCountsResult.rows.find(sc => sc.post_id === post.id);
            const waitlistCount = waitlistCountsResult.rows.find(wc => wc.post_id === post.id);
            post.signup_count = signupCount ? signupCount.signup_count : 0;
            post.waitlist_count = waitlistCount ? waitlistCount.waitlist_count : 0;
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
router.post('/posts', authenticateToken, requireMemberOrCoachForWorkouts, async (req, res) => {
  try {
    const { title, content, type, workoutType, workoutDate, workoutTime, capacity, eventDate, intervals } = req.body;
    const userId = req.user.id;

    if (!content || !type) {
      return res.status(400).json({ error: 'Content and type are required' });
    }

    // Validate and convert capacity to integer
    let capacityValue = null;
    if (capacity && capacity !== '' && !isNaN(capacity)) {
      capacityValue = parseInt(capacity, 10);
    }

    // Validate intervals (optional, iOS: array of { title, description }) -> stored in workout_intervals
    let intervalsToInsert = [];
    if (intervals && Array.isArray(intervals) && intervals.length > 0) {
      const valid = intervals.every(
        (i) => i && typeof i === 'object' && (typeof i.title === 'string' || typeof i.description === 'string')
      );
      if (valid) {
        intervalsToInsert = intervals
          .map((i, idx) => ({
            title: (i.title || '').trim(),
            description: (i.description || '').trim()
          }))
          .filter((i) => i.title || i.description)
          .map((i, idx) => ({ ...i, sort_order: idx }));
      }
    }

    console.log('🔍 Create post parameters:', {
      title, content, type, workoutType, workoutDate, workoutTime,
      capacity: capacity, capacityValue, eventDate, intervalCount: intervalsToInsert.length
    });

    const insertParams = [userId, title, content, type, workoutType, workoutDate, workoutTime, capacityValue, eventDate];
    const result = await pool.query(`
      INSERT INTO forum_posts (
        user_id, title, content, type, workout_type, workout_date,
        workout_time, capacity, event_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *
    `, insertParams);

    const postId = result.rows[0].id;
    console.log('✅ Post created successfully, ID:', postId);

    // Insert intervals into workout_intervals (for workout posts)
    if (type === 'workout' && intervalsToInsert.length > 0) {
      for (let i = 0; i < intervalsToInsert.length; i++) {
        const inv = intervalsToInsert[i];
        await pool.query(`
          INSERT INTO workout_intervals (post_id, title, description, sort_order)
          VALUES ($1, $2, $3, $4)
        `, [postId, inv.title, inv.description, inv.sort_order]);
      }
      console.log('✅ Inserted', intervalsToInsert.length, 'intervals');
    }
    
    // Get the full post with user information
    const fullPostResult = await pool.query(`
      SELECT fp.*, u.name as user_name, u.profile_picture_url as "userProfilePictureUrl"
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = $1
    `, [postId]);

    const post = fullPostResult.rows[0];
    
    // Send notifications based on post type (non-blocking)
    setImmediate(async () => {
      try {
        if (type === 'workout' && workoutType) {
          await notificationService.notifyWorkoutPosted(workoutType, {
            id: post.id,
            title: post.title || 'Workout',
            workoutDate: post.workout_date,
            workoutTime: post.workout_time,
            content: post.content
          });
        } else if (type === 'event') {
          await notificationService.notifyEventPosted({
            id: post.id,
            title: post.title || 'Event',
            eventDate: post.event_date,
            content: post.content
          });
        }
      } catch (error) {
        console.error('Error sending notifications:', error);
      }
    });
    
    res.status(201).json({ 
      message: 'Post created successfully',
      post: post
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update forum post
router.put('/posts/:id', authenticateToken, requireMember, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const { id } = req.params;
    const { title, content, workoutType, workoutDate, workoutTime, capacity, eventDate } = req.body;
    const userId = req.user.id;

    // Check if user can edit this post (author or admin/exec), and get type/capacity for waitlist logic
    const postResult = await client.query(
      'SELECT user_id, type, capacity FROM forum_posts WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (postResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postResult.rows[0];

    // Only author or admin/exec can edit
    if (post.user_id !== userId && !['administrator', 'exec'].includes(req.user.role)) {
      client.release();
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }

    // Validate and convert capacity to integer
    let capacityValue = null;
    if (capacity && capacity !== '' && !isNaN(capacity)) {
      capacityValue = parseInt(capacity, 10);
    }

    console.log('🔍 Update post parameters:', {
      title, content, workoutType, workoutDate, workoutTime,
      capacity: capacity, capacityValue, eventDate, id
    });

    await client.query('BEGIN');

    await client.query(`
      UPDATE forum_posts
      SET title = $1, content = $2, workout_type = $3, workout_date = $4,
          workout_time = $5, capacity = $6, event_date = $7
      WHERE id = $8
    `, [title, content, workoutType, workoutDate, workoutTime, capacityValue, eventDate, id]);

    const promoted = [];
    if (post.type === 'workout' && capacityValue != null && capacityValue > 0) {
      const signupCountResult = await client.query(
        'SELECT COUNT(*)::int AS cnt FROM workout_signups WHERE post_id = $1',
        [id]
      );
      const signupCount = signupCountResult.rows[0].cnt;
      const slotsAvailable = Math.max(0, capacityValue - signupCount);

      if (slotsAvailable > 0) {
        let promotedCount = 0;
        while (promotedCount < slotsAvailable) {
          const waitlistResult = await client.query(
            `SELECT ww.id, ww.user_id, u.name AS user_name, u.email, u.phone_number
             FROM workout_waitlist ww
             JOIN users u ON u.id = ww.user_id
             WHERE ww.post_id = $1
             ORDER BY ww.joined_at ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 1`,
            [id]
          );
          if (waitlistResult.rows.length === 0) break;

          const w = waitlistResult.rows[0];
          await client.query('DELETE FROM workout_waitlist WHERE id = $1', [w.id]);
          await client.query(
            'INSERT INTO workout_signups (user_id, post_id, signup_time) VALUES ($1, $2, CURRENT_TIMESTAMP)',
            [w.user_id, id]
          );
          promoted.push({
            id: w.user_id,
            email: w.email,
            phone_number: w.phone_number || null,
            name: w.user_name
          });
          promotedCount++;
          console.log('✅ Capacity increase: promoted waitlist user:', { workoutId: id, waitlistUserId: w.user_id, waitlistUserName: w.user_name });
        }
      }
    }

    await client.query('COMMIT');
    client.release();

    // Notifications are best-effort after commit
    if (promoted.length > 0) {
      const workoutDetailsResult = await pool.query(
        'SELECT title, workout_date AS workout_date, workout_time AS workout_time FROM forum_posts WHERE id = $1',
        [id]
      );
      const workoutData = workoutDetailsResult.rows[0]
        ? { id, title: workoutDetailsResult.rows[0].title, workoutDate: workoutDetailsResult.rows[0].workout_date, workoutTime: workoutDetailsResult.rows[0].workout_time }
        : { id, title, workoutDate: workoutDate, workoutTime: workoutTime };
      setImmediate(async () => {
        for (const userData of promoted) {
          try {
            await notificationService.notifyWaitlistPromotion(
              { id: userData.id, email: userData.email, phone: userData.phone_number, name: userData.name },
              workoutData
            );
          } catch (e) {
            console.log('Waitlist promotion notification error:', e.message);
          }
        }
      });
    }

    console.log('✅ Post updated successfully');
    res.json({ message: 'Post updated successfully' });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) { /* ignore */ }
    if (client) client.release();
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete forum post (hard delete for workouts, soft delete for others)
router.delete('/posts/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user can delete this post (author or admin/exec)
    const postResult = await pool.query(
      'SELECT user_id, type FROM forum_posts WHERE id = $1 AND is_deleted = false', 
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

    if (post.type === 'workout') {
      // Hard delete for workouts - delete all related data first
      await pool.query('DELETE FROM workout_signups WHERE post_id = $1', [id]);
      await pool.query('DELETE FROM workout_attendance WHERE post_id = $1', [id]);
      await pool.query('DELETE FROM workout_waitlist WHERE post_id = $1', [id]);
      await pool.query('DELETE FROM workout_cancellations WHERE post_id = $1', [id]);
      await pool.query('DELETE FROM forum_posts WHERE id = $1', [id]);
      console.log('✅ Workout hard deleted successfully');
    } else {
      // Soft delete for other forum posts
      await pool.query('UPDATE forum_posts SET is_deleted = true WHERE id = $1', [id]);
      console.log('✅ Post soft deleted successfully');
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle workout signup
router.post('/workouts/:id/signup', authenticateToken, requireMember, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Verify workout exists and lock the row for capacity checks
    const workoutResult = await client.query(
      `SELECT id, capacity 
       FROM forum_posts 
       WHERE id = $1 AND type = 'workout' AND is_deleted = false 
       FOR UPDATE`,
      [id]
    );
    if (workoutResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Workout not found' });
    }

    // Check if user already signed up (toggle remove)
    const existingSignup = await client.query(
      'SELECT id FROM workout_signups WHERE user_id = $1 AND post_id = $2',
      [userId, id]
    );

    if (existingSignup.rows.length > 0) {
      // Check if cancellation is within 12 hours of workout start
      const workoutDetails = await client.query(
        `SELECT workout_date, workout_time, title FROM forum_posts WHERE id = $1`,
        [id]
      );
      
      let within12hrs = false;
      let workoutTitle = 'Unknown Workout';
      if (workoutDetails.rows.length > 0) {
        const workout = workoutDetails.rows[0];
        workoutTitle = workout.title || 'Untitled Workout';
        
        // Use standardized date utilities
        const workoutDateTime = combineDateTime(workout.workout_date, workout.workout_time);
        
        if (!workoutDateTime) {
          console.log(`⚠️ Invalid workout date/time for workout ${id}:`, { 
            date: workout.workout_date, 
            time: workout.workout_time 
          });
          within12hrs = false;
        } else {
          within12hrs = isWithinHours(workoutDateTime, 12);
          const hoursUntilWorkout = getHoursUntil(workoutDateTime);
          
          console.log(`🕐 Time calculation details:`, {
            workoutDateTime: workoutDateTime.toISOString(),
            currentTime: new Date().toISOString(),
            hoursUntilWorkout: hoursUntilWorkout.toFixed(2),
            isInPast: hoursUntilWorkout < 0,
            isWithin12hrs: within12hrs
          });
        }
        
        console.log(`🔄 Workout Cancellation Check:`, {
          workoutId: id,
          workoutTitle,
          workoutDateTime: workoutDateTime && !isNaN(workoutDateTime.getTime()) ? workoutDateTime.toISOString() : 'Invalid Date',
          currentTime: new Date().toISOString(),
          hoursUntilWorkout: workoutDateTime ? getHoursUntil(workoutDateTime).toFixed(2) : 'N/A',
          within12hrs,
          userId: userId
        });
      }

      // Create cancellation record if within 12 hours
      if (within12hrs) {
        console.log(`⚠️ CANCELLATION WITHIN 12 HOURS - Processing Absence:`, {
          workoutId: id,
          workoutTitle,
          userId: userId,
          action: 'Marking as absent due to late cancellation'
        });

        await client.query(`
          INSERT INTO workout_cancellations (post_id, user_id, cancelled_at, within_12hrs, marked_absent)
          VALUES ($1, $2, CURRENT_TIMESTAMP, true, true)
          ON CONFLICT (post_id, user_id) DO UPDATE SET
            cancelled_at = CURRENT_TIMESTAMP,
            within_12hrs = true,
            marked_absent = true
        `, [id, userId]);

        // Mark as absent in attendance table
        await client.query(`
          INSERT INTO workout_attendance (post_id, user_id, attended, recorded_at)
          VALUES ($1, $2, false, CURRENT_TIMESTAMP)
          ON CONFLICT (post_id, user_id) DO UPDATE SET
            attended = false,
            recorded_at = CURRENT_TIMESTAMP
        `, [id, userId]);

        // Get current absence count before incrementing
        const currentAbsencesResult = await client.query(
          'SELECT absences FROM users WHERE id = $1',
          [userId]
        );
        const currentAbsences = currentAbsencesResult.rows[0]?.absences || 0;

        // Increment user's absence count
        await client.query(
          'UPDATE users SET absences = absences + 1 WHERE id = $1',
          [userId]
        );

        // Get updated absence count
        const updatedAbsencesResult = await client.query(
          'SELECT absences FROM users WHERE id = $1',
          [userId]
        );
        const updatedAbsences = updatedAbsencesResult.rows[0]?.absences || 0;

        console.log(`📊 USER ABSENCE COUNT UPDATED:`, {
          userId: userId,
          workoutId: id,
          workoutTitle,
          previousAbsences: currentAbsences,
          newAbsences: updatedAbsences,
          increment: updatedAbsences - currentAbsences
        });
      } else {
        console.log(`✅ CANCELLATION OUTSIDE 12 HOURS - No Absence:`, {
          workoutId: id,
          workoutTitle,
          userId: userId,
          action: 'Cancellation recorded but no absence marked'
        });

        // Outside 12 hours - just create cancellation record without marking absent
        await client.query(`
          INSERT INTO workout_cancellations (post_id, user_id, cancelled_at, within_12hrs, marked_absent)
          VALUES ($1, $2, CURRENT_TIMESTAMP, false, false)
          ON CONFLICT (post_id, user_id) DO UPDATE SET
            cancelled_at = CURRENT_TIMESTAMP,
            within_12hrs = false,
            marked_absent = false
        `, [id, userId]);
      }

      // Remove signup
      await client.query('DELETE FROM workout_signups WHERE id = $1', [existingSignup.rows[0].id]);

      // Get workout details for email notifications (reuse data already fetched)
      const workoutDetailsForEmail = workoutDetails.rows[0] || {};

      // Handle waitlist based on cancellation timing
      const waitlistResult = await client.query(
        `SELECT ww.id, ww.user_id, u.name as user_name, u.email, u.phone_number
         FROM workout_waitlist ww
         JOIN users u ON ww.user_id = u.id
         WHERE ww.post_id = $1
         ORDER BY ww.joined_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [id]
      );

      if (waitlistResult.rows.length > 0) {
        const w = waitlistResult.rows[0];
        
        if (within12hrs) {
          // Within 12 hours: Don't auto-promote, just send last minute cancellation opportunity email
          // Keep them on the waitlist so they can manually sign up
          console.log(`📧 Last minute cancellation - sending opportunity email to waitlist user:`, {
            workoutId: id,
            workoutTitle: workoutTitle,
            waitlistUserId: w.user_id,
            waitlistUserName: w.user_name
          });
          
          // Notifications are best-effort after commit
          setImmediate(async () => {
            try {
              await emailService.sendLastMinuteCancellationOpportunity(
                w.email,
                w.user_name,
                workoutDetailsForEmail.title || workoutTitle || 'Workout',
                workoutDetailsForEmail.workout_date,
                workoutDetailsForEmail.workout_time,
                id
              );
            } catch (e) {
              console.log('Last minute cancellation opportunity email error:', e.message);
            }
          });
        } else {
          // Outside 12 hours: Auto-promote waitlist person (existing behavior)
          await client.query('DELETE FROM workout_waitlist WHERE id = $1', [w.id]);
          await client.query(
            'INSERT INTO workout_signups (user_id, post_id, signup_time) VALUES ($1, $2, CURRENT_TIMESTAMP)',
            [w.user_id, id]
          );
          
          console.log(`✅ Auto-promoted waitlist user:`, {
            workoutId: id,
            workoutTitle: workoutTitle,
            waitlistUserId: w.user_id,
            waitlistUserName: w.user_name
          });
          
          // Notifications are best-effort after commit
          setImmediate(async () => {
            try {
              // Use notification service which checks preferences
              await notificationService.notifyWaitlistPromotion(
                {
                  id: w.user_id,
                  email: w.email,
                  phone: w.phone_number || null,
                  name: w.user_name
                },
                {
                  id: id,
                  title: workoutDetailsForEmail.title || 'Workout',
                  workoutDate: workoutDetailsForEmail.workout_date,
                  workoutTime: workoutDetailsForEmail.workout_time
                }
              );
            } catch (e) {
              console.log('Waitlist promotion notification error:', e.message);
            }
          });
        }
      }

      await client.query('COMMIT');
      
      const message = within12hrs 
        ? 'Signup cancelled. This counts as an absence due to cancellation within 12 hours.'
        : 'Signup cancelled successfully.';
      
      console.log(`✅ CANCELLATION COMPLETED:`, {
        workoutId: id,
        workoutTitle,
        userId: userId,
        within12hrs,
        markedAbsent: within12hrs,
        message
      });
        
      return res.json({ 
        message, 
        signedUp: false, 
        within12hrs,
        markedAbsent: within12hrs
      });
    }

    // Attempt atomic insert only if capacity not reached (treat NULL capacity as unlimited)
    const insertResult = await client.query(
      `WITH w AS (
         SELECT COALESCE(capacity, 2147483647) AS capacity
         FROM forum_posts WHERE id = $1 AND type = 'workout' AND is_deleted = false
       ),
       c AS (
         SELECT COUNT(*)::int AS cnt FROM workout_signups WHERE post_id = $1
       )
       INSERT INTO workout_signups (user_id, post_id, signup_time)
       SELECT $2, $1, CURRENT_TIMESTAMP
       FROM w, c
       WHERE c.cnt < w.capacity
       RETURNING id`,
      [id, userId]
    );

    if (insertResult.rows.length === 0) {
      // Full: join waitlist if not already on it
      const existingWait = await client.query(
        'SELECT id FROM workout_waitlist WHERE user_id = $1 AND post_id = $2',
        [userId, id]
      );
      if (existingWait.rows.length === 0) {
        await client.query(
          'INSERT INTO workout_waitlist (user_id, post_id) VALUES ($1, $2)',
          [userId, id]
        );
      }
      await client.query('COMMIT');
      return res.json({ message: 'Workout is full. You have been added to the waitlist.', signedUp: false, joinedWaitlist: true });
    }

    await client.query('COMMIT');
    return res.json({ message: 'Signed up successfully', signedUp: true });
  } catch (error) {
    await (async () => { try { await client.query('ROLLBACK'); } catch (_) {} })();
    console.error('❌ Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
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
        fp.workout_time, fp.capacity, fp.created_at, fp.user_id,
        u.name as author_name, u.role as author_role, u.profile_picture_url as "authorProfilePictureUrl"
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
      WHERE ww.post_id = $1
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
      WHERE ww.post_id = $1
      ORDER BY ww.joined_at ASC
    `, [id]);

    res.json({ waitlist: waitlistResult.rows || [] });
  } catch (error) {
    console.error('Get workout waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout intervals (coach-defined)
router.get('/workouts/:id/intervals', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, post_id, title, description, sort_order
      FROM workout_intervals
      WHERE post_id = $1
      ORDER BY sort_order ASC, id ASC
    `, [id]);
    res.json({ intervals: result.rows || [] });
  } catch (error) {
    console.error('Get workout intervals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add interval to workout (coach/admin/exec only)
router.post('/workouts/:id/intervals', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Interval title is required' });
    }

    const workoutCheck = await pool.query(
      'SELECT id FROM forum_posts WHERE id = $1 AND type = \'workout\' AND is_deleted = false',
      [id]
    );
    if (workoutCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM workout_intervals WHERE post_id = $1',
      [id]
    );
    const sortOrder = maxOrder.rows[0]?.next_order ?? 0;

    const result = await pool.query(`
      INSERT INTO workout_intervals (post_id, title, description, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING id, post_id, title, description, sort_order
    `, [id, String(title).trim(), description ? String(description).trim() : null, sortOrder]);

    res.status(201).json({ interval: result.rows[0], message: 'Interval added' });
  } catch (error) {
    console.error('Add workout interval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get interval results for a workout (coaches see all, members see public + own)
router.get('/workouts/:id/interval-results', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isCoachOrAdmin = ['coach', 'administrator', 'exec'].includes(req.user.role || '');

    const result = await pool.query(`
      SELECT 
        ir.id, ir.post_id, ir.interval_id, ir.user_id, ir.time, ir.average_hr, ir.average_sc, ir.created_at,
        u.name as user_name,
        wi.title as interval_title, wi.description as interval_description
      FROM interval_results ir
      JOIN users u ON ir.user_id = u.id
      JOIN workout_intervals wi ON ir.interval_id = wi.id
      WHERE ir.post_id = $1
        AND (${isCoachOrAdmin ? '1=1' : 'u.results_public = true OR ir.user_id = $2'})
      ORDER BY ir.user_id, wi.sort_order, wi.id
    `, isCoachOrAdmin ? [id] : [id, userId]);

    res.json({ intervalResults: result.rows || [] });
  } catch (error) {
    console.error('Get interval results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit interval results for a workout (upsert per user)
router.post('/workouts/:id/interval-results', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const { results } = req.body; // [{ interval_id, time, average_hr?, average_sc? }, ...]
    const userId = req.user.id;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'results array with interval_id and time is required' });
    }

    // Verify workout exists
    const workoutCheck = await pool.query(
      'SELECT id FROM forum_posts WHERE id = $1 AND type = \'workout\' AND is_deleted = false',
      [id]
    );
    if (workoutCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    // Verify all intervals belong to this workout
    const intervalIds = results.map((r) => r.interval_id).filter(Boolean);
    if (intervalIds.length === 0) {
      return res.status(400).json({ error: 'At least one interval_id required' });
    }

    const intervalCheck = await pool.query(
      'SELECT id FROM workout_intervals WHERE post_id = $1 AND id = ANY($2)',
      [id, intervalIds]
    );
    if (intervalCheck.rows.length !== intervalIds.length) {
      return res.status(400).json({ error: 'Invalid interval_id(s) for this workout' });
    }

    for (const r of results) {
      if (!r.interval_id || r.time == null || r.time === '') continue;
      const avgHr = r.average_hr != null && String(r.average_hr).trim() !== '' ? String(r.average_hr).trim() : null;
      const avgSc = r.average_sc != null && String(r.average_sc).trim() !== '' ? String(r.average_sc).trim() : null;
      await pool.query(`
        INSERT INTO interval_results (post_id, interval_id, user_id, time, average_hr, average_sc)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (post_id, interval_id, user_id) DO UPDATE SET time = $4, average_hr = $5, average_sc = $6
      `, [id, r.interval_id, userId, String(r.time).trim(), avgHr, avgSc]);
    }

    res.json({ message: 'Interval results saved', success: true });
  } catch (error) {
    console.error('Submit interval results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete current user's interval result
router.delete('/workouts/:id/interval-results/:intervalId', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id: postId, intervalId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM interval_results WHERE post_id = $1 AND interval_id = $2 AND user_id = $3 RETURNING id',
      [postId, intervalId, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Interval result not found or not authorized' });
    }
    res.json({ message: 'Interval result deleted', success: true });
  } catch (error) {
    console.error('Delete interval result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workouts that have intervals (for Results page add form dropdown)
router.get('/workouts-with-intervals', authenticateToken, requireMember, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT fp.id, fp.title, fp.workout_date, fp.workout_time, fp.workout_type
      FROM forum_posts fp
      INNER JOIN workout_intervals wi ON fp.id = wi.post_id
      WHERE fp.type = 'workout' AND fp.is_deleted = false
      ORDER BY fp.workout_date DESC NULLS LAST, fp.workout_time DESC NULLS LAST, fp.id DESC
    `);
    res.json({ workouts: result.rows || [] });
  } catch (error) {
    console.error('Get workouts with intervals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's interval results (for Results page)
router.get('/interval-results/me', authenticateToken, requireMember, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT 
        ir.id, ir.post_id, ir.interval_id, ir.user_id, ir.time, ir.average_hr, ir.average_sc, ir.created_at,
        fp.title as workout_title, fp.workout_date, fp.workout_time, fp.workout_type,
        wi.title as interval_title, wi.description as interval_description, wi.sort_order
      FROM interval_results ir
      JOIN forum_posts fp ON ir.post_id = fp.id
      JOIN workout_intervals wi ON ir.interval_id = wi.id
      WHERE ir.user_id = $1
      ORDER BY fp.workout_date DESC, fp.workout_time DESC NULLS LAST, wi.sort_order, wi.id
    `, [userId]);
    res.json({ intervalResults: result.rows || [] });
  } catch (error) {
    console.error('Get my interval results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join workout waitlist
router.post('/workouts/:id/waitlist', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if workout exists
    const workoutResult = await pool.query('SELECT id FROM forum_posts WHERE id = $1 AND type = \'workout\' AND is_deleted = false', [id]);
    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    // Check if user is already on waitlist
    const existingWaitlist = await pool.query('SELECT id FROM workout_waitlist WHERE user_id = $1 AND post_id = $2', [userId, id]);
    if (existingWaitlist.rows.length > 0) {
      return res.status(400).json({ error: 'Already on waitlist' });
    }

    // Check if user is already signed up
    const existingSignup = await pool.query('SELECT id FROM workout_signups WHERE user_id = $1 AND post_id = $2', [userId, id]);
    if (existingSignup.rows.length > 0) {
      return res.status(400).json({ error: 'Already signed up for this workout' });
    }

    // Add to waitlist
    await pool.query('INSERT INTO workout_waitlist (user_id, post_id) VALUES ($1, $2)', [userId, id]);
    
    res.json({ message: 'Joined waitlist successfully' });
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

    // Remove from waitlist
    const result = await pool.query('DELETE FROM workout_waitlist WHERE user_id = $1 AND post_id = $2', [userId, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Not on waitlist' });
    }
    
    res.json({ message: 'Left waitlist successfully' });
  } catch (error) {
    console.error('Leave waitlist error:', error);
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
        u.name as author_name, u.role as author_role, u.profile_picture_url as "authorProfilePictureUrl"
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

// Save event RSVP
router.post('/events/:id/rsvp', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Validate status
    if (!['going', 'maybe', 'not_going'].includes(status)) {
      return res.status(400).json({ error: 'Invalid RSVP status' });
    }

    // Check if event exists
    const eventResult = await pool.query('SELECT id FROM forum_posts WHERE id = $1 AND type = \'event\' AND is_deleted = false', [id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user already has an RSVP
    const existingRsvp = await pool.query('SELECT id, status FROM event_rsvps WHERE user_id = $1 AND post_id = $2', [userId, id]);
    
    if (existingRsvp.rows.length > 0) {
      if (existingRsvp.rows[0].status === status) {
        // User is clicking the same status, remove RSVP
        await pool.query('DELETE FROM event_rsvps WHERE user_id = $1 AND post_id = $2', [userId, id]);
        res.json({ message: 'RSVP removed successfully', status: null });
      } else {
        // Update existing RSVP
        await pool.query('UPDATE event_rsvps SET status = $1, rsvp_time = CURRENT_TIMESTAMP WHERE user_id = $2 AND post_id = $3', [status, userId, id]);
        res.json({ message: 'RSVP updated successfully', status });
      }
    } else {
      // Create new RSVP
      await pool.query('INSERT INTO event_rsvps (user_id, post_id, status, rsvp_time) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [userId, id, status]);
      res.json({ message: 'RSVP saved successfully', status });
    }
  } catch (error) {
    console.error('Save event RSVP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout attendance
router.get('/workouts/:id/attendance', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;

    const attendanceResult = await pool.query(`
      SELECT 
        wa.id, wa.user_id, wa.attended, wa.late, wa.recorded_at,
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

// Get all members for swim workout attendance (coach/exec/admin only)
router.get('/workouts/:id/attendance-members', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { id } = req.params;

    // First get the workout details to check if it's a swim workout
    const workoutResult = await pool.query(`
      SELECT workout_type FROM forum_posts WHERE id = $1
    `, [id]);

    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    const workoutType = workoutResult.rows[0].workout_type;
    
    // Only allow this for swim workouts
    if (workoutType !== 'swim') {
      return res.status(400).json({ error: 'This feature is only available for swim workouts' });
    }

    // Get all active members (member, exec, administrator roles)
    const membersResult = await pool.query(`
      SELECT 
        u.id as user_id, 
        u.name as user_name, 
        u.email as user_email,
        u.role as user_role,
        CASE WHEN ws.user_id IS NOT NULL THEN true ELSE false END as is_signed_up
      FROM users u
      LEFT JOIN workout_signups ws ON u.id = ws.user_id AND ws.post_id = $1
      WHERE u.is_active = true 
        AND u.role IN ('member', 'exec', 'administrator')
      ORDER BY u.name
    `, [id]);

    res.json({ members: membersResult.rows || [] });
  } catch (error) {
    console.error('Get swim workout members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit workout attendance (coach/exec/admin only)
router.post('/workouts/:id/attendance', authenticateToken, requireCoach, async (req, res) => {
  try {
    const { id } = req.params;
    const { attendanceData, lateData = {}, isSwimWorkout = false } = req.body;

    // Frontend sends an object mapping userId -> boolean
    if (!attendanceData || typeof attendanceData !== 'object' || Array.isArray(attendanceData)) {
      return res.status(400).json({ error: 'Attendance data must be an object keyed by userId' });
    }

    let userIdsToProcess = [];

    if (isSwimWorkout) {
      // For swim workouts, process all members (not just signups)
      const membersResult = await pool.query(`
        SELECT u.id as user_id
        FROM users u
        WHERE u.is_active = true 
          AND u.role IN ('member', 'exec', 'administrator')
      `);
      userIdsToProcess = membersResult.rows.map(row => row.user_id);
    } else {
      // For other workouts, only process signups
      const signupsResult = await pool.query(
        `SELECT user_id FROM workout_signups WHERE post_id = $1`,
        [id]
      );
      userIdsToProcess = signupsResult.rows.map(row => row.user_id);
    }

    for (const userId of userIdsToProcess) {
      const attended = Boolean(attendanceData[userId]);
      const late = Boolean(lateData[userId]);

      await pool.query(
        `INSERT INTO workout_attendance (post_id, user_id, attended, late, submitted_by, recorded_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (post_id, user_id)
         DO UPDATE SET attended = EXCLUDED.attended, late = EXCLUDED.late, submitted_by = EXCLUDED.submitted_by, recorded_at = CURRENT_TIMESTAMP`,
        [id, userId, attended, late, req.user.id]
      );
    }

    res.json({ message: 'Attendance submitted successfully' });
  } catch (error) {
    console.error('Submit attendance error:', error);
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

    const post = postResult.rows[0];

    // Send notifications for workout post (non-blocking)
    setImmediate(async () => {
      try {
        if (workoutType) {
          await notificationService.notifyWorkoutPosted(workoutType, {
            id: post.id,
            title: post.title,
            workoutDate: post.workout_date,
            workoutTime: post.workout_time,
            content: post.content
          });
        }
      } catch (error) {
        console.error('Error sending workout notifications:', error);
      }
    });

    res.status(201).json({
      message: 'Workout post created successfully',
      post: post
    });
  } catch (error) {
    console.error('Create workout post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create comment/reply on a forum post
router.post('/posts/:id/comments', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify the post exists
    const postResult = await pool.query(
      `SELECT id, title, type FROM forum_posts WHERE id = $1 AND is_deleted = false`,
      [id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postResult.rows[0];

    // Insert the comment
    const commentResult = await pool.query(
      `INSERT INTO forum_comments (post_id, user_id, content, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       RETURNING id, post_id, user_id, content, created_at`,
      [id, userId, content.trim()]
    );

    const comment = commentResult.rows[0];

    // Get comment with user info
    const fullCommentResult = await pool.query(`
      SELECT 
        fc.id, fc.post_id, fc.content, fc.created_at,
        u.id as user_id, u.name as user_name, u.profile_picture_url as "userProfilePictureUrl"
      FROM forum_comments fc
      JOIN users u ON fc.user_id = u.id
      WHERE fc.id = $1
    `, [comment.id]);

    const fullComment = fullCommentResult.rows[0];

    // Send notifications if this is a workout post (non-blocking)
    if (post.type === 'workout') {
      setImmediate(async () => {
        try {
          // Get the author name for the notification
          const authorResult = await pool.query(
            'SELECT name FROM users WHERE id = $1',
            [userId]
          );
          const authorName = authorResult.rows.length > 0 ? authorResult.rows[0].name : 'Someone';

          await notificationService.notifyWorkoutReplyToSignups(post.id, {
            postId: post.id,
            postTitle: post.title || 'Workout',
            replyAuthor: authorName,
            replyContent: content.trim()
          });
        } catch (error) {
          console.error('Error sending workout reply notifications:', error);
        }
      });
    }

    res.status(201).json({
      message: 'Comment created successfully',
      comment: fullComment
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comments for a forum post
router.get('/posts/:id/comments', authenticateToken, requireMember, async (req, res) => {
  try {
    const { id } = req.params;

    const commentsResult = await pool.query(`
      SELECT 
        fc.id, fc.post_id, fc.content, fc.created_at,
        u.id as user_id, u.name as user_name, u.profile_picture_url as "userProfilePictureUrl"
      FROM forum_comments fc
      JOIN users u ON fc.user_id = u.id
      WHERE fc.post_id = $1
      ORDER BY fc.created_at ASC
    `, [id]);

    res.json({ comments: commentsResult.rows || [] });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
