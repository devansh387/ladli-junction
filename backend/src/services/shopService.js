'use strict';

const { query } = require('../config/database');

/**
 * Shop Service — public product and category queries.
 */

/**
 * Get all products with optional filters.
 */
async function getProducts({ category, search, featured, colors } = {}) {
  let sql = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (category) {
    sql += ` AND (p.category_id = $${paramIndex} OR p.sub_category_id = $${paramIndex} OR p.categories_json @> $${paramIndex + 1}::jsonb)`;
    params.push(parseInt(category, 10), JSON.stringify([parseInt(category, 10)]));
    paramIndex += 2;
  }

  if (search) {
    sql += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR p.tags ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (featured === 'true' || featured === '1') {
    sql += ' AND p.featured = TRUE';
  }

  sql += ' ORDER BY p.stock > 0 DESC, p.created_at DESC';

  const result = await query(sql, params);
  let products = result.rows;

  // Post-query color filtering (colors stored as text)
  if (colors) {
    const colorList = colors.split(',').map((c) => c.trim().toLowerCase());
    products = products.filter((p) => {
      if (!p.colors) return false;
      const productColors = p.colors.toLowerCase();
      return colorList.some((c) => productColors.includes(c));
    });
  }

  return products;
}

/**
 * Get a single product by ID.
 */
async function getProductById(id) {
  const result = await query(
    `SELECT p.*, c.name as category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get featured/best-selling products.
 */
async function getFeaturedProducts() {
  const result = await query(`
    SELECT p.*, c.name as category_name, COALESCE(SUM(oi.quantity), 0)::integer as total_sold
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN order_items oi ON oi.product_id = p.id
    GROUP BY p.id, c.name
    ORDER BY total_sold DESC, p.featured DESC
    LIMIT 15
  `);
  return result.rows;
}

/**
 * Get all categories.
 */
async function getCategories() {
  const result = await query('SELECT * FROM categories ORDER BY name');
  return result.rows;
}

module.exports = { getProducts, getProductById, getFeaturedProducts, getCategories };
