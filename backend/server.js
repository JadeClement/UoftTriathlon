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

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware - temporarily disabled for CORS debugging
// app.use(helmet({
//   crossOriginResourcePolicy: { policy: "cross-origin" },
//   contentSecurityPolicy: false
// }));

// Rate limiting - temporarily disabled for CORS debugging
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100 // limit each IP to 100 requests per windowMs
// });
// app.use(limiter);

// CORS configuration - temporarily allow all origins for debugging
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
});

// Handle preflight requests globally
app.options('*', cors());

// Test endpoint for CORS debugging
app.get('/api/test-cors', (req, res) => {
  res.json({ message: 'CORS test successful', timestamp: new Date().toISOString() });
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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

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
    // Initialize database tables
    await initializeDatabase();
    
    // Seed initial data
    await seedDatabase();
    
    // Start server
    app.listen(PORT, 'localhost', () => {
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
