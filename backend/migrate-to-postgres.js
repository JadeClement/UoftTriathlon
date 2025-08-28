const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// SQLite database path
const sqlitePath = path.join(__dirname, 'triathlon_club.db');

// PostgreSQL connection
// IMPORTANT: Update the password below to match your PostgreSQL password
const pgPool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'uofttriathlon',
  password: 'your_password_here', // Change this to your actual PostgreSQL password
  port: 5432,
});

// Open SQLite database
const sqliteDb = new sqlite3.Database(sqlitePath);

async function migrateData() {
  try {
    console.log('🚀 Starting migration from SQLite to PostgreSQL...');
    
    // Debug: Check what tables exist in SQLite
    console.log('🔍 Inspecting SQLite database structure...');
    const tables = await getSqliteData("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('📋 SQLite tables found:', tables.map(t => t.name));
    
    // Initialize PostgreSQL database first
    const { initializeDatabase, seedDatabase } = require('./database-pg');
    await initializeDatabase();
    
    console.log('📊 Migrating users...');
    const users = await getSqliteData('SELECT * FROM users WHERE is_active = 1');
    
    for (const user of users) {
      // Handle null password_hash by providing a default
      const passwordHash = user.password_hash || 'temp_migration_password_hash_' + user.id;
      
      await pgPool.query(`
        INSERT INTO users (
          id, name, email, password_hash, role, expiry_date, bio, 
          profile_picture_url, phone_number, absences, charter_accepted, 
          charter_accepted_at, reset_token, reset_token_expiry, is_active, 
          created_at, last_login
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          expiry_date = EXCLUDED.expiry_date,
          bio = EXCLUDED.bio,
          profile_picture_url = EXCLUDED.profile_picture_url,
          phone_number = EXCLUDED.phone_number,
          absences = EXCLUDED.absences,
          charter_accepted = EXCLUDED.charter_accepted,
          charter_accepted_at = EXCLUDED.charter_accepted_at,
          reset_token = EXCLUDED.reset_token,
          reset_token_expiry = EXCLUDED.reset_token_expiry,
          is_active = EXCLUDED.is_active,
          created_at = EXCLUDED.created_at,
          last_login = EXCLUDED.last_login
      `, [
        user.id, user.name, user.email, passwordHash, user.role,
        user.expiry_date, user.bio, user.profile_picture_url, user.phone_number,
        user.absences || 0, user.charter_accepted || false, user.charter_accepted_at,
        user.reset_token, user.reset_token_expiry, user.is_active,
        user.created_at, user.last_login
      ]);
    }
    console.log(`✅ Migrated ${users.length} users`);

    console.log('📊 Migrating forum posts...');
    // Check if is_deleted column exists in SQLite forum_posts table
    let posts;
    try {
      posts = await getSqliteData('SELECT * FROM forum_posts WHERE is_deleted = 0');
    } catch (error) {
      // If is_deleted column doesn't exist, get all posts
      console.log('⚠️ is_deleted column not found in forum_posts table, migrating all posts...');
      posts = await getSqliteData('SELECT * FROM forum_posts');
    }
    
    for (const post of posts) {
      await pgPool.query(`
        INSERT INTO forum_posts (
          id, user_id, content, type, title, workout_type, workout_date, 
          workout_time, capacity, event_date, is_deleted, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          content = EXCLUDED.content,
          type = EXCLUDED.type,
          title = EXCLUDED.title,
          workout_type = EXCLUDED.workout_type,
          workout_date = EXCLUDED.workout_date,
          workout_time = EXCLUDED.workout_time,
          capacity = EXCLUDED.capacity,
          event_date = EXCLUDED.event_date,
          is_deleted = EXCLUDED.is_deleted,
          created_at = EXCLUDED.created_at
      `, [
        post.id, 
        post.user_id, 
        post.content, 
        post.type || 'post', 
        post.title || null,
        post.workout_type || null, 
        post.workout_date || null, 
        post.workout_time || null,
        post.capacity || null, 
        post.event_date || null, 
        post.is_deleted || false, 
        post.created_at || new Date().toISOString()
      ]);
    }
    console.log(`✅ Migrated ${posts.length} forum posts`);

    console.log('📊 Migrating workout signups...');
    const signups = await getSqliteData('SELECT * FROM workout_signups');
    
    for (const signup of signups) {
      // Check if the referenced user and post exist before inserting
      const userExists = await pgPool.query('SELECT id FROM users WHERE id = $1', [signup.user_id]);
      const postExists = await pgPool.query('SELECT id FROM forum_posts WHERE id = $1', [signup.post_id]);
      
      if (userExists.rows.length === 0) {
        console.log(`⚠️ Skipping workout signup ${signup.id}: user_id ${signup.user_id} not found`);
        continue;
      }
      
      if (postExists.rows.length === 0) {
        console.log(`⚠️ Skipping workout signup ${signup.id}: post_id ${signup.post_id} not found`);
        continue;
      }
      
      await pgPool.query(`
        INSERT INTO workout_signups (id, user_id, post_id, signup_time)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          post_id = EXCLUDED.post_id,
          signup_time = EXCLUDED.signup_time
      `, [signup.id, signup.user_id, signup.post_id, signup.signup_time]);
    }
    console.log(`✅ Migrated ${signups.length} workout signups`);

    console.log('📊 Migrating workout attendance...');
    const attendance = await getSqliteData('SELECT * FROM workout_attendance');
    
    for (const record of attendance) {
      // Check if the referenced user and post exist before inserting
      const userExists = await pgPool.query('SELECT id FROM users WHERE id = $1', [record.user_id]);
      const postExists = await pgPool.query('SELECT id FROM forum_posts WHERE id = $1', [record.post_id]);
      
      if (userExists.rows.length === 0) {
        console.log(`⚠️ Skipping workout attendance ${record.id}: user_id ${record.user_id} not found`);
        continue;
      }
      
      if (postExists.rows.length === 0) {
        console.log(`⚠️ Skipping workout attendance ${record.id}: post_id ${record.post_id} not found`);
        continue;
      }
      
      await pgPool.query(`
        INSERT INTO workout_attendance (id, post_id, user_id, attended, recorded_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          post_id = EXCLUDED.post_id,
          user_id = EXCLUDED.user_id,
          attended = EXCLUDED.attended,
          recorded_at = EXCLUDED.recorded_at
      `, [record.id, record.post_id, record.user_id, record.attended, record.recorded_at]);
    }
    console.log(`✅ Migrated ${attendance.length} workout attendance records`);

    console.log('📊 Migrating races...');
    // Check if is_deleted column exists in SQLite races table
    let races;
    try {
      races = await getSqliteData('SELECT * FROM races WHERE is_deleted = 0');
    } catch (error) {
      // If is_deleted column doesn't exist, get all races
      console.log('⚠️ is_deleted column not found in races table, migrating all races...');
      races = await getSqliteData('SELECT * FROM races');
    }
    
    for (const race of races) {
      await pgPool.query(`
        INSERT INTO races (id, name, date, location, description, is_deleted, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          date = EXCLUDED.date,
          location = EXCLUDED.location,
          description = EXCLUDED.description,
          is_deleted = EXCLUDED.is_deleted,
          created_at = EXCLUDED.created_at
      `, [
        race.id, 
        race.name, 
        race.date, 
        race.location || null, 
        race.description || null, 
        race.is_deleted || false, 
        race.created_at || new Date().toISOString()
      ]);
    }
    console.log(`✅ Migrated ${races.length} races`);

    console.log('📊 Migrating race signups...');
    const raceSignups = await getSqliteData('SELECT * FROM race_signups');
    
    for (const signup of raceSignups) {
      // Check if the referenced user and race exist before inserting
      const userExists = await pgPool.query('SELECT id FROM users WHERE id = $1', [signup.user_id]);
      const raceExists = await pgPool.query('SELECT id FROM races WHERE id = $1', [signup.race_id]);
      
      if (userExists.rows.length === 0) {
        console.log(`⚠️ Skipping race signup ${signup.id}: user_id ${signup.user_id} not found`);
        continue;
      }
      
      if (raceExists.rows.length === 0) {
        console.log(`⚠️ Skipping race signup ${signup.id}: race_id ${signup.race_id} not found`);
        continue;
      }
      
      await pgPool.query(`
        INSERT INTO race_signups (id, user_id, race_id, signup_time)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          race_id = EXCLUDED.race_id,
          signup_time = EXCLUDED.signup_time
      `, [signup.id, signup.user_id, signup.race_id, signup.signup_time]);
    }
    console.log(`✅ Migrated ${raceSignups.length} race signups`);

    console.log('📊 Migrating login history...');
    const loginHistory = await getSqliteData('SELECT * FROM login_history');
    
    for (const record of loginHistory) {
      // Check if the referenced user exists before inserting
      const userExists = await pgPool.query('SELECT id FROM users WHERE id = $1', [record.user_id]);
      
      if (userExists.rows.length === 0) {
        console.log(`⚠️ Skipping login history ${record.id}: user_id ${record.user_id} not found`);
        continue;
      }
      
      await pgPool.query(`
        INSERT INTO login_history (id, user_id, ip_address, user_agent, login_time)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          login_time = EXCLUDED.login_time
      `, [record.id, record.user_id, record.ip_address, record.user_agent, record.login_time]);
    }
    console.log(`✅ Migrated ${loginHistory.length} login history records`);

    console.log('📊 Migrating role change notifications...');
    const notifications = await getSqliteData('SELECT * FROM role_change_notifications');
    
    for (const notification of notifications) {
      // Check if the referenced user exists before inserting
      const userExists = await pgPool.query('SELECT id FROM users WHERE id = $1', [notification.user_id]);
      
      if (userExists.rows.length === 0) {
        console.log(`⚠️ Skipping role change notification ${notification.id}: user_id ${notification.user_id} not found`);
        continue;
      }
      
      await pgPool.query(`
        INSERT INTO role_change_notifications (id, user_id, old_role, new_role, created_at, is_read)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          old_role = EXCLUDED.old_role,
          new_role = EXCLUDED.new_role,
          created_at = EXCLUDED.created_at,
          is_read = EXCLUDED.is_read
      `, [notification.id, notification.user_id, notification.old_role, notification.new_role, notification.created_at, notification.is_read]);
    }
    console.log(`✅ Migrated ${notifications.length} role change notifications`);

    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close connections
    sqliteDb.close();
    await pgPool.end();
  }
}

// Helper function to get data from SQLite
function getSqliteData(query) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(query, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Helper function to get table schema from SQLite
function getTableSchema(tableName) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateData()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateData };
