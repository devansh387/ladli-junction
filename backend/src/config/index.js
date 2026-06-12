'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Centralized configuration module.
 * All environment variables are validated and exported from here.
 * If a required variable is missing, the process exits immediately.
 */

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    console.error(`[FATAL] Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

const config = Object.freeze({
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  isProduction: (process.env.NODE_ENV || 'development') === 'production',

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // JWT
  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    refreshExpiryDays: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 10) || 7,
  },

  // CORS
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, ''),

  // Brevo Email
  brevo: {
    apiKey: requireEnv('BREVO_API_KEY'),
    fromEmail: process.env.MAIL_FROM || 'ladlijunction33@gmail.com',
    fromName: process.env.MAIL_FROM_NAME || 'Ladli Junction',
    orderNotificationEmail: process.env.ORDER_NOTIFICATION_EMAIL || 'ladlijunction33@gmail.com',
  },

  // Admin (seeded in DB)
  admin: {
    email: process.env.ADMIN_EMAIL || 'ladlijunction33@gmail.com',
    phone: process.env.ADMIN_PHONE || '9429670205',
    password: process.env.ADMIN_PASSWORD || 'LadliAdmin@2024Secure!',
  },

  // File Uploads
  uploads: {
    dir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 20,
  },

  // Supabase Storage
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  // Security
  security: {
    maxLoginAttempts: 5,
    lockDurationMinutes: 30,
    otpExpiryMinutes: 5,
    maxOtpAttempts: 5,
    bcryptRounds: 12,
  },
});

module.exports = config;
