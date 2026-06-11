'use strict';

const { Router } = require('express');
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const {
  signupSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../schemas/authSchemas');

const router = Router();

/**
 * Auth Routes — /api/auth/*
 * All public (no authentication required).
 * Rate limited to prevent brute-force attacks.
 */

// Send OTP (for signup verification or password reset)
router.post('/send-otp', otpLimiter, validate(sendOtpSchema), authController.sendOtp);

// Verify OTP (standalone)
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);

// Signup (email must be pre-verified via OTP)
router.post('/signup', authLimiter, validate(signupSchema), authController.signup);

// Login
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// Refresh access token
router.post('/refresh', authController.refresh);

// Logout
router.post('/logout', authController.logout);

// Forgot password (sends OTP)
router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), authController.forgotPassword);

// Reset password (verifies OTP + sets new password)
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
