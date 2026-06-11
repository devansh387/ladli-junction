'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { AppError } = require('./errorHandler');

/**
 * JWT Authentication Middleware.
 * Extracts Bearer token from Authorization header, verifies it,
 * and attaches the decoded user to req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401);
  }

  const token = authHeader.substring(7);
  if (!token) {
    throw new AppError('Authentication required', 401);
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Token expired. Please refresh your session.', 401);
    }
    throw new AppError('Invalid authentication token', 401);
  }
}

/**
 * Optional authentication — attaches user if token is present, but doesn't fail.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { authenticate, optionalAuth };
