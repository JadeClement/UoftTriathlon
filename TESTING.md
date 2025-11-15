# Testing Setup - Quick Start Guide

## 🎯 What This Does

This testing setup helps you catch errors **before** pushing to main by:
- Running integration tests on critical workflows
- Testing the 12-hour cancellation rule we just implemented
- Verifying waitlist promotion logic
- Checking database operations

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Run Tests Locally
```bash
npm test
```

### 3. Before Every Push
Always run tests first:
```bash
cd backend
npm test
```

If tests pass ✅ → Safe to push!
If tests fail ❌ → Fix the issues before pushing

## 📋 What Gets Tested

### Critical Paths (Happy Path Tests)
- ✅ User signup for workouts
- ✅ User cancellation (outside 12 hours)
- ✅ Waitlist joining when workout is full
- ✅ **Auto-promotion when cancellation is >12 hours** (existing behavior)
- ✅ **NO auto-promotion when cancellation is <12 hours** (new behavior - critical!)
- ✅ Absence tracking for late cancellations

## 🔄 CI/CD Integration

Tests automatically run on:
- Every push to `main` or `develop`
- Every pull request

If tests fail in CI, the push/PR will be blocked.

## 📁 Test Files

- `backend/tests/integration/workout-signup.test.js` - Main integration tests
- `backend/tests/test-utils/db-helpers.js` - Test helper functions
- `.github/workflows/test.yml` - CI/CD configuration

## 🛠️ Adding New Tests

When you add new features, add tests in `backend/tests/integration/`:

```javascript
describe('New Feature Tests', () => {
  test('should do something', async () => {
    // Your test here
  });
});
```

## 💡 Pro Tips

1. **Run tests in watch mode during development:**
   ```bash
   npm run test:watch
   ```

2. **Run only integration tests:**
   ```bash
   npm run test:integration
   ```

3. **Check test coverage:**
   ```bash
   npm test
   # Coverage report will be in backend/coverage/
   ```

## 🐛 Troubleshooting

**Tests failing?**
- Make sure your test database is set up
- Check `.env.test` file exists with correct DATABASE_URL
- Ensure PostgreSQL is running

**Can't connect to database?**
- Verify DATABASE_URL in `.env.test`
- Make sure test database exists
- Check PostgreSQL is running

## 📝 Next Steps

1. Run `npm install` in backend directory
2. Create `.env.test` file (see `backend/tests/README.md`)
3. Run `npm test` to verify everything works
4. Start using `npm test` before every push!

