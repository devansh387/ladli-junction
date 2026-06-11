'use strict';

const { z } = require('zod');

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()).optional(),
  address: z.string().max(500).trim().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

module.exports = { updateProfileSchema, changePasswordSchema };
