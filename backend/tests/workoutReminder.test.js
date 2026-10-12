const {
  isReminderDue,
  isValidReminderHours,
  buildWorkoutReminder,
  DEFAULT_REMINDER_HOURS
} = require('../utils/workoutReminders');

describe('workout signup reminders', () => {
  // 6:15 PM America/Toronto on Oct 12, 2026 (EDT, UTC-4)
  const workoutStart = new Date('2026-10-12T22:15:00.000Z');

  test('defaults to 24 hours and only allows 24, 12, or 1', () => {
    expect(DEFAULT_REMINDER_HOURS).toBe(24);
    expect(isValidReminderHours(24)).toBe(true);
    expect(isValidReminderHours(12)).toBe(true);
    expect(isValidReminderHours(1)).toBe(true);
    expect(isValidReminderHours(6)).toBe(false);
    expect(isValidReminderHours(0)).toBe(false);
  });

  test('sends a 24 hour reminder once that lead time has arrived', () => {
    const signedUpAt = new Date('2026-10-10T15:00:00.000Z');
    expect(isReminderDue({
      workoutStart,
      signedUpAt,
      hoursBefore: 24,
      now: new Date('2026-10-11T22:00:00.000Z')
    })).toBe(false);

    expect(isReminderDue({
      workoutStart,
      signedUpAt,
      hoursBefore: 24,
      now: new Date('2026-10-11T22:16:00.000Z')
    })).toBe(true);
  });

  test('does not remind someone who signed up after the reminder moment', () => {
    expect(isReminderDue({
      workoutStart,
      signedUpAt: new Date('2026-10-11T23:00:00.000Z'),
      hoursBefore: 24,
      now: new Date('2026-10-11T23:05:00.000Z')
    })).toBe(false);
  });

  test('sends a 1 hour reminder in that window only', () => {
    const signedUpAt = new Date('2026-10-10T15:00:00.000Z');
    expect(isReminderDue({
      workoutStart,
      signedUpAt,
      hoursBefore: 1,
      now: new Date('2026-10-12T20:00:00.000Z')
    })).toBe(false);

    expect(isReminderDue({
      workoutStart,
      signedUpAt,
      hoursBefore: 1,
      now: new Date('2026-10-12T21:20:00.000Z')
    })).toBe(true);
  });

  test('does not remind after the workout has started', () => {
    expect(isReminderDue({
      workoutStart,
      signedUpAt: new Date('2026-10-10T15:00:00.000Z'),
      hoursBefore: 1,
      now: new Date('2026-10-12T22:16:00.000Z')
    })).toBe(false);
  });

  test('describes the workout and Toronto start time', () => {
    const message = buildWorkoutReminder({
      title: 'Track Run',
      workoutStart,
      now: new Date('2026-10-11T22:16:00.000Z')
    });
    expect(message.title).toBe('Workout reminder');
    expect(message.body).toContain("You're signed up for Track Run");
    expect(message.body).toContain('tomorrow');
    expect(message.body).toMatch(/6:15/);
  });
});
