'use strict';

const { AppError } = require('./errorHandler');

/**
 * Admin Authorization Middleware.
 * Must be used AFTER authenticate middleware.
 * Checks that the authenticated user has role === 'admin'.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  if (req.user.role !== 'admin') {
    throw new AppError('Access denied. Admin privileges required.', 403);
  }

  next();
}

module.exports = { requireAdmin };
