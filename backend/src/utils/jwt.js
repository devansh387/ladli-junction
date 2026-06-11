'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT utility — creates and verifies access + refresh tokens.
 * Access tokens carry user_id, role, email in payload.
 * Refresh tokens carry only user_id and a jti (unique session ID).
 */

/**
 * Create a short-lived access token.
 * @param {{ userId: string, role: string, email: string }} payload
 * @returns {string}
 */
function createAccessToken({ userId, role, email }) {
  return jwt.sign(
    { sub: userId, role, email, type: 'access' },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiry, algorithm: 'HS256' }
  );
}

/**
 * Create a long-lived refresh token.
 * @param {{ userId: string, sessionId: string }} payload
 * @returns {string}
 */
function createRefreshToken({ userId, sessionId }) {
  return jwt.sign(
    { sub: userId, jti: sessionId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: `${config.jwt.refreshExpiryDays}d`, algorithm: 'HS256' }
  );
}

/**
 * Verify and decode an access token.
 * @param {string} token
 * @returns {{ sub: string, role: string, email: string, type: string }}
 * @throws {Error}
 */
function verifyAccessToken(token) {
  const payload = jwt.verify(token, config.jwt.accessSecret, { algorithms: ['HS256'] });
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload;
}

/**
 * Verify and decode a refresh token.
 * @param {string} token
 * @returns {{ sub: string, jti: string, type: string }}
 * @throws {Error}
 */
function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwt.refreshSecret, { algorithms: ['HS256'] });
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload;
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
