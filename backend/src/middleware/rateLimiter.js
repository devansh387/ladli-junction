'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Rate limiting middleware factories.
 * Each returns an express-rate-limit instance with appropriate limits.
 */

/**
 * General API rate limit — 100 requests per minute per IP.
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
  keyGenerator: (req) => req.ip,
});

/**
 * Auth endpoints — 10 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Please try again later.' },
  keyGenerator: (req) => req.ip,
});

/**
 * OTP endpoints — 5 requests per hour per IP.
 */
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'OTP request limit reached. Please try again later.' },
  keyGenerator: (req) => req.ip,
});

/**
 * Order placement — 10 orders per hour per IP.
 */
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Order limit reached. Please try again later.' },
  keyGenerator: (req) => req.ip,
});

module.exports = { generalLimiter, authLimiter, otpLimiter, orderLimiter };
