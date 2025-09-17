const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Database file path
const dbPath = path.join(__dirname, 'triathlon_club.db');

// Create/connect to database with better error handling
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    console.error('🔍 Database path:', dbPath);
    console.error('🔍 Current working directory:', process.cwd());
    process.exit(1); // Exit if we can't connect to database
  } else {
    console.log('✅ Connected to SQLite database');
    console.log('📁 Database path:', dbPath);
    initDatabase();
  }
});

// Add database error handling
db.on('error', (err) => {
  console.error('🚨 Database error:', err);
});

// Add database close handling
db.on('close', () => {
  console.log('🔒 Database connection closed');
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, closing database...');
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err.message);
    } else {
      console.log('✅ Database closed successfully');
    }
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, closing database...');
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err.message);
    } else {
      console.log('✅ Database closed successfully');
    }
    process.exit(0);
  });
});

// Initialize database tables
function initDatabase() {
  console.log('🔧 Initializing database tables...');
  
  // Enable foreign keys and other optimizations
  db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) console.error('❌ Error enabling foreign keys:', err.message);
      else console.log('✅ Foreign keys enabled');
    });
    
    // Enable WAL mode for better concurrency
    db.run('PRAGMA journal_mode = WAL', (err) => {
      if (err) console.error('❌ Error enabling WAL mode:', err.message);
      else console.log('✅ WAL mode enabled');
    });
    
    // Set synchronous mode for better performance
    db.run('PRAGMA synchronous = NORMAL', (err) => {
      if (err) console.error('❌ Error setting synchronous mode:', err.message);
      else console.log('✅ Synchronous mode set to NORMAL');
    });
    
    // Set cache size for better performance
    db.run('PRAGMA cache_size = 10000', (err) => {
      if (err) console.error('❌ Error setting cache size:', err.message);
      else console.log('✅ Cache size set to 10000');
    });
    
    // Create tables


    // Users table with all member info
    db.run(`
              CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT DEFAULT 'pending' CHECK(role IN ('pending', 'member', 'exec', 'administrator')),
          join_date DATE DEFAULT CURRENT_DATE,
          expiry_date DATE,
          payment_confirmed BOOLEAN DEFAULT 0,
          emergency_contact TEXT,
          phone TEXT,
          address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          is_active BOOLEAN DEFAULT 1
        )
    `, (err) => {
      if (err) console.error('❌ Error creating users table:', err.message);
      else console.log('✅ Users table created');
    });

    // Forum posts table
    db.run(`
      CREATE TABLE IF NOT EXISTS forum_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        title TEXT,
        workout_type TEXT,
        workout_date DATE,
        type TEXT DEFAULT 'general' CHECK(type IN ('general', 'workout', 'event')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        likes INTEGER DEFAULT 0,
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('❌ Error creating forum_posts table:', err.message);
      else console.log('✅ Forum posts table created');
    });

    // Add type column to existing forum_posts table if it doesn't exist
    db.run('ALTER TABLE forum_posts ADD COLUMN type TEXT DEFAULT "general"', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding type column:', err.message);
      } else {
        console.log('✅ Type column added to forum_posts table');
      }
    });

    // Add workout-specific columns to existing forum_posts table
    db.run('ALTER TABLE forum_posts ADD COLUMN title TEXT', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding title column:', err.message);
      } else {
        console.log('✅ Title column added to forum_posts table');
      }
    });

    db.run('ALTER TABLE forum_posts ADD COLUMN workout_type TEXT', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding workout_type column:', err.message);
      } else {
        console.log('✅ Workout type column added to forum_posts table');
      }
    });

    db.run('ALTER TABLE forum_posts ADD COLUMN workout_date DATE', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding workout_date column:', err.message);
      } else {
        console.log('✅ Workout date column added to forum_posts table');
      }
    });

    db.run('ALTER TABLE forum_posts ADD COLUMN workout_time TEXT', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding workout_time column:', err.message);
      } else {
        console.log('✅ Workout time column added to forum_posts table');
      }
    });

    // Add capacity column to existing forum_posts table
    db.run('ALTER TABLE forum_posts ADD COLUMN capacity INTEGER', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding capacity column:', err.message);
      } else {
        console.log('✅ Capacity column added to forum_posts table');
      }
    });

    db.run('ALTER TABLE forum_posts ADD COLUMN event_date DATE', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding event_date column:', err.message);
      } else {
        console.log('✅ Event date column added to forum_posts table');
      }
    });

    // Add bio and profile_picture_url columns to existing users table
    db.run('ALTER TABLE users ADD COLUMN bio TEXT', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding bio column:', err.message);
      } else {
        console.log('✅ Bio column added to users table');
      }
    });

    db.run('ALTER TABLE users ADD COLUMN profile_picture_url TEXT', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding profile_picture_url column:', err.message);
      } else {
        console.log('✅ Profile picture URL column added to users table');
      }
    });

    // Update existing posts to have a default type
    db.run('UPDATE forum_posts SET type = "general" WHERE type IS NULL', (err) => {
      if (err) {
        console.error('❌ Error updating existing posts:', err.message);
      } else {
        console.log('✅ Existing posts updated with default type');
      }
    });

    // Login history table
    db.run(`
      CREATE TABLE IF NOT EXISTS login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('❌ Error creating login_history table:', err.message);
      else console.log('✅ Login history table created');
    });

    // Drop and recreate workout_signups table with correct schema
    db.run('DROP TABLE IF EXISTS workout_signups', (err) => {
      if (err) {
        console.error('❌ Error dropping workout_signups table:', err.message);
      } else {
        console.log('✅ Old workout_signups table dropped');
      }
    });

    // Create new workout_signups table
    db.run(`
      CREATE TABLE workout_signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        workout_id INTEGER NOT NULL,
        signed_up_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workout_id) REFERENCES forum_posts(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('❌ Error creating workout_signups table:', err.message);
      else console.log('✅ New workout_signups table created');
    });

    // Create races table
    db.run(`
      CREATE TABLE IF NOT EXISTS races (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        date DATE NOT NULL,
        location TEXT,
        description TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('❌ Error creating races table:', err.message);
      else console.log('✅ Races table created');
    });

    // Create race_signups table
    db.run(`
      CREATE TABLE IF NOT EXISTS race_signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        race_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        signup_date DATE DEFAULT CURRENT_DATE,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('❌ Error creating race_signups table:', err.message);
      else console.log('✅ Race signups table created');
    });

    // Add absences column to users table
    db.run('ALTER TABLE users ADD COLUMN absences INTEGER DEFAULT 0', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding absences column:', err.message);
      } else {
        console.log('✅ Absences column added to users table');
      }
    });

    // Create workout_attendance table
    db.run(`
      CREATE TABLE IF NOT EXISTS workout_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        is_present BOOLEAN NOT NULL,
        recorded_by INTEGER NOT NULL,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workout_id, user_id)
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating workout_attendance table:', err.message);
      } else {
        console.log('✅ Workout attendance table created');
      }
    });

    // Create role_change_notifications table
    db.run(`
      CREATE TABLE IF NOT EXISTS role_change_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        old_role TEXT NOT NULL,
        new_role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating role_change_notifications table:', err.message);
      } else {
        console.log('✅ Role change notifications table created');
      }
    });

    // Create indexes for better performance
    db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)', (err) => {
      if (err) console.error('❌ Error creating email index:', err.message);
      else console.log('✅ Email index created');
    });

    // Add charter acceptance columns to users table
    db.run('ALTER TABLE users ADD COLUMN charter_accepted INTEGER DEFAULT 0', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding charter_accepted column:', err.message);
      } else {
        console.log('✅ charter_accepted column ensured');
      }
    });

    db.run('ALTER TABLE users ADD COLUMN charter_accepted_at DATETIME', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error adding charter_accepted_at column:', err.message);
      } else {
        console.log('✅ charter_accepted_at column ensured');
      }
    });

    db.run('CREATE INDEX IF NOT EXISTS idx_forum_posts_user ON forum_posts(user_id)', (err) => {
      if (err) console.error('❌ Error creating forum user index:', err.message);
      else console.log('✅ Forum user index created');
    });

    db.run('CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id)', (err) => {
      if (err) console.error('❌ Error creating login history index:', err.message);
      else console.log('✅ Login history index created');
    });

    // Seed initial admin user
    seedInitialData();
  });
}

// Seed initial data
async function seedInitialData() {
  console.log('🌱 Seeding initial data...');
  
  // Check if admin user already exists
  db.get('SELECT id FROM users WHERE email = ?', ['info@uoft-tri.club'], async (err, row) => {
    if (err) {
      console.error('❌ Error checking admin user:', err.message);
      return;
    }
    
    if (!row) {
      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      db.run(`
        INSERT INTO users (email, password, name, role, join_date, expiry_date, payment_confirmed, is_active)
        VALUES (?, ?, ?, 'administrator', DATE('now'), DATE('now', '+1 year'), 1, 1)
      `, ['info@uoft-tri.club', hashedPassword, 'Club Administrator'], function(err) {
        if (err) {
          console.error('❌ Error creating admin user:', err.message);
        } else {
          console.log('✅ Admin user created with ID:', this.lastID);
          console.log('🔑 Admin credentials: info@uoft-tri.club / admin123');
        }
      });
    } else {
      console.log('✅ Admin user already exists');
    }
  });

  // Add reset token columns to users table
  db.run('ALTER TABLE users ADD COLUMN reset_token TEXT;', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error adding reset_token column:', err.message);
    } else {
      console.log('✅ Reset token column added to users table');
    }
  });

  db.run('ALTER TABLE users ADD COLUMN reset_token_expiry DATETIME;', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Error adding reset_token_expiry column:', err.message);
    } else {
      console.log('✅ Reset token expiry column added to users table');
    }
  });

  // Check if sample members exist
  db.get('SELECT COUNT(*) as count FROM users WHERE role = "member"', (err, row) => {
    if (err) {
      console.error('❌ Error checking member count:', err.message);
      return;
    }
    
    if (row.count === 0) {
      console.log('🌱 Creating sample members...');
      createSampleMembers(() => {
        // After sample members are created, add Jade's account
        addJadeAccount(() => {
          console.log('✅ Database seeding completed');
        });
      });
    } else {
      console.log('✅ Sample members already exist');
      // Sample members exist, just add Jade's account
      addJadeAccount(() => {
        console.log('✅ Database seeding completed');
      });
    }
  });
}

// Create sample members
function createSampleMembers(callback) {
  const sampleMembers = [
    {
      email: 'john.doe@mail.utoronto.ca',
      password: 'password123',
      name: 'John Doe'
    },
    {
      email: 'jane.smith@mail.utoronto.ca',
      password: 'password123',
      name: 'Jane Smith'
    }
  ];

  let completedCount = 0;
  const totalMembers = sampleMembers.length;

  sampleMembers.forEach((member) => {
    bcrypt.hash(member.password, 10).then(hashedPassword => {
      db.run(`
        INSERT INTO users (email, password, name, role, join_date, expiry_date, payment_confirmed, is_active)
        VALUES (?, ?, ?, 'member', DATE('now', '-30 days'), DATE('now', '+1 year'), 1, 1)
      `, [member.email, hashedPassword, member.name], function(err) {
        if (err) {
          console.error(`❌ Error creating sample member ${member.name}:`, err.message);
        } else {
          console.log(`✅ Sample member created: ${member.name}`);
        }
        
        completedCount++;
        if (completedCount === totalMembers) {
          console.log('🌱 All sample members created, calling callback...');
          callback();
        }
      });
    }).catch(err => {
      console.error(`❌ Error hashing password for ${member.name}:`, err.message);
      completedCount++;
      if (completedCount === totalMembers) {
        console.log('🌱 All sample members processed, calling callback...');
        callback();
      }
    });
  });
}

// Add Jade's account
function addJadeAccount(callback) {
  db.get('SELECT id FROM users WHERE email = ?', ['jade.clement@mail.utoronto.ca'], (err, row) => {
    if (err) {
      console.error('❌ Error checking Jade\'s account:', err.message);
      if (callback) callback();
      return;
    }
    
    if (!row) {
      // Create Jade's account
      bcrypt.hash('jade123', 10).then(hashedPassword => {
        db.run(`
          INSERT INTO users (email, password, name, role, join_date, expiry_date, payment_confirmed, is_active)
          VALUES (?, ?, ?, 'administrator', DATE('now'), DATE('now', '+1 year'), 1, 1)
        `, ['jade.clement@mail.utoronto.ca', hashedPassword, 'Jade Clement'], function(err) {
          if (err) {
            console.error('❌ Error creating Jade\'s account:', err.message);
          } else {
            console.log('✅ Jade\'s account created with ID:', this.lastID);
            console.log('🔑 Jade\'s credentials: jade.clement@mail.utoronto.ca / jade123');
          }
          if (callback) callback();
        });
      }).catch(err => {
        console.error('❌ Error hashing Jade\'s password:', err.message);
        if (callback) callback();
      });
    } else {
      console.log('✅ Jade\'s account already exists');
      if (callback) callback();
    }
  });
}

// Close database connection
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err.message);
    } else {
      console.log('✅ Database connection closed');
    }
    process.exit(0);
  });
});

// Database health check function
function checkDatabaseHealth() {
  return new Promise((resolve, reject) => {
    db.get('SELECT 1 as health', (err, result) => {
      if (err) {
        console.error('🚨 Database health check failed:', err);
        reject(err);
      } else {
        console.log('✅ Database health check passed');
        resolve(true);
      }
    });
  });
}

// Export database and health check
module.exports = { db, checkDatabaseHealth };
