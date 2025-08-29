const { Pool } = require('pg');
const path = require('path');

// PostgreSQL connection configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'uofttriathlon',
  password: '', // No password for local development
  port: 5432,
});

// Test the connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Initialize database tables
async function initializeDatabase() {
  try {
    console.log('🔧 Initializing PostgreSQL database tables...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'pending',
        join_date DATE,
        expiry_date DATE,
        bio TEXT,
        profile_picture_url VARCHAR(500),
        phone_number VARCHAR(50),
        absences INTEGER DEFAULT 0,
        charter_accepted BOOLEAN DEFAULT FALSE,
        charter_accepted_at TIMESTAMP,
        reset_token VARCHAR(255),
        reset_token_expiry TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Create forum_posts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forum_posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'post',
        title VARCHAR(255),
        workout_type VARCHAR(100),
        workout_date DATE,
        workout_time TIME,
        capacity INTEGER,
        event_date DATE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Forum posts table created');

    // Create workout_signups table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workout_signups (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
        signup_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      )
    `);
    console.log('✅ Workout signups table created');

    // Create workout_attendance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workout_attendance (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        attended BOOLEAN DEFAULT FALSE,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )
    `);
    console.log('✅ Workout attendance table created');

    // Create workout_waitlist table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workout_waitlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        workout_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, workout_id)
      )
    `);
    console.log('✅ Workout waitlist table created');

    // Create races table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS races (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        location VARCHAR(255),
        description TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Races table created');

    // Create race_signups table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS race_signups (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        race_id INTEGER REFERENCES races(id) ON DELETE CASCADE,
        signup_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, race_id)
      )
    `);
    console.log('✅ Race signups table created');

    // Create login_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ip_address VARCHAR(45),
        user_agent TEXT,
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Login history table created');

    // Create role_change_notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_change_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        old_role VARCHAR(50) NOT NULL,
        new_role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE
      )
    `);
    console.log('✅ Role change notifications table created');

    // Create post_likes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )
    `);
    console.log('✅ Post likes table created');

    // Create event_rsvps table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_rsvps (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'going' CHECK (status IN ('going', 'not_going', 'maybe')),
        rsvp_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )
    `);
    console.log('✅ Event RSVPs table created');

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_forum_posts_user_id ON forum_posts(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_forum_posts_type ON forum_posts(type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_workout_signups_user_id ON workout_signups(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_workout_signups_post_id ON workout_signups(post_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_workout_waitlist_user_id ON workout_waitlist(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_workout_waitlist_workout_id ON workout_waitlist(workout_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_role_change_notifications_user_id ON role_change_notifications(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_event_rsvps_post_id ON event_rsvps(post_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id)');
    
    console.log('✅ Database indexes created');

    console.log('✅ PostgreSQL database initialization completed');
  } catch (error) {
    console.error('❌ Error initializing PostgreSQL database:', error);
    throw error;
  }
}

// Seed initial data
async function seedDatabase() {
  try {
    console.log('🌱 Seeding initial data...');
    
    // Check if admin user already exists
    const adminExists = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@uofttri.com']);
    
    if (adminExists.rows.length === 0) {
      // Create admin user (you'll need to set a proper password hash)
      await pool.query(`
        INSERT INTO users (name, email, password_hash, role, charter_accepted)
        VALUES ($1, $2, $3, $4, $5)
      `, ['Admin User', 'admin@uofttri.com', 'temp_password_hash', 'administrator', true]);
      console.log('✅ Admin user created');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Check if Jade's account exists
    const jadeExists = await pool.query('SELECT id FROM users WHERE email = $1', ['jade@uofttri.com']);
    
    if (jadeExists.rows.length === 0) {
      // Create Jade's account
      await pool.query(`
        INSERT INTO users (name, email, password_hash, role, charter_accepted)
        VALUES ($1, $2, $3, $4, $5)
      `, ['Jade Clement', 'jade@uofttri.com', 'temp_password_hash', 'administrator', true]);
      console.log('✅ Jade\'s account created');
    } else {
      console.log('✅ Jade\'s account already exists');
    }

    console.log('✅ Database seeding completed');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Check database health
async function checkDatabaseHealth() {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    return result.rows[0].current_time;
  } catch (error) {
    throw new Error(`Database health check failed: ${error.message}`);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, closing PostgreSQL connections...');
  await pool.end();
  console.log('✅ PostgreSQL connections closed successfully');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, closing PostgreSQL connections...');
  await pool.end();
  console.log('✅ PostgreSQL connections closed successfully');
  process.exit(0);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initializeDatabase,
  seedDatabase,
  checkDatabaseHealth
};
