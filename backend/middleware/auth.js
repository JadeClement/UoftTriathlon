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


// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  
  // Critical check to prevent hanging
  if (!JWT_SECRET || typeof JWT_SECRET !== 'string' || JWT_SECRET.length < 10) {
    console.error('🚨 CRITICAL: Invalid JWT_SECRET detected!');
    console.error('🚨 JWT_SECRET type:', typeof JWT_SECRET);
    console.error('🚨 JWT_SECRET length:', JWT_SECRET ? JWT_SECRET.length : 'undefined');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('🔒 Auth Middleware: No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }


  try {
    // Use synchronous verification to prevent hanging
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    console.error('🚨 JWT verification error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    } else {
      return res.status(403).json({ error: 'Token verification failed' });
    }
  }
};

// Middleware to check if user has required role
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const roleHierarchy = {
      'pending': 1,
      'member': 2,
      'coach': 3,
      'exec': 4,
      'administrator': 5
    };

    const userRole = req.user.role || 'pending';
    
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
const requireMember = (req, res, next) => {
  console.log('🔍 requireMember middleware - User:', req.user);

  if (!req.user) {
    console.log('❌ requireMember: No user found');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const roleHierarchy = {
    'pending': 1,
    'member': 2,
    'coach': 3,
    'exec': 4,
    'administrator': 5
  };

  const userRole = req.user.role || 'pending';
  console.log('🔍 requireMember: User role:', userRole);
  console.log('🔍 requireMember: User object:', req.user);

  // Allow member, exec, and admin roles
  if (roleHierarchy[userRole] >= roleHierarchy['member']) {
    console.log('✅ requireMember: Access granted for role:', userRole);
    next();
  } else {
    console.log('❌ requireMember: Access denied for role:', userRole);
    return res.status(403).json({ 
      error: 'Insufficient permissions',
      required: 'member or higher',
      current: userRole
    });
  }
};

// Middleware to check if user is coach or higher
const requireCoach = requireRole('coach');

// Middleware to check if user is exec or higher
const requireExec = requireRole('exec');

// Middleware to allow users to edit their own profiles
const requireOwnProfile = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Users can always edit their own profiles
    if (req.user.id == req.params.id || req.user.id == req.body.userId) {
      return next();
    }

    // If not editing own profile, require member role
    return requireRole('member')(req, res, next);
  };
};

// Middleware to allow users to edit their own profiles (for profile routes)
const allowOwnProfile = () => {
  return (req, res, next) => {
    console.log('🔒 allowOwnProfile middleware: Starting...');
    console.log('🔒 allowOwnProfile middleware: User ID from token:', req.user?.id);
    
    if (!req.user) {
      console.log('🔒 allowOwnProfile middleware: No user found, returning 401');
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log('🔒 allowOwnProfile middleware: User authenticated, allowing access');
    // Users can always edit their own profiles
    next();
  };
};

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
  requireCoach,
  requireExec,
  requireOwnProfile,
  allowOwnProfile,
  logLoginActivity,
  generateToken,
  JWT_SECRET
};


