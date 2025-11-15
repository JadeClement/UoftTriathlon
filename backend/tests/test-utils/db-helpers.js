const { pool } = require('../../database-pg');

/**
 * Clean up test data from database
 */
async function cleanupTestData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete in order to respect foreign key constraints
    await client.query('DELETE FROM workout_cancellations');
    await client.query('DELETE FROM workout_attendance');
    await client.query('DELETE FROM workout_signups');
    await client.query('DELETE FROM workout_waitlist');
    await client.query('DELETE FROM forum_posts');
    await client.query("DELETE FROM users WHERE email LIKE '%test%' OR email LIKE 'test%@example.com'");
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create a test user and return user data with token
 */
async function createTestUser(client, userData = {}) {
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  
  const {
    email = `test-${Date.now()}@example.com`,
    password = 'testpassword123',
    name = 'Test User',
    role = 'member'
  } = userData;
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  const result = await client.query(
    `INSERT INTO users (email, password_hash, name, role, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id, email, name, role`,
    [email, passwordHash, name, role]
  );
  
  const user = result.rows[0];
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  return { ...user, token, password };
}

/**
 * Create a test workout
 */
async function createTestWorkout(client, workoutData = {}) {
  const {
    user_id,
    title = 'Test Workout',
    workout_date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
    workout_time = '10:00:00',
    capacity = 10,
    workout_type = 'Swim'
  } = workoutData;
  
  if (!user_id) {
    throw new Error('user_id is required to create a workout');
  }
  
  const content = workoutData.content || 'Test workout content';
  
  const result = await client.query(
    `INSERT INTO forum_posts (user_id, type, title, content, workout_date, workout_time, capacity, workout_type)
     VALUES ($1, 'workout', $2, $3, $4, $5, $6, $7)
     RETURNING id, title, workout_date, workout_time, capacity`,
    [user_id, title, content, workout_date, workout_time, capacity, workout_type]
  );
  
  return result.rows[0];
}

/**
 * Get current signup count for a workout
 */
async function getSignupCount(client, workoutId) {
  const result = await client.query(
    'SELECT COUNT(*) as count FROM workout_signups WHERE post_id = $1',
    [workoutId]
  );
  return parseInt(result.rows[0].count);
}

/**
 * Get waitlist count for a workout
 */
async function getWaitlistCount(client, workoutId) {
  const result = await client.query(
    'SELECT COUNT(*) as count FROM workout_waitlist WHERE post_id = $1',
    [workoutId]
  );
  return parseInt(result.rows[0].count);
}

module.exports = {
  cleanupTestData,
  createTestUser,
  createTestWorkout,
  getSignupCount,
  getWaitlistCount
};

