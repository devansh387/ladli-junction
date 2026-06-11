'use strict';

const { z } = require('zod');

/**
 * Zod validation schemas for all authentication endpoints.
 * Strict validation prevents injection and ensures data integrity.
 */

const PHONE_REGEX = /^(\+91|91|0)?[6-9]\d{9}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

const signupSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  email: z.string()
    .email('Invalid email address')
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
  phone: z.string()
    .regex(PHONE_REGEX, 'Invalid Indian phone number (must start with 6-9, 10 digits)')
    .transform((v) => v.replace(/[\s\-\(\)]/g, '')),
  password: z.string()
    .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`),
  address: z.string().max(500).trim().optional().default(''),
});

const loginSchema = z.object({
  identifier: z.string()
    .min(1, 'Email or phone is required')
    .max(255)
    .trim(),
  password: z.string()
    .min(1, 'Password is required')
    .max(PASSWORD_MAX),
});

const sendOtpSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
  purpose: z.enum(['signup_verification', 'password_reset']),
});

const verifyOtpSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
  otp: z.string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
  purpose: z.enum(['signup_verification', 'password_reset']),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
});

const resetPasswordSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
  otp: z.string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
  newPassword: z.string()
    .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`),
});

module.exports = {
  signupSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
