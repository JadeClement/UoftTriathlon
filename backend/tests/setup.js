// Test setup file - runs before all tests
require('dotenv').config({ path: '.env.test' });
require('dotenv').config(); // Also load regular .env if it exists

// Set test environment variables if not already set
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';

// For tests, use test database URL if provided, otherwise use local defaults
// database-pg.js will handle the connection with local defaults if DATABASE_URL is not set
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
// If no DATABASE_URL is set, database-pg.js will use local defaults (localhost, postgres, uofttriathlon)

// Suppress console logs during tests (optional - comment out if you want to see logs)
// const originalLog = console.log;
// console.log = () => {};

