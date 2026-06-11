'use strict';

/**
 * Request validation middleware factory.
 * Takes a Zod schema and validates req.body against it.
 * Throws a structured error if validation fails.
 */

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // Create a proper error object (ZodError has read-only message)
      const err = new Error('Validation failed');
      err.name = 'ZodError';
      err.statusCode = 422;
      err.errors = result.error.errors;
      return next(err);
    }
    // Replace body with parsed (and coerced) data
    req.body = result.data;
    next();
  };
}

/**
 * Validate query parameters.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const err = new Error('Invalid query parameters');
      err.name = 'ZodError';
      err.statusCode = 422;
      err.errors = result.error.errors;
      return next(err);
    }
    req.query = result.data;
    next();
  };
}

/**
 * Validate route parameters.
 */
function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const err = new Error('Invalid route parameters');
      err.name = 'ZodError';
      err.statusCode = 422;
      err.errors = result.error.errors;
      return next(err);
    }
    req.params = result.data;
    next();
  };
}

module.exports = { validate, validateQuery, validateParams };
