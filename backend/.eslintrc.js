module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script',
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-empty': ['warn', { allowEmptyCatch: true }],
  },
  ignorePatterns: ['node_modules/', 'coverage/', 'scripts/', 'utils/migration-runner.js'],
};
