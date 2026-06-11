'use strict';

/**
 * Input sanitization utilities — prevent XSS and injection.
 * Applied to all user-provided text before storage.
 */

/**
 * Strip dangerous HTML characters from a string.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Strip null bytes and control characters (except newline, tab).
 * @param {string} str
 * @returns {string}
 */
function stripControlChars(str) {
  if (!str || typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitize user input — trim, strip control chars, limit length.
 * Does NOT escape HTML (that's for output rendering).
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function sanitizeInput(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return '';
  return stripControlChars(str).trim().substring(0, maxLength);
}

/**
 * Sanitize an email address — lowercase, trim.
 * @param {string} email
 * @returns {string}
 */
function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.toLowerCase().trim().substring(0, 255);
}

/**
 * Sanitize phone number — strip spaces, dashes, parens.
 * @param {string} phone
 * @returns {string}
 */
function sanitizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[\s\-\(\)]/g, '').substring(0, 15);
}

module.exports = {
  escapeHtml,
  stripControlChars,
  sanitizeInput,
  sanitizeEmail,
  sanitizePhone,
};
