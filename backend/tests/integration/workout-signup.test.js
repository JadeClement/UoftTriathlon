const request = require('supertest');
const express = require('express');
const cors = require('cors');
const { pool } = require('../../database-pg');
const { cleanupTestData, createTestUser, createTestWorkout, getSignupCount, getWaitlistCount } = require('../test-utils/db-helpers');

// Import routes
const forumRoutes = require('../../routes/forum');
const authRoutes = require('../../routes/auth');

// Create test app (mimicking server.js setup)
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/forum', forumRoutes);
app.use('/api/auth', authRoutes);

describe('Workout Signup and Cancellation Integration Tests', () => {
  let testUser1, testUser2, testWorkout;
  let client;
  
  beforeAll(async () => {
    client = await pool.connect();
    await cleanupTestData();
  });
  
  afterAll(async () => {
    await cleanupTestData();
    if (client) client.release();
    await pool.end();
  });
  
  beforeEach(async () => {
    // Create test users
    testUser1 = await createTestUser(client, { email: 'user1@test.com', name: 'Test User 1' });
    testUser2 = await createTestUser(client, { email: 'user2@test.com', name: 'Test User 2' });
    
    // Create a test workout (tomorrow, so outside 12 hours)
    testWorkout = await createTestWorkout(client, {
      user_id: testUser1.id,
      title: 'Integration Test Workout',
      workout_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      workout_time: '10:00:00',
      capacity: 2
    });
  });
  
  afterEach(async () => {
    await cleanupTestData();
  });
  
  describe('Happy Path: Normal Workout Signup Flow', () => {
    test('User can sign up for a workout', async () => {
      const response = await request(app)
        .post(`/api/forum/workouts/${testWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser1.token}`)
        .expect(200);
      
      expect(response.body.message).toMatch(/signed up/i);
      
      const signupCount = await getSignupCount(client, testWorkout.id);
      expect(signupCount).toBe(1);
    });
    
    test('User can cancel signup outside 12 hours', async () => {
      // First sign up
      await request(app)
        .post(`/api/forum/workouts/${testWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser1.token}`);
      
      // Then cancel
      const response = await request(app)
        .post(`/api/forum/workouts/${testWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser1.token}`)
        .expect(200);
      
      expect(response.body.message).toContain('cancelled');
      
      const signupCount = await getSignupCount(client, testWorkout.id);
      expect(signupCount).toBe(0);
    });
  });
  
  describe('Happy Path: Waitlist Flow', () => {
    test('User can join waitlist when workout is full', async () => {
      // Fill up the workout (capacity is 2)
      await request(app)
        .post(`/api/forum/workouts/${testWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser1.token}`);
      
      await request(app)
        .post(`/api/forum/workouts/${testWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser2.token}`);
      
      // User 3 tries to sign up but should be waitlisted
      const testUser3 = await createTestUser(client, { email: 'user3@test.com' });
      
      const response = await request(app)
        .post(`/api/forum/workouts/${testWorkout.id}/waitlist`)
        .set('Authorization', `Bearer ${testUser3.token}`)
        .expect(200);
      
      const waitlistCount = await getWaitlistCount(client, testWorkout.id);
      expect(waitlistCount).toBe(1);
    });
    
    test('Waitlist member is auto-promoted when cancellation is outside 12 hours', async () => {
      // Fill workout
      await request(app)
        .post(`/api/forum/workouts/${testWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser1.token}`);
      
      await request(app)
        .post(`/api/forum/workouts/${testWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser2.token}`);
      
      // User 2 joins waitlist
      await request(app)
        .post(`/api/forum/workouts/${testWorkout.id}/waitlist`)
        .set('Authorization', `Bearer ${testUser2.token}`);
      
      // User 1 cancels (outside 12 hours)
      await request(app)
        .post(`/api/forum/workouts/${testWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser1.token}`);
      
      // Wait a bit for async email processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check that user 2 was auto-promoted
      const signupCount = await getSignupCount(client, testWorkout.id);
      const waitlistCount = await getWaitlistCount(client, testWorkout.id);
      
      expect(signupCount).toBe(1);
      expect(waitlistCount).toBe(0);
    });
  });
  
  describe('Critical Path: 12-Hour Cancellation Rule', () => {
    test('Waitlist member is NOT auto-promoted when cancellation is within 12 hours', async () => {
      // Create workout that starts in 6 hours (within 12 hours)
      const soonWorkout = await createTestWorkout(client, {
        user_id: testUser1.id,
        title: 'Soon Workout',
        workout_date: new Date().toISOString().split('T')[0],
        workout_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toTimeString().split(' ')[0].substring(0, 5) + ':00',
        capacity: 1
      });
      
      // User 1 signs up
      await request(app)
        .post(`/api/forum/workouts/${soonWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser1.token}`);
      
      // User 2 joins waitlist
      await request(app)
        .post(`/api/forum/workouts/${soonWorkout.id}/waitlist`)
        .set('Authorization', `Bearer ${testUser2.token}`);
      
      // User 1 cancels (within 12 hours)
      await request(app)
        .post(`/api/forum/workouts/${soonWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser1.token}`);
      
      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check that user 2 was NOT auto-promoted
      const signupCount = await getSignupCount(client, soonWorkout.id);
      const waitlistCount = await getWaitlistCount(client, soonWorkout.id);
      
      expect(signupCount).toBe(0); // No one signed up
      expect(waitlistCount).toBe(1); // User 2 still on waitlist
    });
    
    test('Absence is recorded when cancellation is within 12 hours', async () => {
      // Create workout within 12 hours
      const soonWorkout = await createTestWorkout(client, {
        user_id: testUser1.id,
        title: 'Soon Workout',
        workout_date: new Date().toISOString().split('T')[0],
        workout_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toTimeString().split(' ')[0].substring(0, 5) + ':00',
        capacity: 1
      });
      
      // User 1 signs up
      await request(app)
        .post(`/api/forum/workouts/${soonWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser1.token}`);
      
      // Get initial absence count
      const beforeResult = await client.query('SELECT absences FROM users WHERE id = $1', [testUser1.id]);
      const absencesBefore = beforeResult.rows[0].absences || 0;
      
      // User 1 cancels (within 12 hours)
      await request(app)
        .post(`/api/forum/workouts/${soonWorkout.id}/signup`)
        .set('Authorization', `Bearer ${testUser1.token}`);
      
      // Check absence count increased
      const afterResult = await client.query('SELECT absences FROM users WHERE id = $1', [testUser1.id]);
      const absencesAfter = afterResult.rows[0].absences || 0;
      
      expect(absencesAfter).toBe(absencesBefore + 1);
    });
  });
});

