'use strict';

const { z } = require('zod');

const PHONE_REGEX = /^(\+91|91|0)?[6-9]\d{9}$/;

const placeOrderSchema = z.object({
  customer_name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100)
    .trim(),
  customer_phone: z.string()
    .regex(PHONE_REGEX, 'Invalid Indian phone number')
    .transform((v) => v.replace(/[\s\-\(\)]/g, '')),
  customer_address: z.string()
    .min(5, 'Address must be at least 5 characters')
    .max(500)
    .trim(),
  customer_email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()).optional().or(z.literal('')),
  notes: z.string().max(500).trim().optional().default(''),
  items: z.array(z.object({
    product_id: z.number().int().positive('Invalid product ID'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Maximum 100 per item'),
  })).min(1, 'At least one item is required').max(50, 'Maximum 50 items per order'),
});

const updateOrderSchema = z.object({
  customer_name: z.string().min(2).max(100).trim().optional(),
  customer_phone: z.string().regex(PHONE_REGEX, 'Invalid phone').transform((v) => v.replace(/[\s\-\(\)]/g, '')).optional(),
  customer_address: z.string().min(5).max(500).trim().optional(),
  customer_email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()).optional().or(z.literal('')),
});

module.exports = { placeOrderSchema, updateOrderSchema };
