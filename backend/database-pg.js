const { Pool } = require('pg');
const path = require('path');

// PostgreSQL connection configuration
const pool = new Pool(
  process.env.DATABASE_URL 
    ? {
        // Production (Railway) - use DATABASE_URL
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        // Local development - use local database
        user: 'postgres',
        host: 'localhost',
        database: 'uofttriathlon',
        password: '', // No password for local development
        port: 5432,
      }
);

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
    
    // Create terms table first (users table references it)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS terms (
        id SERIAL PRIMARY KEY,
        term VARCHAR(50) NOT NULL UNIQUE CHECK(term IN ('fall', 'winter', 'fall/winter', 'spring', 'summer', 'spring/summer')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL
      )
    `);
    console.log('✅ Terms table created');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'pending' CHECK(role IN ('pending', 'member', 'coach', 'exec', 'administrator')),
        join_date DATE,
        expiry_date DATE,
        bio TEXT,
        profile_picture_url VARCHAR(500),
        phone_number VARCHAR(50),
        absences INTEGER DEFAULT 0,
        sport VARCHAR(50) DEFAULT 'triathlon' CHECK(sport IN ('triathlon', 'duathlon', 'run_only')),
        term_id INTEGER REFERENCES terms(id),
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

    // Add late column to workout_attendance table if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE workout_attendance 
        ADD COLUMN late BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Late column added to workout_attendance table');
    } catch (error) {
      if (error.code === '42701') {
        console.log('✅ Late column already exists in workout_attendance table');
      } else {
        console.error('❌ Error adding late column:', error.message);
      }
    }

    // Create workout_waitlist table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workout_waitlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      )
    `);
    console.log('✅ Workout waitlist table created');

    // Create workout_cancellations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workout_cancellations (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        within_12hrs BOOLEAN DEFAULT TRUE,
        marked_absent BOOLEAN DEFAULT FALSE,
        UNIQUE(post_id, user_id)
      )
    `);
    console.log('✅ Workout cancellations table created');

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

    // Create merch_orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS merch_orders (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        item VARCHAR(255) NOT NULL,
        size VARCHAR(50),
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Merch orders table created');

    // Create site_settings table (key-value store)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT
      )
    `);
    console.log('✅ Site settings table created');

    // Track which users have seen specific popups
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_popup_views (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        popup_id VARCHAR(100) NOT NULL,
        seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, popup_id)
      )
    `);
    console.log('✅ user_popup_views table created');

    // Create merch_orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS merch_orders (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) DEFAULT '' ,
        email VARCHAR(255) NOT NULL,
        item VARCHAR(255) NOT NULL,
        size VARCHAR(50) DEFAULT '',
        quantity INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Merch orders table created');

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_forum_posts_user_id ON forum_posts(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_forum_posts_type ON forum_posts(type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_workout_signups_user_id ON workout_signups(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_workout_signups_post_id ON workout_signups(post_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_workout_waitlist_user_id ON workout_waitlist(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_workout_waitlist_post_id ON workout_waitlist(post_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_role_change_notifications_user_id ON role_change_notifications(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_event_rsvps_post_id ON event_rsvps(post_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_merch_orders_created_at ON merch_orders(created_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_merch_orders_email ON merch_orders(email)');
    
    // Add archived column to merch_orders if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE merch_orders 
        ADD COLUMN archived BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Archived column added to merch_orders table');
    } catch (error) {
      if (error.code === '42701') {
        console.log('✅ Archived column already exists in merch_orders table');
      } else {
        console.error('❌ Error adding archived column:', error.message);
      }
    }
    
    // Create index on archived column for better query performance
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_merch_orders_archived ON merch_orders(archived)');
      console.log('✅ Index on archived column created');
    } catch (error) {
      console.error('❌ Error creating archived index:', error.message);
    }
    
    console.log('✅ Database indexes created');

    // Add sport column to users table if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN sport VARCHAR(50) DEFAULT 'triathlon' CHECK(sport IN ('triathlon', 'duathlon', 'run_only'))
      `);
      console.log('✅ sport column added to users table');
    } catch (error) {
      if (error.code === '42701') {
        console.log('✅ sport column already exists in users table');
      } else {
        console.error('❌ Error adding sport column:', error.message);
      }
    }

    // Create terms table if it doesn't exist (for existing databases)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS terms (
          id SERIAL PRIMARY KEY,
          term VARCHAR(50) NOT NULL UNIQUE CHECK(term IN ('fall', 'winter', 'fall/winter', 'spring', 'summer', 'spring/summer')),
          start_date DATE NOT NULL,
          end_date DATE NOT NULL
        )
      `);
      console.log('✅ Terms table created/verified');
    } catch (error) {
      console.error('❌ Error creating terms table:', error.message);
    }

    // Remove old term columns from users table if they exist (migration)
    try {
      await pool.query(`
        ALTER TABLE users
        DROP COLUMN IF EXISTS term
      `);
      console.log('✅ Removed term column from users table');
    } catch (error) {
      console.log('ℹ️  term column does not exist or already removed');
    }

    try {
      await pool.query(`
        ALTER TABLE users
        DROP COLUMN IF EXISTS term_start_date
      `);
      console.log('✅ Removed term_start_date column from users table');
    } catch (error) {
      console.log('ℹ️  term_start_date column does not exist or already removed');
    }

    try {
      await pool.query(`
        ALTER TABLE users
        DROP COLUMN IF EXISTS term_end_date
      `);
      console.log('✅ Removed term_end_date column from users table');
    } catch (error) {
      console.log('ℹ️  term_end_date column does not exist or already removed');
    }

    // Add term_id foreign key to users table if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN term_id INTEGER
      `);
      console.log('✅ term_id column added to users table');
    } catch (error) {
      if (error.code === '42701') {
        console.log('✅ term_id column already exists in users table');
      } else {
        console.error('❌ Error adding term_id column:', error.message);
      }
    }

    try {
      await pool.query(`
        ALTER TABLE users
        ADD CONSTRAINT users_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id)
      `);
      console.log('✅ term_id foreign key constraint added to users table');
    } catch (error) {
      if (error.code === '42710' || error.code === '42P16') {
        console.log('✅ term_id foreign key constraint already exists in users table');
      } else {
        console.error('❌ Error adding term_id foreign key constraint:', error.message);
      }
    }

    // Rename within_24hrs to within_12hrs in workout_cancellations table
    try {
      await pool.query(`
        ALTER TABLE workout_cancellations
        RENAME COLUMN within_24hrs TO within_12hrs
      `);
      console.log('✅ within_24hrs column renamed to within_12hrs in workout_cancellations table');
    } catch (error) {
      if (error.code === '42703') {
        console.log('✅ within_12hrs column already exists in workout_cancellations table');
      } else {
        console.error('❌ Error renaming within_24hrs column:', error.message);
      }
    }

    // Migration to convert 'leader' roles to 'coach'
    try {
      const result = await pool.query(`
        UPDATE users 
        SET role = 'coach' 
        WHERE role = 'leader'
      `);
      if (result.rowCount > 0) {
        console.log(`✅ Converted ${result.rowCount} 'leader' roles to 'coach'`);
      } else {
        console.log('✅ No users with "leader" role found to convert');
      }
    } catch (error) {
      console.error('❌ Error converting leader roles to coach:', error.message);
    }

    // Migration to update CHECK constraint to remove 'leader' role
    try {
      await pool.query(`
        ALTER TABLE users
        DROP CONSTRAINT IF EXISTS users_role_check
      `);
      await pool.query(`
        ALTER TABLE users
        ADD CONSTRAINT users_role_check CHECK(role IN ('pending', 'member', 'coach', 'exec', 'administrator'))
      `);
      console.log('✅ Updated role CHECK constraint to remove "leader" role');
    } catch (error) {
      console.error('❌ Error updating role CHECK constraint:', error.message);
    }

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
    const adminExists = await pool.query('SELECT id FROM users WHERE email = $1', ['info@uoft-tri.club']);
    
    if (adminExists.rows.length === 0) {
      // Create admin user (you'll need to set a proper password hash)
      await pool.query(`
        INSERT INTO users (name, email, password_hash, role, charter_accepted)
        VALUES ($1, $2, $3, $4, $5)
      `, ['Admin User', 'info@uoft-tri.club', 'temp_password_hash', 'administrator', true]);
      console.log('✅ Admin user created');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Check if Jade's account exists
    const jadeExists = await pool.query('SELECT id FROM users WHERE email = $1', ['info@uoft-tri.club']);
    
    if (jadeExists.rows.length === 0) {
      // Create Jade's account
      await pool.query(`
        INSERT INTO users (name, email, password_hash, role, charter_accepted)
        VALUES ($1, $2, $3, $4, $5)
      `, ['Jade Clement', 'info@uoft-tri.club', 'temp_password_hash', 'administrator', true]);
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

// If this file is run directly (not required), initialize the database
if (require.main === module) {
  (async () => {
    try {
      await initializeDatabase();
      await seedDatabase();
      console.log('✅ Database initialization complete!');
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      await pool.end();
      process.exit(1);
    }
  })();
}
