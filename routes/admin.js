const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { getAll, getOne, run, exec, getScalar } = require('../database/db');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for file uploads (multiple files)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// Auth middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please login.' });
}

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const admin = getOne('SELECT * FROM admin WHERE username = ?', [username]);

  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.isAdmin = true;
  req.session.adminId = admin.id;
  res.json({ success: true, message: 'Login successful' });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check auth status
router.get('/status', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// Change password
router.post('/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = getOne('SELECT * FROM admin WHERE id = ?', [req.session.adminId]);

  if (!bcrypt.compareSync(currentPassword, admin.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const hashed = bcrypt.hashSync(newPassword, 10);
  run('UPDATE admin SET password = ? WHERE id = ?', [hashed, admin.id]);
  res.json({ success: true, message: 'Password changed successfully' });
});

// Add product
router.post('/products', requireAdmin, (req, res) => {
  upload.array('images', 25)(req, res, function(err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 20MB per image.' });
      return res.status(400).json({ error: err.message });
    }
    try {
      const { name, description, price, original_price, category_id, sub_category_id, stock, featured, colors, tags, color_variants_meta } = req.body;

      if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
      if (!price || Number(price) <= 0) return res.status(400).json({ error: 'Valid price is required' });

      // Build color_variants from meta + uploaded files
      let colorVariants = [];
      let allImages = [];
      let fileIndex = 0;

      if (color_variants_meta) {
        const meta = JSON.parse(color_variants_meta);
        for (const variant of meta) {
          const variantImages = [...(variant.existingImages || [])];
          // Assign uploaded files to this variant
          for (let i = 0; i < (variant.fileCount || 0); i++) {
            if (req.files && req.files[fileIndex]) {
              variantImages.push('/uploads/' + req.files[fileIndex].filename);
              fileIndex++;
            }
          }
          colorVariants.push({ name: variant.name, hex: variant.hex, images: variantImages });
          allImages.push(...variantImages);
        }
      }

      // If no variants but files uploaded, just store as plain images
      if (colorVariants.length === 0 && req.files && req.files.length > 0) {
        allImages = req.files.map(f => '/uploads/' + f.filename);
      }

      const image_url = allImages[0] || null;

      const result = run(
        `INSERT INTO products (name, description, price, original_price, category_id, sub_category_id, image_url, images, stock, featured, colors, tags, color_variants, categories_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name.trim(), description || null, Number(price), original_price ? Number(original_price) : null, category_id || null, sub_category_id || null, image_url, JSON.stringify(allImages), Number(stock) || 0, featured ? 1 : 0, colors || null, tags || null, JSON.stringify(colorVariants), req.body.categories || '[]']
      );

      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: 'Failed to add product: ' + err.message });
    }
  });
});

// Update product
router.put('/products/:id', requireAdmin, (req, res) => {
  upload.array('images', 25)(req, res, function(err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 20MB per image.' });
      return res.status(400).json({ error: err.message });
    }
    try {
      const { name, description, price, original_price, category_id, sub_category_id, stock, featured, colors, tags, color_variants_meta } = req.body;
      const product = getOne('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);

      if (!product) return res.status(404).json({ error: 'Product not found' });
      if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
      if (!price || Number(price) <= 0) return res.status(400).json({ error: 'Valid price is required' });

      let colorVariants = [];
      let allImages = [];
      let fileIndex = 0;

      if (color_variants_meta) {
        const meta = JSON.parse(color_variants_meta);
        for (const variant of meta) {
          const variantImages = [...(variant.existingImages || [])];
          for (let i = 0; i < (variant.fileCount || 0); i++) {
            if (req.files && req.files[fileIndex]) {
              variantImages.push('/uploads/' + req.files[fileIndex].filename);
              fileIndex++;
            }
          }
          colorVariants.push({ name: variant.name, hex: variant.hex, images: variantImages });
          allImages.push(...variantImages);
        }
      }

      if (colorVariants.length === 0 && req.files && req.files.length > 0) {
        allImages = req.files.map(f => '/uploads/' + f.filename);
      }

      const image_url = allImages[0] || product.image_url;

      exec(
        `UPDATE products SET name=?, description=?, price=?, original_price=?, category_id=?, sub_category_id=?, image_url=?, images=?, stock=?, featured=?, colors=?, tags=?, color_variants=?, categories_json=?
         WHERE id=?`,
        [name.trim(), description || null, Number(price), original_price ? Number(original_price) : null, category_id || null, sub_category_id || null, image_url, JSON.stringify(allImages), Number(stock) || 0, featured ? 1 : 0, colors || null, tags || null, JSON.stringify(colorVariants), req.body.categories || '[]', Number(req.params.id)]
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update product: ' + err.message });
    }
  });
});

// Delete product
router.delete('/products/:id', requireAdmin, (req, res) => {
  const product = getOne('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  // Delete image file
  if (product.image_url) {
    const imgPath = path.join(__dirname, '..', product.image_url);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  run('DELETE FROM products WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true });
});

// Get all products (admin view)
router.get('/products', requireAdmin, (req, res) => {
  const products = getAll(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.created_at DESC
  `);
  res.json(products);
});

// Categories CRUD
router.get('/categories', requireAdmin, (req, res) => {
  res.json(getAll('SELECT * FROM categories ORDER BY name'));
});

router.post('/categories', requireAdmin, (req, res) => {
  const { name, description, parent_id } = req.body;
  const result = run('INSERT INTO categories (name, description, parent_id) VALUES (?, ?, ?)', [name, description || null, parent_id || null]);
  res.json({ success: true, id: result.lastInsertRowid });
});

router.delete('/categories/:id', requireAdmin, (req, res) => {
  exec('DELETE FROM categories WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true });
});

// Orders management
router.get('/orders', requireAdmin, (req, res) => {
  const orders = getAll('SELECT * FROM orders ORDER BY created_at DESC');
  res.json(orders);
});

router.get('/orders/:id', requireAdmin, (req, res) => {
  const order = getOne('SELECT * FROM orders WHERE id = ?', [Number(req.params.id)]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = getAll(`
    SELECT oi.*, p.name as product_name, p.image_url
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `, [Number(req.params.id)]);

  res.json({ ...order, items });
});

router.put('/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  exec('UPDATE orders SET status = ? WHERE id = ?', [status, Number(req.params.id)]);
  res.json({ success: true });
});

// Upload hero media (multiple images + optional video)
router.post('/hero-media', requireAdmin, (req, res) => {
  const heroUpload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|webp|gif|mp4|webm|mov/;
      const ext = allowed.test(path.extname(file.originalname).toLowerCase());
      if (ext) return cb(null, true);
      cb(new Error('Only image/video files allowed'));
    }
  }).array('heroFiles', 10);

  heroUpload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const files = req.files.map(f => ({
      url: '/uploads/' + f.filename,
      type: ['.mp4', '.webm', '.mov'].includes(path.extname(f.originalname).toLowerCase()) ? 'video' : 'image'
    }));

    // Save hero config as JSON file
    const heroConfig = JSON.stringify(files);
    fs.writeFileSync(path.join(__dirname, '..', 'public', 'hero-config.json'), heroConfig);

    res.json({ success: true, files });
  });
});

// Get hero config
router.get('/hero-config', (req, res) => {
  const configPath = path.join(__dirname, '..', 'public', 'hero-config.json');
  if (fs.existsSync(configPath)) {
    res.json(JSON.parse(fs.readFileSync(configPath, 'utf8')));
  } else {
    res.json([]);
  }
});

// Dashboard stats
router.get('/stats', requireAdmin, (req, res) => {
  const totalProducts = getScalar('SELECT COUNT(*) FROM products') || 0;
  const totalOrders = getScalar('SELECT COUNT(*) FROM orders') || 0;
  const pendingOrders = getScalar("SELECT COUNT(*) FROM orders WHERE status = 'pending'") || 0;
  const totalRevenue = getScalar("SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'delivered'") || 0;

  res.json({ totalProducts, totalOrders, pendingOrders, totalRevenue });
});

module.exports = router;
