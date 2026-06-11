'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');

/**
 * Hashing utilities — bcrypt for passwords, SHA-256 for tokens/OTPs.
 */

/**
 * Hash a password with bcrypt.
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  return bcrypt.hash(password, config.security.bcryptRounds);
}

/**
 * Verify a password against its bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * SHA-256 hash a string (for tokens, OTPs — stored in DB).
 * @param {string} value
 * @returns {string} hex-encoded hash
 */
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a cryptographically secure random token.
 * @param {number} bytes - Number of random bytes (default 32)
 * @returns {string} URL-safe base64 string
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Constant-time string comparison (timing-attack safe).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  hashPassword,
  verifyPassword,
  sha256,
  generateSecureToken,
  timingSafeEqual,
};
