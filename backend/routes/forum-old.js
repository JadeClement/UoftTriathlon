const express = require('express');
const { db } = require('../database');
const { authenticateToken, requireMember } = require('../middleware/auth');
const emailService = require('../services/emailService');
const { sendWaitlistPromotionNotification } = require('../services/smsService');

const router = express.Router();

// CORS is handled by main server middleware
// Get all forum posts
router.get('/', authenticateToken, requireMember, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    db.all(`
      SELECT 
        fp.id, fp.content, fp.created_at, fp.updated_at, fp.likes,
        u.id as user_id, u.name as author_name, u.role as author_role
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.is_deleted = 0
      ORDER BY fp.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset], (err, posts) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Get total count for pagination
      db.get('SELECT COUNT(*) as total FROM forum_posts WHERE is_deleted = 0', (err, countResult) => {
        if (err) {
          console.error('Error getting post count:', err);
        }

        res.json({
          posts,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult?.total || 0,
            pages: Math.ceil((countResult?.total || 0) / limit)
          }
        });
      });
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout posts
router.get('/workouts', authenticateToken, requireMember, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    db.all(`
      SELECT 
        fp.id, fp.content, fp.title, fp.workout_type, fp.workout_date, fp.workout_time, fp.created_at, fp.updated_at, fp.likes, fp.capacity,
        u.id as user_id, u.name as author_name, u.role as author_role, u.profile_picture_url as author_profile_picture_url
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.is_deleted = 0 AND fp.type = 'workout'
      ORDER BY fp.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset], (err, posts) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ posts: posts || [] });
    });
  } catch (error) {
    console.error('Get workout posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get event posts
router.get('/events', authenticateToken, requireMember, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    db.all(`
      SELECT 
        fp.id, fp.content, fp.title, fp.event_date, fp.created_at, fp.updated_at, fp.likes,
        u.id as user_id, u.name as author_name, u.role as author_role, u.profile_picture_url as author_profile_picture_url
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.is_deleted = 0 AND fp.type = 'event'
      ORDER BY fp.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset], (err, posts) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ posts: posts || [] });
    });
  } catch (error) {
    console.error('Get event posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single workout post by ID
router.get('/workouts/:id', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    db.get(`
      SELECT 
        fp.id, fp.content, fp.title, fp.workout_type, fp.workout_date, fp.workout_time, fp.created_at, fp.updated_at, fp.likes,
        u.id as user_id, u.name as author_name, u.role as author_role, u.profile_picture_url as author_profile_picture_url
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = ? AND fp.type = 'workout' AND fp.is_deleted = 0
    `, [id], (err, post) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!post) {
        return res.status(404).json({ error: 'Workout not found' });
      }

      res.json({ workout: post });
    });
  } catch (error) {
    console.error('Get workout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single event post by ID
router.get('/events/:id', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    db.get(`
      SELECT 
        fp.id, fp.content, fp.title, fp.event_date, fp.created_at, fp.updated_at, fp.likes,
        u.id as user_id, u.name as author_name, u.role as author_role, u.profile_picture_url as author_profile_picture_url
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = ? AND fp.type = 'event' AND fp.is_deleted = 0
    `, [id], (err, post) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!post) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({ event: post });
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clean up all existing workout posts (admin only)
router.delete('/workouts/cleanup', authenticateToken, requireMember, (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ error: 'Only administrators can perform cleanup' });
    }

    db.run('DELETE FROM forum_posts WHERE type = "workout"', function(err) {
      if (err) {
        console.error('Error cleaning up workout posts:', err);
        return res.status(500).json({ error: 'Error cleaning up workout posts' });
      }

      res.json({ 
        message: `Successfully deleted ${this.changes} workout posts`,
        deletedCount: this.changes
      });
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign up for a workout
router.post('/workouts/:id/signup', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('🔄 Signup attempt - Workout ID:', id, 'User ID:', userId);

    // Check if workout exists
    db.get('SELECT id FROM forum_posts WHERE id = ? AND type = "workout" AND is_deleted = 0', [id], (err, workout) => {
      if (err) {
        console.error('❌ Database error checking workout:', err);
        return res.status(500).json({ error: 'Database error checking workout' });
      }

      if (!workout) {
        console.log('❌ Workout not found:', id);
        return res.status(404).json({ error: 'Workout not found' });
      }

      console.log('✅ Workout found:', workout);

      // Check if user is already signed up
      db.get('SELECT id FROM workout_signups WHERE user_id = ? AND workout_id = ?', [userId, id], (err, existingSignup) => {
        if (err) {
          console.error('❌ Database error checking existing signup:', err);
          return res.status(500).json({ error: 'Database error checking existing signup' });
        }

        console.log('🔍 Existing signup check:', existingSignup ? 'Found' : 'Not found');

        if (existingSignup) {
          // Remove signup
          console.log('🗑️ Removing existing signup...');
          db.run('DELETE FROM workout_signups WHERE user_id = ? AND workout_id = ?', [userId, id], function(err) {
            if (err) {
              console.error('❌ Error removing signup:', err);
              return res.status(500).json({ error: 'Error removing signup' });
            }

            console.log('✅ Signup removed successfully');
            
            // Check if there are people on the waitlist to promote
            db.get('SELECT ww.id, ww.user_id, u.name as user_name, u.email, u.phone_number FROM workout_waitlist ww JOIN users u ON ww.user_id = u.id WHERE ww.workout_id = ? ORDER BY ww.joined_at ASC LIMIT 1', [id], (err, waitlistPerson) => {
              if (err) {
                console.error('❌ Error checking waitlist:', err);
                // Still return success for the cancellation
                return res.json({ 
                  message: 'Signup removed successfully',
                  signedUp: false
                });
              }

              if (waitlistPerson) {
                // Promote first person from waitlist
                console.log('🎉 Promoting person from waitlist, ID:', waitlistPerson.id, 'Name:', waitlistPerson.user_name);
                
                // Remove from waitlist and add to signups
                db.run('DELETE FROM workout_waitlist WHERE id = ?', [waitlistPerson.id], function(err) {
                  if (err) {
                    console.error('❌ Error removing from waitlist:', err);
                  } else {
                    console.log('✅ Removed from waitlist');
                  }
                  
                  // Add to signups
                  db.run('INSERT INTO workout_signups (user_id, workout_id, signed_up_at) VALUES (?, ?, DATETIME("now"))', [waitlistPerson.user_id, id], function(err) {
                    if (err) {
                      console.error('❌ Error promoting to signups:', err);
                    } else {
                      console.log('✅ Successfully promoted to signups');
                      
                      // Get workout details for notifications
                      db.get('SELECT title, workout_date FROM forum_posts WHERE id = ?', [id], (err, workout) => {
                        if (err) {
                          console.error('❌ Error getting workout details for notifications:', err);
                        } else {
                          // Send combined email + SMS notification
                          sendWaitlistPromotionNotification(
                            waitlistPerson.email,
                            waitlistPerson.phone_number,
                            waitlistPerson.user_name,
                            workout.title || 'Workout',
                            workout.workout_date
                          ).then(notificationResult => {
                            if (notificationResult.email) {
                              console.log('📧 Email sent successfully to:', waitlistPerson.email);
                            } else {
                              console.log('❌ Failed to send email to:', waitlistPerson.email);
                            }
                            
                            if (notificationResult.sms && waitlistPerson.phone_number) {
                              console.log('📱 SMS sent successfully to:', waitlistPerson.phone_number);
                            } else if (waitlistPerson.phone_number) {
                              console.log('❌ Failed to send SMS to:', waitlistPerson.phone_number);
                            } else {
                              console.log('📱 No phone number available for SMS');
                            }
                          });
                        }
                      });
                    }
                  });
                });
              }
              
              res.json({ 
                message: 'Signup removed successfully',
                signedUp: false
              });
            });
          });
        } else {
          // Add signup
          console.log('➕ Adding new signup...');
          db.run('INSERT INTO workout_signups (user_id, workout_id, signed_up_at) VALUES (?, ?, DATETIME("now"))', [userId, id], function(err) {
            if (err) {
              console.error('❌ Error adding signup:', err);
              return res.status(500).json({ error: 'Error adding signup' });
            }

            console.log('✅ Signup added successfully, ID:', this.lastID);
            res.json({ 
              message: 'Signed up successfully',
              signedUp: true
            });
          });
        }
      });
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout signups
router.get('/workouts/:id/signups', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    db.all(`
      SELECT 
        ws.id, ws.user_id, ws.signed_up_at,
        u.name as user_name, u.role as user_role
      FROM workout_signups ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.workout_id = ?
      ORDER BY ws.signed_up_at ASC
    `, [id], (err, signups) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ signups: signups || [] });
    });
  } catch (error) {
    console.error('Get signups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join workout waitlist
router.post('/workouts/:id/waitlist', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log('🔍 Waitlist join attempt - Workout ID:', id, 'User ID:', userId, 'User object:', req.user);

    // Check if workout exists and has capacity
    db.get('SELECT id, capacity FROM forum_posts WHERE id = ? AND type = "workout" AND is_deleted = 0', [id], (err, workout) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!workout) {
        return res.status(404).json({ error: 'Workout not found' });
      }

      // Check if user is already on waitlist
      db.get('SELECT id FROM workout_waitlist WHERE user_id = ? AND workout_id = ?', [userId, id], (err, existingWaitlist) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (existingWaitlist) {
          return res.status(400).json({ error: 'Already on waitlist' });
        }

        // Check if user is already signed up
        db.get('SELECT id FROM workout_signups WHERE user_id = ? AND workout_id = ?', [userId, id], (err, existingSignup) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          if (existingSignup) {
            return res.status(400).json({ error: 'Already signed up for this workout' });
          }

          // Add to waitlist
          console.log('➕ Adding to waitlist - User ID:', userId, 'Workout ID:', id);
          db.run('INSERT INTO workout_waitlist (user_id, workout_id) VALUES (?, ?)', [userId, id], function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Database error' });
            }

            console.log('✅ Waitlist entry added successfully, ID:', this.lastID);
            res.json({ message: 'Added to waitlist successfully' });
          });
        });
      });
    });
  } catch (error) {
    console.error('Join waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave workout waitlist
router.delete('/workouts/:id/waitlist', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    db.run('DELETE FROM workout_waitlist WHERE user_id = ? AND workout_id = ?', [userId, id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Not on waitlist' });
      }

      res.json({ message: 'Removed from waitlist successfully' });
    });
  } catch (error) {
    console.error('Leave waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout waitlist
router.get('/workouts/:id/waitlist', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    db.all(`
      SELECT 
        ww.id, ww.joined_at,
        u.name as user_name, u.role as user_role
      FROM workout_waitlist ww
      JOIN users u ON ww.user_id = u.id
      WHERE ww.workout_id = ?
      ORDER BY ww.joined_at ASC
    `, [id], (err, waitlist) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ waitlist: waitlist || [] });
    });
  } catch (error) {
    console.error('Get waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single forum post
router.get('/:id', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    db.get(`
      SELECT 
        fp.id, fp.content, fp.created_at, fp.updated_at, fp.likes,
        u.id as user_id, u.name as author_name, u.role as author_role
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = ? AND fp.is_deleted = 0
    `, [id], (err, post) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      res.json({ post });
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new forum post
router.post('/', authenticateToken, requireMember, (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    if (content.length > 1000) {
      return res.status(400).json({ error: 'Post content is too long (max 1000 characters)' });
    }

    db.run(`
      INSERT INTO forum_posts (user_id, content)
      VALUES (?, ?)
    `, [req.user.id, content.trim()], function(err) {
      if (err) {
        console.error('Error creating post:', err);
        return res.status(500).json({ error: 'Error creating post' });
      }

      // Get the created post
      db.get(`
        SELECT 
          fp.id, fp.content, fp.created_at, fp.updated_at, fp.likes,
          u.id as user_id, u.name as author_name, u.role as author_role
        FROM forum_posts fp
        JOIN users u ON fp.user_id = u.id
        WHERE fp.id = ?
      `, [this.lastID], (err, post) => {
        if (err) {
          console.error('Error getting created post:', err);
        }

        res.status(201).json({
          message: 'Post created successfully',
          post
        });
      });
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new workout post (exec and administrator only)
router.post('/workouts', authenticateToken, requireMember, (req, res) => {
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

    db.run(`
      INSERT INTO forum_posts (user_id, title, workout_type, workout_date, workout_time, content, type, capacity)
      VALUES (?, ?, ?, ?, ?, ?, 'workout', ?)
    `, [req.user.id, title, workoutType, workoutDate, workoutTime, content.trim(), capacity || null], function(err) {
      if (err) {
        console.error('Error creating workout post:', err);
        return res.status(500).json({ error: 'Error creating workout post' });
      }

      // Get the created post
      db.get(`
        SELECT 
          fp.id, fp.content, fp.title, fp.workout_type, fp.workout_date, fp.workout_time, fp.created_at, fp.updated_at, fp.likes, fp.capacity,
          u.id as user_id, u.name as author_name, u.role as author_role
        FROM forum_posts fp
        JOIN users u ON fp.user_id = u.id
        WHERE fp.id = ?
      `, [this.lastID], (err, post) => {
        if (err) {
          console.error('Error getting created workout post:', err);
        }

        res.status(201).json({
          message: 'Workout post created successfully',
          post
        });
      });
    });
  } catch (error) {
    console.error('Create workout post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new event post (exec and administrator only)
router.post('/events', authenticateToken, requireMember, (req, res) => {
  try {
    // Check if user is exec or higher
    if (!['exec', 'administrator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only executives can create event posts' });
    }

    const { title, eventDate, content } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Event title is required' });
    }

    if (!eventDate) {
      return res.status(400).json({ error: 'Event date is required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    if (content.length > 1000) {
      return res.status(400).json({ error: 'Post content is too long (max 1000 characters)' });
    }

    db.run(`
      INSERT INTO forum_posts (user_id, title, event_date, content, type)
      VALUES (?, ?, ?, ?, 'event')
    `, [req.user.id, title.trim(), eventDate, content.trim()], function(err) {
      if (err) {
        console.error('Error creating event post:', err);
        return res.status(500).json({ error: 'Error creating event post' });
      }

      // Get the created post
      db.get(`
        SELECT 
          fp.id, fp.content, fp.title, fp.event_date, fp.created_at, fp.updated_at, fp.likes,
          u.id as user_id, u.name as author_name, u.role as author_role
        FROM forum_posts fp
        JOIN users u ON fp.user_id = u.id
        WHERE fp.id = ?
      `, [this.lastID], (err, post) => {
        if (err) {
          console.error('Error getting created event post:', err);
        }

        res.status(201).json({
          message: 'Event post created successfully',
          post
        });
      });
    });
  } catch (error) {
    console.error('Create event post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update forum post
router.put('/:id', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    if (content.length > 1000) {
      return res.status(400).json({ error: 'Post content is too long (max 1000 characters)' });
    }

    // Check if user owns the post or is admin
    db.get('SELECT user_id FROM forum_posts WHERE id = ? AND is_deleted = 0', [id], (err, post) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if (post.user_id != req.user.id && req.user.role !== 'administrator') {
        return res.status(403).json({ error: 'Can only edit your own posts' });
      }

      // Update post
      db.run(`
        UPDATE forum_posts 
        SET content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [content.trim(), id], function(err) {
        if (err) {
          console.error('Error updating post:', err);
          return res.status(500).json({ error: 'Error updating post' });
        }

        res.json({ message: 'Post updated successfully' });
      });
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update workout post
router.put('/workouts/:id', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;
    const { title, workout_date, workout_time, content } = req.body;

    // Check if user owns the post or is exec/admin
    db.get('SELECT user_id, type FROM forum_posts WHERE id = ? AND is_deleted = 0', [id], (err, post) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if (post.type !== 'workout') {
        return res.status(400).json({ error: 'Not a workout post' });
      }

      // Allow workout author, exec members, or administrators to edit
      if (post.user_id != req.user.id && req.user.role !== 'exec' && req.user.role !== 'administrator') {
        return res.status(403).json({ error: 'Insufficient permissions to edit this workout' });
      }

      // Update the workout post
      db.run(`
        UPDATE forum_posts 
        SET title = ?, workout_date = ?, workout_time = ?, content = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [title, workout_date, workout_time, content, id], function(err) {
        if (err) {
          console.error('Error updating workout post:', err);
          return res.status(500).json({ error: 'Error updating workout post' });
        }

        // Get the updated workout data
        db.get(`
          SELECT 
            fp.id, fp.content, fp.title, fp.workout_type, fp.workout_date, fp.workout_time, 
            fp.created_at, fp.updated_at, fp.likes, fp.capacity,
            u.id as user_id, u.name as author_name, u.role as author_role, 
            u.profile_picture_url as author_profile_picture_url
          FROM forum_posts fp
          JOIN users u ON fp.user_id = u.id
          WHERE fp.id = ?
        `, [id], (err, updatedWorkout) => {
          if (err) {
            console.error('Error fetching updated workout:', err);
            return res.status(500).json({ error: 'Error fetching updated workout' });
          }

          res.json({ workout: updatedWorkout });
        });
      });
    });
  } catch (error) {
    console.error('Update workout post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete workout post
router.delete('/workouts/:id', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    // Check if user owns the post or is admin
    db.get('SELECT user_id, type FROM forum_posts WHERE id = ? AND is_deleted = 0', [id], (err, post) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if (post.type !== 'workout') {
        return res.status(400).json({ error: 'Not a workout post' });
      }

      if (post.user_id != req.user.id && req.user.role !== 'administrator') {
        return res.status(403).json({ error: 'Can only delete your own posts' });
      }

      // Soft delete post
      db.run('UPDATE forum_posts SET is_deleted = 1 WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting workout post:', err);
          return res.status(500).json({ error: 'Error deleting workout post' });
        }

        res.json({ message: 'Workout post deleted successfully' });
      });
    });
  } catch (error) {
    console.error('Delete workout post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete event post
router.delete('/events/:id', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    // Check if user owns the post or is admin
    db.get('SELECT user_id, type FROM forum_posts WHERE id = ? AND is_deleted = 0', [id], (err, post) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if (post.type !== 'event') {
        return res.status(400).json({ error: 'Not an event post' });
      }

      if (post.user_id != req.user.id && req.user.role !== 'administrator') {
        return res.status(403).json({ error: 'Can only delete your own posts' });
      }

      // Soft delete post
      db.run('UPDATE forum_posts SET is_deleted = 1 WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting event post:', err);
          return res.status(500).json({ error: 'Error deleting event post' });
        }

        res.json({ message: 'Event post deleted successfully' });
      });
    });
  } catch (error) {
    console.error('Delete event post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete forum post (soft delete)
router.delete('/:id', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    // Check if user owns the post or is admin
    db.get('SELECT user_id FROM forum_posts WHERE id = ? AND is_deleted = 0', [id], (err, post) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if (post.user_id != req.user.id && req.user.role !== 'administrator') {
        return res.status(403).json({ error: 'Can only delete your own posts' });
      }

      // Soft delete post
      db.run('UPDATE forum_posts SET is_deleted = 1 WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting post:', err);
          return res.status(500).json({ error: 'Error deleting post' });
        }

        res.json({ message: 'Post deleted successfully' });
      });
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Like/unlike a post
router.post('/:id/like', authenticateToken, requireMember, (req, res) => {
  try {
    const { id } = req.params;

    // Check if post exists
    db.get('SELECT id FROM forum_posts WHERE id = ? AND is_deleted = 0', [id], (err, post) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Toggle like (simple implementation - in production you'd want a likes table)
      db.run('UPDATE forum_posts SET likes = likes + 1 WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error liking post:', err);
          return res.status(500).json({ error: 'Error liking post' });
        }

        res.json({ message: 'Post liked successfully' });
      });
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get posts by user
router.get('/user/:userId', authenticateToken, requireMember, (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    db.all(`
      SELECT 
        fp.id, fp.content, fp.created_at, fp.updated_at, fp.likes,
        u.id as user_id, u.name as author_name, u.role as author_role
      FROM forum_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.user_id = ? AND fp.is_deleted = 0
      ORDER BY fp.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset], (err, posts) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ posts });
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout attendance
router.get('/workouts/:id/attendance', authenticateToken, async (req, res) => {
  try {
    const workoutId = req.params.id;
    
    const attendance = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          user_id,
          is_present
        FROM workout_attendance
        WHERE workout_id = ?
      `, [workoutId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Convert to object for easy lookup
    const attendanceMap = {};
    attendance.forEach(record => {
      attendanceMap[record.user_id] = record.is_present;
    });
    
    res.json(attendanceMap);
  } catch (error) {
    console.error('Error fetching workout attendance:', error);
    res.status(500).json({ error: 'Failed to fetch workout attendance' });
  }
});

// Submit workout attendance
router.post('/workouts/:id/attendance', authenticateToken, requireMember, async (req, res) => {
  try {
    const workoutId = req.params.id;
    const { attendanceData } = req.body;
    const recordedBy = req.user.id;
    
    // Check if user is exec or admin
    if (req.user.role !== 'exec' && req.user.role !== 'administrator') {
      return res.status(403).json({ error: 'Only executives can record attendance' });
    }
    
    console.log('📝 Submitting attendance for workout:', workoutId);
    console.log('👥 Attendance data:', attendanceData);
    console.log('👤 Recorded by:', recordedBy);
    
    // Check if attendance has already been submitted for this workout
    db.get('SELECT COUNT(*) as count FROM workout_attendance WHERE workout_id = ?', [workoutId], (err, row) => {
      if (err) {
        console.error('Error checking existing attendance:', err);
        return res.status(500).json({ error: 'Failed to check existing attendance' });
      }
      
      if (row.count > 0) {
        console.log('❌ Attendance already submitted for this workout');
        return res.status(400).json({ error: 'Attendance has already been submitted for this workout and cannot be modified' });
      }
      
      console.log('✅ No existing attendance found, proceeding with submission');
      
      // Get all signups for this workout to calculate absences
      db.all('SELECT user_id FROM workout_signups WHERE workout_id = ?', [workoutId], (err, signups) => {
        if (err) {
          console.error('Error getting workout signups:', err);
          console.error('SQL Query: SELECT user_id FROM workout_signups WHERE workout_id = ?', [workoutId]);
          return res.status(500).json({ error: 'Failed to get workout signups' });
        }
        
        console.log('📋 Found signups:', signups);
        console.log('📋 Signup user IDs:', signups.map(s => s.user_id));
        
        // Insert new attendance records
        let completedCount = 0;
        const totalRecords = Object.keys(attendanceData).length;
        
        if (totalRecords === 0) {
          return res.json({ message: 'Attendance saved successfully' });
        }
        
        Object.entries(attendanceData).forEach(([userId, isPresent]) => {
          console.log(`📊 Inserting: User ${userId} - Present: ${isPresent}`);
          
          db.run(`
            INSERT INTO workout_attendance (workout_id, user_id, is_present, recorded_by)
            VALUES (?, ?, ?, ?)
          `, [workoutId, userId, isPresent, recordedBy], function(err) {
            if (err) {
              console.error('Error inserting attendance record:', err);
            } else {
              console.log(`✅ Attendance recorded for user ${userId}`);
            }
            
            completedCount++;
            if (completedCount === totalRecords) {
              console.log('🎉 All attendance records processed');
              
              // Now calculate and update absences for all signups
              let absenceCount = 0;
              const totalSignups = signups.length;
              
              signups.forEach(signup => {
                const userId = signup.user_id;
                const wasPresent = attendanceData[userId] || false;
                
                if (!wasPresent) {
                  // User was signed up but marked as absent
                  db.run('UPDATE users SET absences = absences + 1 WHERE id = ?', [userId], (err) => {
                    if (err) {
                      console.error('Error updating absences for user', userId, ':', err);
                    } else {
                      console.log(`📈 Absences incremented for user ${userId}`);
                    }
                    
                    absenceCount++;
                    if (absenceCount === totalSignups) {
                      console.log('🎯 All absences updated');
                      res.json({ message: 'Attendance saved successfully' });
                    }
                  });
                } else {
                  absenceCount++;
                  if (absenceCount === totalSignups) {
                    console.log('🎯 All absences updated');
                    res.json({ message: 'Attendance saved successfully' });
                  }
                }
              });
            }
          });
        });
      });
    });
    
  } catch (error) {
    console.error('Error submitting attendance:', error);
    res.status(500).json({ error: 'Failed to submit attendance' });
  }
});

module.exports = router;
