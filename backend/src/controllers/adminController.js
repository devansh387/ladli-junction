'use strict';

const adminService = require('../services/adminService');
const { hashPassword, verifyPassword } = require('../utils/hash');
const { query } = require('../config/database');

/**
 * Admin Controller — dashboard, products, orders, categories, settings, hero.
 */

async function getStats(req, res, next) {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(stats);
  } catch (err) { next(err); }
}

// ─── Products ────────────────────────────────────────────────────────────────

async function getProducts(req, res, next) {
  try {
    const products = await adminService.getAllProducts();
    res.json(products);
  } catch (err) { next(err); }
}

async function createProduct(req, res, next) {
  try {
    const result = await adminService.createProduct(req.body, req.files);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function updateProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) return res.status(400).json({ success: false, error: 'Invalid product ID' });
    const result = await adminService.updateProduct(id, req.body, req.files);
    res.json(result);
  } catch (err) { next(err); }
}

async function deleteProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) return res.status(400).json({ success: false, error: 'Invalid product ID' });
    const result = await adminService.deleteProduct(id);
    res.json(result);
  } catch (err) { next(err); }
}

// ─── Categories ──────────────────────────────────────────────────────────────

async function getCategories(req, res, next) {
  try {
    const categories = await adminService.getCategories();
    res.json(categories);
  } catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try {
    const { name, description, parent_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Category name is required.' });
    const result = await adminService.createCategory({ name: name.trim(), description, parent_id: parent_id || null });
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function deleteCategory(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) return res.status(400).json({ success: false, error: 'Invalid category ID' });
    const result = await adminService.deleteCategory(id);
    res.json(result);
  } catch (err) { next(err); }
}

// ─── Orders ──────────────────────────────────────────────────────────────────

async function getOrders(req, res, next) {
  try {
    const orders = await adminService.getAllOrders();
    res.json(orders);
  } catch (err) { next(err); }
}

async function getOrderById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) return res.status(400).json({ success: false, error: 'Invalid order ID' });
    const order = await adminService.getOrderById(id);
    res.json(order);
  } catch (err) { next(err); }
}

async function updateOrderStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (isNaN(id) || id <= 0) return res.status(400).json({ success: false, error: 'Invalid order ID' });
    if (!status) return res.status(400).json({ success: false, error: 'Status is required.' });
    const result = await adminService.updateOrderStatus(id, status);
    res.json(result);
  } catch (err) { next(err); }
}

// ─── Settings ────────────────────────────────────────────────────────────────

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Both current and new passwords are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters.' });
    }

    const user = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (user.rows.length === 0) return res.status(404).json({ success: false, error: 'User not found.' });

    const isValid = await verifyPassword(currentPassword, user.rows[0].password_hash);
    if (!isValid) return res.status(400).json({ success: false, error: 'Current password is incorrect.' });

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) { next(err); }
}

// ─── Hero Media ──────────────────────────────────────────────────────────────

async function getHeroConfig(req, res, next) {
  try {
    const config = await adminService.getHeroConfig();
    res.json(config);
  } catch (err) { next(err); }
}

async function uploadHeroMedia(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded.' });
    }

    const path = require('path');
    const files = req.files.map((f) => ({
      url: '/uploads/' + f.filename,
      type: ['.mp4', '.webm', '.mov'].includes(path.extname(f.originalname).toLowerCase()) ? 'video' : 'image',
    }));

    const result = await adminService.updateHeroConfig(files);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = {
  getStats,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  createCategory,
  deleteCategory,
  getOrders,
  getOrderById,
  updateOrderStatus,
  changePassword,
  getHeroConfig,
  uploadHeroMedia,
};
