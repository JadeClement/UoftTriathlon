// Load environment variables FIRST, before any other imports
require('dotenv').config();

// Debug: Confirm environment variables are loaded
console.log('🔧 Server: JWT_SECRET loaded:', !!process.env.JWT_SECRET);
console.log('🔧 Server: JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'undefined');
console.log('🔧 Server: JWT_SECRET starts with:', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 10) + '...' : 'undefined');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import database to ensure initialization
const { pool, checkDatabaseHealth } = require('./database-pg');
// const { startAutoBackup } = require('./database-backup'); // Commented out for now

// Import middleware
const { authenticateToken, requireAdmin } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const forumRoutes = require('./routes/forum');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const profileRoutes = require('./routes/profiles');
const raceRoutes = require('./routes/races');
const siteRoutes = require('./routes/site');
const gearRoutes = require('./routes/gear');
const merchRoutes = require('./routes/merch');
const testEventsRoutes = require('./routes/testEvents');
const recordsRoutes = require('./routes/records');

const app = express();
const PORT = process.env.PORT || 5001;

// Security and rate limiting temporarily disabled for CORS debugging

// CORS configuration - allow specific origins
app.use(cors({
  origin: [
    'https://www.uoft-tri.club',
    'https://uoft-tri.club', 
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:55731'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Handle preflight requests globally
app.options('*', cors());

// Test endpoint for CORS debugging
app.get('/api/test-cors', (req, res) => {
  res.json({ message: 'CORS test successful', timestamp: new Date().toISOString() });
});

// Test endpoint specifically for races CORS debugging
app.get('/api/test-races-cors', (req, res) => {
  res.json({ 
    message: 'Races CORS test successful', 
    timestamp: new Date().toISOString(),
    endpoint: '/api/test-races-cors'
  });
});

// Simple test route for races endpoint debugging
app.get('/api/test-races-simple', (req, res) => {
  res.json({ 
    message: 'Simple races test successful', 
    timestamp: new Date().toISOString(),
    endpoint: '/api/test-races-simple'
  });
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically (BEFORE API routes to avoid conflicts)
const uploadsPath = path.join(__dirname, 'uploads');
console.log('📁 Static uploads path:', uploadsPath);
console.log('🔍 Uploads directory exists:', require('fs').existsSync(uploadsPath));

app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/races', raceRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/gear', gearRoutes);
app.use('/api/merch-orders', merchRoutes);
app.use('/api/test-events', testEventsRoutes);
app.use('/api/records', recordsRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database health
    await checkDatabaseHealth();
    
    res.json({ 
      status: 'OK', 
      message: 'UofT Triathlon Club API is running',
      timestamp: new Date().toISOString(),
      database: 'Connected',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    console.error('🚨 Health check failed:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'API is running but database connection failed',
      timestamp: new Date().toISOString(),
      database: 'Disconnected',
      error: error.message
    });
  }
});

// Database backup endpoints (admin only) - Commented out during PostgreSQL migration
/*
app.get('/api/admin/backups', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { listBackups } = require('./database-backup');
    const backups = listBackups();
    res.json({ backups });
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.post('/api/admin/backups/create', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { createBackup } = require('./database-backup');
    const backupPath = await createBackup();
    res.json({ message: 'Backup created successfully', path: backupPath });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});
*/

// Frontend is served by Vercel, backend only serves API

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize PostgreSQL database and start server
const { initializeDatabase, seedDatabase } = require('./database-pg');

async function startServer() {
  try {
    // Run migration first
    console.log('🔧 Running database migration...');
    try {
      const { pool } = require('./database-pg');
      
      // Check if workout_id column exists and rename it
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'workout_waitlist' 
        AND column_name = 'workout_id'
      `);
      
      if (columnCheck.rows.length > 0) {
        console.log('📋 Found workout_id column, renaming to post_id...');
        await pool.query('ALTER TABLE workout_waitlist RENAME COLUMN workout_id TO post_id');
        console.log('✅ Column renamed successfully');
        
        // Update constraints and indexes
        await pool.query('ALTER TABLE workout_waitlist DROP CONSTRAINT IF EXISTS workout_waitlist_workout_id_fkey');
        await pool.query('ALTER TABLE workout_waitlist ADD CONSTRAINT workout_waitlist_post_id_fkey FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE');
        await pool.query('ALTER TABLE workout_waitlist DROP CONSTRAINT IF EXISTS workout_waitlist_user_id_workout_id_key');
        await pool.query('ALTER TABLE workout_waitlist ADD CONSTRAINT workout_waitlist_user_id_post_id_key UNIQUE (user_id, post_id)');
        await pool.query('DROP INDEX IF EXISTS idx_workout_waitlist_workout_id');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_workout_waitlist_post_id ON workout_waitlist(post_id)');
        console.log('✅ Migration completed successfully');
      } else {
        console.log('✅ Database schema is already up to date');
      }
    } catch (migrationError) {
      console.error('❌ Migration error:', migrationError.message);
      // Continue anyway - might be a different issue
    }
    
    // Initialize database tables
    await initializeDatabase();
    
    // Seed initial data
    await seedDatabase();
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 UofT Triathlon Club API running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('📊 Database: PostgreSQL (uofttriathlon)');
      // startAutoBackup(); // Commented out for now
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
