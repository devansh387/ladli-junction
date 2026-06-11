'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { updateProfileSchema } = require('../schemas/userSchemas');
const { query } = require('../config/database');

const router = Router();

/**
 * User Routes — /api/user/*
 * All require authentication.
 */
router.use(authenticate);

// Get current user profile
router.get('/me', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, email, phone, address, role, is_email_verified, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { next(err); }
});

// Update profile
router.put('/profile', validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { name, email, address } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (name) { fields.push(`name = $${idx++}`); values.push(name); }
    if (email) { fields.push(`email = $${idx++}`); values.push(email); }
    if (address !== undefined) { fields.push(`address = $${idx++}`); values.push(address || null); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update.' });
    }

    values.push(req.user.id);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    res.json({ success: true, message: 'Profile updated.' });
  } catch (err) { next(err); }
});

module.exports = router;
