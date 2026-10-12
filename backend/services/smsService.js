require('dotenv').config();
const crypto = require('crypto');
const twilio = require('twilio');
const { pool } = require('../database-pg');
const logger = require('../utils/logger');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_MAX_ATTEMPTS = 5;

function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (!value) continue;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.startsWith('your_') || trimmed.startsWith('your-')) continue;
    return trimmed;
  }
  return undefined;
}

function getTwilioConfig() {
  return {
    accountSid: envValue('TWILIO_ACCOUNT_SID'),
    authToken: envValue('TWILIO_AUTH_TOKEN'),
    fromNumber: envValue('TWILIO_FROM_NUMBER', 'TWILIO_PHONE_NUMBER')
  };
}

/**
 * Convert stored North American phone formats to E.164 (+1XXXXXXXXXX).
 * @param {string} phone
 * @returns {string|null}
 */
function toE164(phone) {
  if (!phone) return null;
  const raw = String(phone).trim();
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return digits.length >= 10 ? `+${digits}` : null;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateOtp() {
  const max = 10 ** OTP_LENGTH;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(OTP_LENGTH, '0');
}

let twilioClient;

function isConfigured() {
  const { accountSid, authToken, fromNumber } = getTwilioConfig();
  return Boolean(accountSid && authToken && fromNumber);
}

function getClient() {
  if (twilioClient) return twilioClient;
  const { accountSid, authToken } = getTwilioConfig();
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are not configured');
  }
  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

/**
 * Send an SMS message.
 * @param {string} toPhone - Display or E.164 phone number
 * @param {string} body
 * @returns {Promise<{ success: boolean, sid?: string, error?: string }>}
 */
async function sendSms(toPhone, body) {
  if (!isConfigured()) {
    logger.warn('SmsService: Twilio is not configured; SMS was not sent');
    return { success: false, error: 'SMS is not configured' };
  }

  const to = toE164(toPhone);
  if (!to) {
    return { success: false, error: 'Invalid phone number' };
  }

  try {
    const { fromNumber } = getTwilioConfig();
    const client = getClient();
    const message = await client.messages.create({
      to,
      from: fromNumber,
      body: String(body).slice(0, 320)
    });
    logger.debug(`📲 SMS sent to ${to}, sid=${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('❌ SmsService send error:', error.message || error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

/**
 * Send a verification OTP to the user's phone number.
 * @param {number} userId
 * @param {string} phoneNumber - Number currently on the profile (must match)
 */
async function sendVerificationCode(userId, phoneNumber) {
  if (!isConfigured()) {
    const err = new Error('SMS is not configured on the server');
    err.status = 503;
    throw err;
  }

  const e164 = toE164(phoneNumber);
  if (!e164) {
    const err = new Error('Enter a valid 10-digit phone number on your profile first');
    err.status = 400;
    throw err;
  }

  const userResult = await pool.query(
    'SELECT phone_number FROM users WHERE id = $1 AND is_active = true',
    [userId]
  );
  if (userResult.rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const storedE164 = toE164(userResult.rows[0].phone_number);
  if (!storedE164 || storedE164 !== e164) {
    const err = new Error('Phone number on your profile does not match. Save your phone number first.');
    err.status = 400;
    throw err;
  }

  const recent = await pool.query(
    `SELECT created_at FROM phone_verification_codes
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  if (recent.rows.length > 0) {
    const elapsed = Date.now() - new Date(recent.rows[0].created_at).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      const err = new Error(`Please wait ${waitSec}s before requesting another code`);
      err.status = 429;
      throw err;
    }
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await pool.query('DELETE FROM phone_verification_codes WHERE user_id = $1', [userId]);
  await pool.query(
    `INSERT INTO phone_verification_codes (user_id, phone_number, code_hash, expires_at, attempts)
     VALUES ($1, $2, $3, $4, 0)`,
    [userId, e164, hashOtp(code), expiresAt]
  );

  const result = await sendSms(
    e164,
    `UofT Triathlon verification code: ${code}. Expires in 10 minutes. Msg & data rates may apply.`
  );

  if (!result.success) {
    await pool.query('DELETE FROM phone_verification_codes WHERE user_id = $1', [userId]);
    const err = new Error(result.error || 'Failed to send verification SMS');
    err.status = 502;
    throw err;
  }

  return { success: true, expiresAt };
}

/**
 * Verify OTP and mark the user's phone as verified.
 * @param {number} userId
 * @param {string} code
 */
async function verifyCode(userId, code) {
  const cleaned = String(code || '').replace(/\D/g, '');
  if (cleaned.length !== OTP_LENGTH) {
    const err = new Error(`Enter the ${OTP_LENGTH}-digit code from your text message`);
    err.status = 400;
    throw err;
  }

  const rowResult = await pool.query(
    `SELECT id, phone_number, code_hash, expires_at, attempts
     FROM phone_verification_codes
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (rowResult.rows.length === 0) {
    const err = new Error('No verification code found. Request a new code.');
    err.status = 400;
    throw err;
  }

  const row = rowResult.rows[0];
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await pool.query('DELETE FROM phone_verification_codes WHERE user_id = $1', [userId]);
    const err = new Error('Code expired. Request a new one.');
    err.status = 400;
    throw err;
  }

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await pool.query('DELETE FROM phone_verification_codes WHERE user_id = $1', [userId]);
    const err = new Error('Too many attempts. Request a new code.');
    err.status = 429;
    throw err;
  }

  const expected = Buffer.from(row.code_hash, 'hex');
  const actual = Buffer.from(hashOtp(cleaned), 'hex');
  const matches =
    expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    await pool.query(
      'UPDATE phone_verification_codes SET attempts = attempts + 1 WHERE id = $1',
      [row.id]
    );
    const err = new Error('Incorrect code. Try again.');
    err.status = 400;
    throw err;
  }

  await pool.query(
    `UPDATE users
     SET phone_verified = true, phone_verified_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId]
  );
  await pool.query('DELETE FROM phone_verification_codes WHERE user_id = $1', [userId]);

  return { success: true, phoneNumber: row.phone_number };
}

/**
 * Clear verification (and optionally disable SMS) when phone number changes.
 */
async function clearPhoneVerification(userId, { disableSms = true } = {}) {
  await pool.query(
    `UPDATE users
     SET phone_verified = false, phone_verified_at = NULL
     WHERE id = $1`,
    [userId]
  );
  await pool.query('DELETE FROM phone_verification_codes WHERE user_id = $1', [userId]);
  if (disableSms) {
    await pool.query(
      `UPDATE notification_preferences SET sms_enabled = false, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );
  }
}

/**
 * Normalize two phone strings for equality comparison.
 */
function phonesEqual(a, b) {
  const ea = toE164(a);
  const eb = toE164(b);
  if (ea || eb) return ea === eb;
  const da = String(a || '').replace(/\D/g, '');
  const db = String(b || '').replace(/\D/g, '');
  return da === db;
}

module.exports = {
  isConfigured,
  toE164,
  sendSms,
  sendVerificationCode,
  verifyCode,
  clearPhoneVerification,
  phonesEqual
};
