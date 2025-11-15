module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/test-utils/'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/tests/**/*.test.js',
    '**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  verbose: true
};

