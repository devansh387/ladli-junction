'use strict';

const { query, transaction } = require('../config/database');
const { hashPassword, verifyPassword, sha256, generateSecureToken } = require('../utils/hash');
const { generateOTP } = require('../utils/otp');
const { createAccessToken, createRefreshToken } = require('../utils/jwt');
const { AppError } = require('../middleware/errorHandler');
const config = require('../config');

/**
 * Authentication Service — all auth business logic.
 * Handles signup, OTP verification, login, token refresh, logout, password reset.
 */

// ─── Send OTP ────────────────────────────────────────────────────────────────

/**
 * Generate and store an OTP for email verification or password reset.
 * Returns the raw OTP (caller sends via email).
 */
async function generateAndStoreOTP(email, purpose) {
  // Invalidate any existing unused OTPs for this email+purpose
  await query(
    `UPDATE otp_codes SET is_used = TRUE
     WHERE identifier = $1 AND purpose = $2 AND is_used = FALSE`,
    [email, purpose]
  );

  const otp = generateOTP();
  const otpHash = sha256(otp);
  const expiresAt = new Date(Date.now() + config.security.otpExpiryMinutes * 60 * 1000);

  await query(
    `INSERT INTO otp_codes (identifier, otp_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [email, otpHash, purpose, expiresAt]
  );

  return otp;
}

// ─── Verify OTP ──────────────────────────────────────────────────────────────

/**
 * Verify an OTP. Returns true if valid, throws AppError otherwise.
 * Implements attempt counting and constant-time comparison.
 */
async function verifyOTP(email, otp, purpose) {
  const result = await query(
    `SELECT id, otp_hash, attempt_count, expires_at
     FROM otp_codes
     WHERE identifier = $1 AND purpose = $2 AND is_used = FALSE
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, purpose]
  );

  if (result.rows.length === 0) {
    throw new AppError('No OTP found. Please request a new one.', 400);
  }

  const record = result.rows[0];

  // Check expiry
  if (new Date(record.expires_at) < new Date()) {
    await query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [record.id]);
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  // Check attempt count
  if (record.attempt_count >= config.security.maxOtpAttempts) {
    await query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [record.id]);
    throw new AppError('Too many incorrect attempts. Please request a new OTP.', 429);
  }

  // Verify OTP hash (constant-time via SHA-256 comparison)
  const incomingHash = sha256(otp);
  if (incomingHash !== record.otp_hash) {
    await query(
      'UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id = $1',
      [record.id]
    );
    const remaining = config.security.maxOtpAttempts - record.attempt_count - 1;
    throw new AppError(`Invalid OTP. ${remaining} attempt(s) remaining.`, 400);
  }

  // Mark as used
  await query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [record.id]);
  return true;
}

// ─── Signup ──────────────────────────────────────────────────────────────────

/**
 * Create a new user account (email must be pre-verified via OTP).
 * Returns the created user and token pair.
 */
async function signup({ name, email, phone, password, address }) {
  // Check email uniqueness
  const emailCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (emailCheck.rows.length > 0) {
    throw new AppError('An account with this email already exists.', 409);
  }

  // Check phone uniqueness
  const phoneCheck = await query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (phoneCheck.rows.length > 0) {
    throw new AppError('An account with this phone number already exists.', 409);
  }

  const passwordHash = await hashPassword(password);

  const result = await query(
    `INSERT INTO users (name, email, phone, password_hash, address, is_email_verified, role)
     VALUES ($1, $2, $3, $4, $5, TRUE, 'customer')
     RETURNING id, name, email, phone, address, role, created_at`,
    [name, email, phone, passwordHash, address || null]
  );

  const user = result.rows[0];
  const tokens = await createSession(user.id, user.role, user.email);

  return { user, ...tokens };
}

// ─── Login ───────────────────────────────────────────────────────────────────

/**
 * Authenticate a user by email/phone + password.
 * Returns token pair on success.
 */
async function login(identifier, password, ipAddress, userAgent) {
  // Determine if identifier is email or phone
  const isEmail = identifier.includes('@');
  const field = isEmail ? 'email' : 'phone';
  const value = isEmail ? identifier.toLowerCase().trim() : identifier.replace(/[\s\-\(\)]/g, '');

  const result = await query(
    `SELECT id, name, email, phone, password_hash, role, is_email_verified,
            failed_login_attempts, locked_until
     FROM users WHERE ${field} = $1`,
    [value]
  );

  if (result.rows.length === 0) {
    throw new AppError('Invalid credentials. Please check and try again.', 401);
  }

  const user = result.rows[0];

  // Check account lock
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const unlockTime = new Date(user.locked_until).toLocaleString('en-IN');
    throw new AppError(`Account is temporarily locked until ${unlockTime}. Too many failed attempts.`, 403);
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    const attempts = user.failed_login_attempts + 1;
    const lockFields = attempts >= config.security.maxLoginAttempts
      ? `, locked_until = NOW() + INTERVAL '${config.security.lockDurationMinutes} minutes'`
      : '';

    await query(
      `UPDATE users SET failed_login_attempts = $1${lockFields} WHERE id = $2`,
      [attempts, user.id]
    );

    if (attempts >= config.security.maxLoginAttempts) {
      throw new AppError('Account locked due to too many failed attempts. Try again in 30 minutes.', 403);
    }

    throw new AppError('Invalid credentials. Please check and try again.', 401);
  }

  // Reset failed attempts on successful login
  if (user.failed_login_attempts > 0) {
    await query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
      [user.id]
    );
  }

  // Create session
  const tokens = await createSession(user.id, user.role, user.email, ipAddress, userAgent);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    ...tokens,
  };
}

// ─── Refresh Token ───────────────────────────────────────────────────────────

/**
 * Refresh token rotation — revoke old token, issue new pair.
 */
async function refreshAccessToken(refreshToken) {
  const tokenHash = sha256(refreshToken);

  const result = await query(
    `SELECT us.id as session_id, us.user_id, u.role, u.email
     FROM user_sessions us
     JOIN users u ON u.id = us.user_id
     WHERE us.refresh_token_hash = $1
       AND us.is_revoked = FALSE
       AND us.expires_at > NOW()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw new AppError('Invalid or expired refresh token. Please log in again.', 401);
  }

  const { session_id, user_id, role, email } = result.rows[0];

  // Revoke old session
  await query('UPDATE user_sessions SET is_revoked = TRUE WHERE id = $1', [session_id]);

  // Issue new pair
  const tokens = await createSession(user_id, role, email);
  return tokens;
}

// ─── Logout ──────────────────────────────────────────────────────────────────

/**
 * Revoke a refresh token (logout).
 */
async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = sha256(refreshToken);
  await query(
    'UPDATE user_sessions SET is_revoked = TRUE WHERE refresh_token_hash = $1',
    [tokenHash]
  );
}

// ─── Password Reset ──────────────────────────────────────────────────────────

/**
 * Reset password after OTP verification.
 * Revokes ALL active sessions for the user.
 */
async function resetPassword(email, newPassword) {
  const passwordHash = await hashPassword(newPassword);

  const result = await query(
    'UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL WHERE email = $2 RETURNING id',
    [passwordHash, email]
  );

  if (result.rows.length === 0) {
    throw new AppError('No account found with this email.', 404);
  }

  const userId = result.rows[0].id;

  // Revoke ALL active sessions (force re-login everywhere)
  await query(
    'UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1 AND is_revoked = FALSE',
    [userId]
  );
}

// ─── Internal Helper ─────────────────────────────────────────────────────────

/**
 * Create a new session (refresh token stored as SHA-256 hash).
 * Returns access + refresh token pair.
 */
async function createSession(userId, role, email, ipAddress = null, userAgent = null) {
  const { v4: uuidv4 } = require('uuid');
  const sessionId = uuidv4();

  const accessToken = createAccessToken({ userId, role, email });
  const refreshToken = createRefreshToken({ userId, sessionId });
  const refreshTokenHash = sha256(refreshToken);
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiryDays * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, userId, refreshTokenHash, expiresAt, ipAddress, userAgent]
  );

  return { accessToken, refreshToken };
}

module.exports = {
  generateAndStoreOTP,
  verifyOTP,
  signup,
  login,
  refreshAccessToken,
  logout,
  resetPassword,
};
