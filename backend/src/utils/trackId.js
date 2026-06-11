'use strict';

const crypto = require('crypto');

/**
 * Generate a unique, human-friendly order tracking ID.
 * Format: SE-XXXXXX (6 alphanumeric chars, excluding ambiguous ones)
 * Uses crypto.randomBytes for unpredictability.
 */

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1

function generateTrackId() {
  const bytes = crypto.randomBytes(6);
  let id = 'SE-';
  for (let i = 0; i < 6; i++) {
    id += CHARS[bytes[i] % CHARS.length];
  }
  return id;
}

module.exports = { generateTrackId };
