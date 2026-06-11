'use strict';

const authService = require('../services/authService');
const emailService = require('../services/emailService');
const config = require('../config');

/**
 * Auth Controller — thin HTTP layer.
 * Parses request, calls service, sends response.
 * No business logic lives here.
 */

/**
 * POST /api/auth/send-otp
 * Send an OTP to the user's email (for signup verification or password reset).
 */
async function sendOtp(req, res, next) {
  try {
    const { email, purpose } = req.body;

    // For password reset, verify user exists
    if (purpose === 'password_reset') {
      const { query } = require('../config/database');
      const result = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        // Don't reveal if email exists — always return success
        return res.json({ success: true, message: 'If an account exists, OTP has been sent.' });
      }
    }

    // For signup, check email isn't already registered
    if (purpose === 'signup_verification') {
      const { query } = require('../config/database');
      const result = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (result.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'This email is already registered. Please login.' });
      }
    }

    const otp = await authService.generateAndStoreOTP(email, purpose);
    await emailService.sendOtpEmail(email, otp, purpose);

    res.json({ success: true, message: 'OTP sent to your email.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/verify-otp
 * Verify an OTP (standalone verification, not tied to signup/reset directly).
 */
async function verifyOtp(req, res, next) {
  try {
    const { email, otp, purpose } = req.body;
    await authService.verifyOTP(email, otp, purpose);
    res.json({ success: true, message: 'OTP verified successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/signup
 * Create a new account (email must be pre-verified via OTP).
 */
async function signup(req, res, next) {
  try {
    const { name, email, phone, password, address } = req.body;
    const result = await authService.signup({ name, email, phone, password, address });

    // Set refresh token as httpOnly cookie
    setRefreshCookie(res, result.refreshToken);

    res.status(201).json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Authenticate user and return tokens.
 */
async function login(req, res, next) {
  try {
    const { identifier, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent') || '';

    const result = await authService.login(identifier, password, ipAddress, userAgent);

    // Set refresh token as httpOnly cookie
    setRefreshCookie(res, result.refreshToken);

    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token from cookie.
 */
async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'No refresh token provided.' });
    }

    const tokens = await authService.refreshAccessToken(refreshToken);

    // Set new refresh cookie
    setRefreshCookie(res, tokens.refreshToken);

    res.json({
      success: true,
      accessToken: tokens.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Revoke refresh token and clear cookie.
 */
async function logoutHandler(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logout(refreshToken);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax',
      path: '/',
    });

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/forgot-password
 * Send password reset OTP.
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const { query } = require('../config/database');
    const result = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      const otp = await authService.generateAndStoreOTP(email, 'password_reset');
      await emailService.sendOtpEmail(email, otp, 'password_reset');
    }

    // Always return success (don't reveal if email exists)
    res.json({ success: true, message: 'If an account exists with this email, a reset OTP has been sent.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/reset-password
 * Verify OTP and set new password.
 */
async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body;

    // Verify OTP first
    await authService.verifyOTP(email, otp, 'password_reset');

    // Reset password
    await authService.resetPassword(email, newPassword);

    // Clear any refresh cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax',
      path: '/',
    });

    res.json({ success: true, message: 'Password reset successful. Please login with your new password.' });
  } catch (err) {
    next(err);
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: config.jwt.refreshExpiryDays * 24 * 60 * 60 * 1000,
  });
}

module.exports = {
  sendOtp,
  verifyOtp,
  signup,
  login,
  refresh,
  logout: logoutHandler,
  forgotPassword,
  resetPassword,
};
