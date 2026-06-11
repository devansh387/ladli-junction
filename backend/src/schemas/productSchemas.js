'use strict';

const { z } = require('zod');

const productSchema = z.object({
  name: z.string().min(2, 'Name required').max(200).trim(),
  description: z.string().max(2000).trim().optional().default(''),
  price: z.coerce.number().positive('Price must be positive'),
  original_price: z.coerce.number().positive().optional().nullable(),
  category_id: z.coerce.number().int().positive().optional().nullable(),
  sub_category_id: z.coerce.number().int().positive().optional().nullable(),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative').default(0),
  featured: z.union([z.boolean(), z.string().transform((v) => v === '1' || v === 'true')]).default(false),
  colors: z.string().max(1000).optional().default(''),
  tags: z.string().max(500).optional().default(''),
  color_variants_meta: z.string().optional().default('[]'),
  categories: z.string().optional().default('[]'),
});

const categorySchema = z.object({
  name: z.string().min(2, 'Name required').max(100).trim(),
  description: z.string().max(500).trim().optional().default(''),
  parent_id: z.coerce.number().int().positive().optional().nullable(),
});

module.exports = { productSchema, categorySchema };
