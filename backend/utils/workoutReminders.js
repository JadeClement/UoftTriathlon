const REMINDER_HOUR_OPTIONS = [24, 12, 1];
const DEFAULT_REMINDER_HOURS = 24;
const TORONTO_TIMEZONE = 'America/Toronto';

function isValidReminderHours(value) {
  const hours = Number(value);
  return REMINDER_HOUR_OPTIONS.includes(hours);
}

/**
 * A reminder is due once the lead time has arrived, the workout has not started,
 * and the member signed up early enough to receive that lead time.
 * Signing up after the reminder moment skips it — they just signed up.
 */
function isReminderDue({ workoutStart, signedUpAt, hoursBefore, now = new Date() }) {
  if (!isValidReminderHours(hoursBefore)) return false;
  if (!(workoutStart instanceof Date) || Number.isNaN(workoutStart.getTime())) return false;
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  if (workoutStart.getTime() <= now.getTime()) return false;

  const reminderAt = workoutStart.getTime() - (Number(hoursBefore) * 60 * 60 * 1000);
  if (now.getTime() < reminderAt) return false;

  if (signedUpAt instanceof Date && !Number.isNaN(signedUpAt.getTime())) {
    if (signedUpAt.getTime() > reminderAt) return false;
  }

  return true;
}

function formatTorontoTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TORONTO_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatTorontoDay(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TORONTO_TIMEZONE,
    weekday: 'long'
  }).format(date);
}

function leadPhrase(workoutStart, now) {
  const msLeft = workoutStart.getTime() - now.getTime();
  const hoursLeft = msLeft / (1000 * 60 * 60);
  if (hoursLeft >= 20) return 'tomorrow';
  if (hoursLeft >= 10) return 'in about 12 hours';
  if (hoursLeft >= 0.75) return 'in about an hour';
  const minutes = Math.max(1, Math.round(msLeft / 60000));
  return `in about ${minutes} minutes`;
}

/**
 * Build the push/SMS copy for a signup reminder.
 * @returns {{ title: string, body: string }}
 */
function buildWorkoutReminder({ title, workoutStart, now = new Date() }) {
  const name = title && String(title).trim() ? String(title).trim() : 'your workout';
  const timeLabel = formatTorontoTime(workoutStart);
  const dayLabel = formatTorontoDay(workoutStart);
  const when = leadPhrase(workoutStart, now);
  const whenWithTime = when === 'tomorrow' || when === 'in about 12 hours'
    ? `${when} (${dayLabel} at ${timeLabel})`
    : `${when}, at ${timeLabel}`;

  return {
    title: 'Workout reminder',
    body: `You're signed up for ${name}. It starts ${whenWithTime}.`
  };
}

module.exports = {
  REMINDER_HOUR_OPTIONS,
  DEFAULT_REMINDER_HOURS,
  isValidReminderHours,
  isReminderDue,
  buildWorkoutReminder
};
