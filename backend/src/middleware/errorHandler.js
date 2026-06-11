'use strict';

const config = require('../config');

/**
 * Global error handler middleware.
 * Catches all errors, returns safe JSON response.
 * Never leaks stack traces or internal details in production.
 */

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

function errorHandler(err, req, res, _next) {
  // Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Zod validation errors
  if (err.name === 'ZodError') {
    statusCode = 422;
    message = 'Validation failed';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    statusCode = 409;
    message = 'A record with this value already exists';
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    statusCode = 400;
    message = 'Referenced record does not exist';
  }

  // Log server errors (not client errors)
  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    if (!config.isProduction) {
      console.error(err.stack);
    }
    // Never expose internal error messages in production
    message = config.isProduction ? 'Internal server error' : message;
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(details && { details }),
    ...((!config.isProduction && statusCode >= 500) && { stack: err.stack }),
  });
}

/**
 * 404 handler — catches unmatched routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
}

module.exports = { AppError, errorHandler, notFoundHandler };
