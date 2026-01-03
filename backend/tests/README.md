# Testing Guide

This directory contains integration tests for the UofT Triathlon Club backend API.

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up test environment:**
   Create a `.env.test` file in the `backend` directory:
   ```env
   NODE_ENV=test
   DATABASE_URL=postgresql://user:password@localhost:5432/test_db
   JWT_SECRET=test-jwt-secret-key
   ```

3. **Run tests:**
   ```bash
   npm test                 # Run all tests with coverage
   npm run test:watch       # Run tests in watch mode
   npm run test:integration # Run only integration tests
   ```

## Test Structure

- `integration/` - Integration tests for critical workflows
- `test-utils/` - Helper functions for tests

## Critical Paths Tested

### Workout Signup Flow
- ✅ User can sign up for a workout
- ✅ User can cancel signup
- ✅ Waitlist functionality when workout is full
- ✅ Auto-promotion when cancellation is outside 12 hours
- ✅ **NO auto-promotion when cancellation is within 12 hours** (critical!)
- ✅ Absence tracking for late cancellations

## Running Tests Before Pushing

Before pushing to main, always run:
```bash
npm test
```

This will catch:
- Syntax errors
- Logic errors in critical workflows
- Database query issues
- Integration problems

## CI/CD

Tests automatically run on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

See `.github/workflows/test.yml` for CI configuration.

