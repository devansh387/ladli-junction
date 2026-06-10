const express = require('express');
const router = express.Router();
const { getAll, getOne } = require('../database/db');

// Get all products (public)
router.get('/products', (req, res) => {
  const { category, search, featured, colors } = req.query;
  let query = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (category) {
    query += ' AND (p.category_id = ? OR p.sub_category_id = ? OR p.categories_json LIKE ?)';
    params.push(Number(category), Number(category), `%${category}%`);
  }
  if (search) {
    query += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (featured) {
    query += ' AND p.featured = 1';
  }

  query += ' ORDER BY p.stock > 0 DESC, p.created_at DESC';

  let products = getAll(query, params);

  // Color filtering (post-query since colors is stored as text)
  if (colors) {
    const colorList = colors.split(',').map(c => c.trim().toLowerCase());
    products = products.filter(p => {
      if (!p.colors) return false;
      const productColors = p.colors.toLowerCase();
      return colorList.some(c => productColors.includes(c));
    });
  }

  res.json(products);
});

// Get single product
router.get('/products/:id', (req, res) => {
  const product = getOne(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `, [Number(req.params.id)]);

  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Get categories (public)
router.get('/categories', (req, res) => {
  const categories = getAll('SELECT * FROM categories ORDER BY name');
  res.json(categories);
});

// Get best selling products (most ordered)
router.get('/featured', (req, res) => {
  const products = getAll(`
    SELECT p.*, c.name as category_name, COALESCE(SUM(oi.quantity), 0) as total_sold
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN order_items oi ON oi.product_id = p.id
    GROUP BY p.id
    ORDER BY total_sold DESC, p.featured DESC
    LIMIT 15
  `);
  res.json(products);
});

module.exports = router;
