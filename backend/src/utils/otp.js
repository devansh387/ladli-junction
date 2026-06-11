'use strict';

const crypto = require('crypto');

/**
 * OTP utilities — generate and format one-time passwords.
 */

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt for uniform distribution.
 * @returns {string} 6-digit string (zero-padded)
 */
function generateOTP() {
  const value = crypto.randomInt(0, 1000000);
  return value.toString().padStart(6, '0');
}

module.exports = { generateOTP };
