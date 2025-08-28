const jwt = require('jsonwebtoken');
const { pool } = require('../database-pg');

// JWT secret (in production, use environment variable)
// Force use of environment variable to match the routes
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET environment variable is not set!');
  console.error('❌ This will cause authentication to fail.');
  process.exit(1);
}

// Debug: Log which JWT secret is being used
console.log('🔒 Auth Middleware: JWT_SECRET from env:', !!process.env.JWT_SECRET);
console.log('🔒 Auth Middleware: JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'undefined');
console.log('🔒 Auth Middleware: Using JWT_SECRET:', JWT_SECRET.substring(0, 10) + '...');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  console.log('🔒 Auth Middleware: authenticateToken called');
  console.log('🔒 Auth Middleware: Using JWT_SECRET:', JWT_SECRET.substring(0, 10) + '...');
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.warn('🔒 Auth: Missing token');
    return res.status(401).json({ error: 'Access token required' });
  }

  console.log('🔒 Auth Middleware: Token received:', token.substring(0, 20) + '...');

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.warn('🔒 Auth: Token verification failed:', err && err.message);
      console.warn('🔒 Auth: JWT_SECRET used:', JWT_SECRET.substring(0, 10) + '...');
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.log('🔒 Auth Middleware: Token verification successful');
    req.user = user;
    next();
  });
};

// Middleware to check if user has required role
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const roleHierarchy = {
      'public': 0,
      'pending': 1,
      'member': 2,
      'exec': 3,
      'administrator': 4
    };

    const userRole = req.user.role || 'public';
    
    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredRole,
        current: userRole
      });
    }

    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = requireRole('administrator');

// Middleware to check if user is member or higher
const requireMember = requireRole('member');

// Middleware to check if user is exec or higher
const requireExec = requireRole('exec');

// Middleware to log login activity
const logLoginActivity = async (userId, req) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    await pool.query(`
      INSERT INTO login_history (user_id, ip_address, user_agent)
      VALUES ($1, $2, $3)
    `, [userId, ipAddress, userAgent]);

    // Update last login time
    await pool.query(`
      UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1
    `, [userId]);
  } catch (error) {
    console.error('Error logging login activity:', error);
  }
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireMember,
  requireExec,
  logLoginActivity,
  generateToken,
  JWT_SECRET
};


