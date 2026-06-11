'use strict';

const { query } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

/**
 * Admin Service — CRUD for products, orders, categories, stats.
 */

// ─── Stats ───────────────────────────────────────────────────────────────────

async function getDashboardStats() {
  const [products, orders, pending, revenue] = await Promise.all([
    query('SELECT COUNT(*)::integer as count FROM products'),
    query('SELECT COUNT(*)::integer as count FROM orders'),
    query("SELECT COUNT(*)::integer as count FROM orders WHERE status = 'pending'"),
    query("SELECT COALESCE(SUM(total_amount), 0)::numeric as total FROM orders WHERE status = 'delivered'"),
  ]);

  return {
    totalProducts: products.rows[0].count,
    totalOrders: orders.rows[0].count,
    pendingOrders: pending.rows[0].count,
    totalRevenue: parseFloat(revenue.rows[0].total) || 0,
  };
}

// ─── Products ────────────────────────────────────────────────────────────────

async function getAllProducts() {
  const result = await query(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.created_at DESC
  `);
  return result.rows;
}

async function createProduct(data, imageFiles) {
  const { uploadFile } = require('../config/storage');
  const crypto = require('crypto');
  const path = require('path');

  const {
    name, description, price, original_price, category_id, sub_category_id,
    stock, featured, colors, tags, color_variants_meta, categories,
  } = data;

  // Build color variants from meta + uploaded files
  let colorVariants = [];
  let allImages = [];
  let fileIndex = 0;

  if (color_variants_meta) {
    const meta = JSON.parse(color_variants_meta);
    for (const variant of meta) {
      const variantImages = [...(variant.existingImages || [])];
      for (let i = 0; i < (variant.fileCount || 0); i++) {
        if (imageFiles && imageFiles[fileIndex]) {
          const f = imageFiles[fileIndex];
          const ext = path.extname(f.originalname).toLowerCase();
          const uniqueName = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
          const url = await uploadFile(f.buffer, uniqueName, f.mimetype);
          variantImages.push(url);
          fileIndex++;
        }
      }
      colorVariants.push({ name: variant.name, hex: variant.hex, images: variantImages });
      allImages.push(...variantImages);
    }
  }

  // Fallback: if no variants but files uploaded
  if (colorVariants.length === 0 && imageFiles && imageFiles.length > 0) {
    for (const f of imageFiles) {
      const ext = path.extname(f.originalname).toLowerCase();
      const uniqueName = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
      const url = await uploadFile(f.buffer, uniqueName, f.mimetype);
      allImages.push(url);
    }
  }

  const imageUrl = allImages[0] || null;

  const result = await query(
    `INSERT INTO products (name, description, price, original_price, category_id, sub_category_id,
     image_url, images, stock, featured, colors, tags, color_variants, categories_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [
      name, description || null, price, original_price || null,
      category_id || null, sub_category_id || null,
      imageUrl, JSON.stringify(allImages), stock || 0, featured || false,
      colors || null, tags || null, JSON.stringify(colorVariants),
      categories || '[]',
    ]
  );

  return { id: result.rows[0].id, success: true };
}

async function updateProduct(id, data, imageFiles) {
  const { uploadFile } = require('../config/storage');
  const crypto = require('crypto');
  const path = require('path');

  const existing = await query('SELECT * FROM products WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new AppError('Product not found.', 404);
  }

  const product = existing.rows[0];
  const {
    name, description, price, original_price, category_id, sub_category_id,
    stock, featured, colors, tags, color_variants_meta, categories,
  } = data;

  let colorVariants = [];
  let allImages = [];
  let fileIndex = 0;

  if (color_variants_meta) {
    const meta = JSON.parse(color_variants_meta);
    for (const variant of meta) {
      const variantImages = [...(variant.existingImages || [])];
      for (let i = 0; i < (variant.fileCount || 0); i++) {
        if (imageFiles && imageFiles[fileIndex]) {
          const f = imageFiles[fileIndex];
          const ext = path.extname(f.originalname).toLowerCase();
          const uniqueName = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
          const url = await uploadFile(f.buffer, uniqueName, f.mimetype);
          variantImages.push(url);
          fileIndex++;
        }
      }
      colorVariants.push({ name: variant.name, hex: variant.hex, images: variantImages });
      allImages.push(...variantImages);
    }
  }

  if (colorVariants.length === 0 && imageFiles && imageFiles.length > 0) {
    for (const f of imageFiles) {
      const ext = path.extname(f.originalname).toLowerCase();
      const uniqueName = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
      const url = await uploadFile(f.buffer, uniqueName, f.mimetype);
      allImages.push(url);
    }
  }

  const imageUrl = allImages[0] || product.image_url;

  await query(
    `UPDATE products SET name=$1, description=$2, price=$3, original_price=$4,
     category_id=$5, sub_category_id=$6, image_url=$7, images=$8,
     stock=$9, featured=$10, colors=$11, tags=$12, color_variants=$13, categories_json=$14
     WHERE id=$15`,
    [
      name, description || null, price, original_price || null,
      category_id || null, sub_category_id || null,
      imageUrl, JSON.stringify(allImages), stock || 0, featured || false,
      colors || null, tags || null, JSON.stringify(colorVariants),
      categories || '[]', id,
    ]
  );

  return { success: true };
}

async function deleteProduct(id) {
  const result = await query('DELETE FROM products WHERE id = $1 RETURNING image_url', [id]);
  if (result.rows.length === 0) {
    throw new AppError('Product not found.', 404);
  }
  return { success: true, imageUrl: result.rows[0].image_url };
}

// ─── Categories ──────────────────────────────────────────────────────────────

async function getCategories() {
  const result = await query('SELECT * FROM categories ORDER BY name');
  return result.rows;
}

async function createCategory({ name, description, parent_id }) {
  const result = await query(
    'INSERT INTO categories (name, description, parent_id) VALUES ($1, $2, $3) RETURNING id',
    [name, description || null, parent_id || null]
  );
  return { success: true, id: result.rows[0].id };
}

async function deleteCategory(id) {
  await query('DELETE FROM categories WHERE id = $1', [id]);
  return { success: true };
}

// ─── Orders ──────────────────────────────────────────────────────────────────

async function getAllOrders() {
  const result = await query('SELECT * FROM orders ORDER BY created_at DESC');
  return result.rows;
}

async function getOrderById(id) {
  const order = await query('SELECT * FROM orders WHERE id = $1', [id]);
  if (order.rows.length === 0) {
    throw new AppError('Order not found.', 404);
  }

  const items = await query(
    `SELECT oi.*, p.name as product_name, p.image_url
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1`,
    [id]
  );

  return { ...order.rows[0], items: items.rows };
}

async function updateOrderStatus(id, status) {
  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new AppError('Invalid status value.', 400);
  }

  await query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
  return { success: true };
}

// ─── Hero Config ─────────────────────────────────────────────────────────────

async function getHeroConfig() {
  const result = await query('SELECT files FROM hero_config ORDER BY id LIMIT 1');
  return result.rows[0]?.files || [];
}

async function updateHeroConfig(files) {
  await query('UPDATE hero_config SET files = $1, updated_at = NOW()', [JSON.stringify(files)]);
  return { success: true, files };
}

module.exports = {
  getDashboardStats,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  createCategory,
  deleteCategory,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getHeroConfig,
  updateHeroConfig,
};
