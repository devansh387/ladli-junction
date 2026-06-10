const express = require('express');
const router = express.Router();
const { getAll, getOne, run, exec, getScalar, generateTrackId } = require('../database/db');
const { sendOrderNotification } = require('../services/email');

// Place order (public)
router.post('/place', (req, res) => {
  try {
    const { customer_name, customer_phone, customer_address, customer_email, notes, items } = req.body;

    // Validation
    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ error: 'Please enter your full name' });
    }
    if (!customer_phone || !customer_phone.trim()) {
      return res.status(400).json({ error: 'Please enter your phone number' });
    }
    const cleanPhone = customer_phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^(\+91|91|0)?[6-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit Indian phone number (starting with 6-9)' });
    }
    if (!customer_address || !customer_address.trim()) {
      return res.status(400).json({ error: 'Please enter your delivery address' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty. Please add items before ordering.' });
    }

    // Calculate total and validate stock
    let total_amount = 0;
    const productDetails = [];

    for (const item of items) {
      const product = getOne('SELECT * FROM products WHERE id = ?', [Number(item.product_id)]);
      if (!product) return res.status(400).json({ error: 'Product not found' });
      if (product.stock <= 0) {
        return res.status(400).json({ error: `Sorry, "${product.name}" is out of stock` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Sorry, "${product.name}" only has ${product.stock} left in stock` });
      }
      total_amount += product.price * item.quantity;
      productDetails.push({ product_id: item.product_id, quantity: item.quantity, price: product.price, name: product.name, image_url: product.image_url });
    }

    // Generate unique tracking ID
    const trackId = generateTrackId();

    // Create order — status is "confirmed" directly (no approval needed)
    const userId = req.session.userId || null;
    const orderResult = run(
      `INSERT INTO orders (track_id, customer_name, customer_phone, customer_address, customer_email, total_amount, status, notes, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [trackId, customer_name.trim(), cleanPhone, customer_address.trim(), customer_email ? customer_email.trim() : null, total_amount, 'confirmed', notes ? notes.trim() : null, userId]
    );

    const orderId = orderResult.lastInsertRowid;

    // Insert order items and reduce stock
    for (const item of productDetails) {
      exec('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, Number(item.product_id), Number(item.quantity), item.price]);
      exec('UPDATE products SET stock = stock - ? WHERE id = ?',
        [Number(item.quantity), Number(item.product_id)]);
    }

    res.json({
      success: true,
      orderId,
      trackId,
      message: `Order placed successfully! Your tracking ID is ${trackId}`,
      orderDetails: {
        id: orderId,
        track_id: trackId,
        customer_name: customer_name.trim(),
        customer_phone: cleanPhone,
        customer_address: customer_address.trim(),
        customer_email: customer_email ? customer_email.trim() : null,
        total_amount,
        status: 'confirmed',
        items: productDetails
      }
    });

    // Send email notification to shop owner (non-blocking)
    sendOrderNotification({
      track_id: trackId,
      customer_name: customer_name.trim(),
      customer_phone: cleanPhone,
      customer_address: customer_address.trim(),
      customer_email: customer_email ? customer_email.trim() : null,
      total_amount,
      notes: notes ? notes.trim() : null,
      items: productDetails
    }).catch(err => console.error('Email error:', err));

  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Track order by track_id (public)
router.get('/track/:trackId', (req, res) => {
  const trackId = req.params.trackId.trim().toUpperCase();

  if (!trackId) {
    return res.status(400).json({ error: 'Please enter a tracking ID' });
  }

  let order = getOne('SELECT * FROM orders WHERE track_id = ?', [trackId]);

  // Also try numeric ID for backwards compatibility
  if (!order) {
    const numId = parseInt(trackId, 10);
    if (!isNaN(numId) && numId > 0) {
      order = getOne('SELECT * FROM orders WHERE id = ?', [numId]);
    }
  }

  if (!order) {
    return res.status(404).json({ error: `No order found for "${req.params.trackId}". Please check and try again.` });
  }

  const items = getAll(`
    SELECT oi.quantity, oi.price, p.name as product_name, p.image_url, p.original_price
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `, [order.id]);

  res.json({ ...order, items });
});

// Get all orders by phone number (public - "My Orders")
router.get('/my-orders/:phone', (req, res) => {
  const phone = req.params.phone.replace(/[\s\-\(\)]/g, '');
  const orders = getAll('SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC', [phone]);

  const ordersWithItems = orders.map(order => {
    const items = getAll(`
      SELECT oi.quantity, oi.price, p.name as product_name, p.image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [order.id]);
    return { ...order, items };
  });

  res.json(ordersWithItems);
});

// Update order details (public - only if not shipped/delivered)
router.put('/update/:trackId', (req, res) => {
  try {
    const { customer_name, customer_phone, customer_address, customer_email } = req.body;
    const trackId = req.params.trackId.trim().toUpperCase();

    let order = getOne('SELECT * FROM orders WHERE track_id = ?', [trackId]);
    if (!order) {
      const numId = parseInt(trackId, 10);
      if (!isNaN(numId) && numId > 0) {
        order = getOne('SELECT * FROM orders WHERE id = ?', [numId]);
      }
    }

    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'shipped' || order.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot edit order that is already shipped or delivered' });
    }

    if (customer_phone) {
      const cleanPhone = customer_phone.replace(/[\s\-\(\)]/g, '');
      const phoneRegex = /^(\+91|91|0)?[6-9]\d{9}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit phone number' });
      }
    }

    exec(
      `UPDATE orders SET customer_name = ?, customer_phone = ?, customer_address = ?, customer_email = ? WHERE id = ?`,
      [
        (customer_name || order.customer_name).trim(),
        (customer_phone || order.customer_phone).replace(/[\s\-\(\)]/g, ''),
        (customer_address || order.customer_address).trim(),
        customer_email !== undefined ? (customer_email || '').trim() || null : order.customer_email,
        order.id
      ]
    );

    res.json({ success: true, message: 'Order details updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Cancel order (public - only if not shipped/delivered)
router.put('/cancel/:trackId', (req, res) => {
  try {
    const trackId = req.params.trackId.trim().toUpperCase();

    let order = getOne('SELECT * FROM orders WHERE track_id = ?', [trackId]);
    if (!order) {
      const numId = parseInt(trackId, 10);
      if (!isNaN(numId) && numId > 0) {
        order = getOne('SELECT * FROM orders WHERE id = ?', [numId]);
      }
    }

    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'shipped' || order.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot cancel order that is already shipped or delivered' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Order is already cancelled' });
    }

    // Cancel and restore stock
    exec('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', order.id]);

    const items = getAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    for (const item of items) {
      exec('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

module.exports = router;
