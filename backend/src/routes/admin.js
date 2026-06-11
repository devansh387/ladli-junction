'use strict';

const { Router } = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const config = require('../config');

const router = Router();

// ── File upload config (memory storage — files go to Supabase, not disk) ─────
const memoryStorage = multer.memoryStorage();

const imageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: config.uploads.maxFileSizeMB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files (jpeg, png, webp, gif) are allowed.'));
  },
});

const heroUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|mp4|webm|mov/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (ext) return cb(null, true);
    cb(new Error('Only image/video files are allowed.'));
  },
});

/**
 * Admin Routes — /api/admin/*
 * All require authentication + admin role.
 */
router.use(authenticate, requireAdmin);

// Dashboard stats
router.get('/stats', adminController.getStats);

// Products CRUD
router.get('/products', adminController.getProducts);
router.post('/products', imageUpload.array('images', 25), adminController.createProduct);
router.put('/products/:id', imageUpload.array('images', 25), adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Categories
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Orders
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderById);
router.put('/orders/:id/status', adminController.updateOrderStatus);

// Settings
router.post('/change-password', adminController.changePassword);

// Hero media
router.get('/hero-config', adminController.getHeroConfig);
router.post('/hero-media', heroUpload.array('heroFiles', 10), adminController.uploadHeroMedia);

module.exports = router;
