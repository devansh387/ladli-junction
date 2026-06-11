'use strict';

const { query, transaction } = require('../config/database');
const { generateTrackId } = require('../utils/trackId');
const { AppError } = require('../middleware/errorHandler');
const emailService = require('./emailService');

/**
 * Order Service — place, track, update, cancel orders.
 */

/**
 * Place a new order.
 * Validates stock, calculates total, creates order + items, decrements stock.
 * All done in a single transaction for atomicity.
 */
async function placeOrder({ customer_name, customer_phone, customer_address, customer_email, notes, items }, userId) {
  return transaction(async (client) => {
    let totalAmount = 0;
    const productDetails = [];

    // Validate each item's stock (with row lock to prevent race conditions)
    for (const item of items) {
      const result = await client.query(
        'SELECT id, name, price, stock, image_url FROM products WHERE id = $1 FOR UPDATE',
        [item.product_id]
      );

      if (result.rows.length === 0) {
        throw new AppError(`Product with ID ${item.product_id} not found.`, 400);
      }

      const product = result.rows[0];

      if (product.stock <= 0) {
        throw new AppError(`"${product.name}" is out of stock.`, 400);
      }

      if (product.stock < item.quantity) {
        throw new AppError(`"${product.name}" only has ${product.stock} left in stock.`, 400);
      }

      totalAmount += parseFloat(product.price) * item.quantity;
      productDetails.push({
        product_id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        quantity: item.quantity,
        image_url: product.image_url,
      });
    }

    // Generate unique tracking ID (retry if collision)
    let trackId;
    let attempts = 0;
    do {
      trackId = generateTrackId();
      const exists = await client.query('SELECT id FROM orders WHERE track_id = $1', [trackId]);
      if (exists.rows.length === 0) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new AppError('Failed to generate unique tracking ID. Please try again.', 500);
    }

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (track_id, user_id, customer_name, customer_phone, customer_address, customer_email, total_amount, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', $8)
       RETURNING id, track_id, total_amount, status, created_at`,
      [trackId, userId || null, customer_name, customer_phone, customer_address, customer_email || null, totalAmount, notes || null]
    );

    const order = orderResult.rows[0];

    // Insert order items + decrement stock
    for (const item of productDetails) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [order.id, item.product_id, item.quantity, item.price]
      );
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Send notification email (fire-and-forget, outside transaction)
    setImmediate(() => {
      emailService.sendOrderNotification({
        track_id: trackId,
        customer_name,
        customer_phone,
        customer_address,
        customer_email: customer_email || null,
        total_amount: totalAmount,
        notes: notes || null,
        items: productDetails,
      }).catch((err) => console.error('[EMAIL] Order notification failed:', err.message));
    });

    return {
      id: order.id,
      track_id: trackId,
      customer_name,
      customer_phone,
      customer_address,
      customer_email: customer_email || null,
      total_amount: totalAmount,
      status: 'confirmed',
      items: productDetails,
      created_at: order.created_at,
    };
  });
}

/**
 * Track an order by tracking ID.
 */
async function trackOrder(trackId) {
  const normalized = trackId.trim().toUpperCase();

  let result = await query('SELECT * FROM orders WHERE track_id = $1', [normalized]);

  // Fallback: try numeric ID
  if (result.rows.length === 0) {
    const numId = parseInt(normalized, 10);
    if (!isNaN(numId) && numId > 0) {
      result = await query('SELECT * FROM orders WHERE id = $1', [numId]);
    }
  }

  if (result.rows.length === 0) {
    throw new AppError(`No order found for "${trackId}". Please check and try again.`, 404);
  }

  const order = result.rows[0];

  // Get order items
  const itemsResult = await query(
    `SELECT oi.quantity, oi.price, p.name as product_name, p.image_url, p.original_price
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1`,
    [order.id]
  );

  return { ...order, items: itemsResult.rows };
}

/**
 * Get all orders for a phone number.
 */
async function getOrdersByPhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const orders = await query(
    'SELECT * FROM orders WHERE customer_phone = $1 ORDER BY created_at DESC',
    [cleaned]
  );

  const ordersWithItems = [];
  for (const order of orders.rows) {
    const items = await query(
      `SELECT oi.quantity, oi.price, p.name as product_name, p.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    );
    ordersWithItems.push({ ...order, items: items.rows });
  }

  return ordersWithItems;
}

/**
 * Get orders for a specific user (by user_id or phone).
 */
async function getOrdersByUser(userId, phone) {
  const orders = await query(
    'SELECT * FROM orders WHERE user_id = $1 OR customer_phone = $2 ORDER BY created_at DESC',
    [userId, phone]
  );

  const ordersWithItems = [];
  for (const order of orders.rows) {
    const items = await query(
      `SELECT oi.quantity, oi.price, p.name as product_name, p.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    );
    ordersWithItems.push({ ...order, items: items.rows });
  }

  return ordersWithItems;
}

/**
 * Update order delivery details (only if not shipped/delivered).
 * Verifies ownership by phone number match (IDOR prevention).
 */
async function updateOrder(trackId, updates, requestorPhone) {
  const normalized = trackId.trim().toUpperCase();

  let result = await query('SELECT * FROM orders WHERE track_id = $1', [normalized]);
  if (result.rows.length === 0) {
    const numId = parseInt(normalized, 10);
    if (!isNaN(numId) && numId > 0) {
      result = await query('SELECT * FROM orders WHERE id = $1', [numId]);
    }
  }

  if (result.rows.length === 0) {
    throw new AppError('Order not found.', 404);
  }

  const order = result.rows[0];

  // IDOR prevention: verify requestor owns this order
  if (requestorPhone && order.customer_phone !== requestorPhone) {
    throw new AppError('Access denied. You can only edit your own orders.', 403);
  }

  if (order.status === 'shipped' || order.status === 'delivered') {
    throw new AppError('Cannot edit an order that is already shipped or delivered.', 400);
  }

  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.customer_name) { fields.push(`customer_name = $${idx++}`); values.push(updates.customer_name); }
  if (updates.customer_phone) { fields.push(`customer_phone = $${idx++}`); values.push(updates.customer_phone); }
  if (updates.customer_address) { fields.push(`customer_address = $${idx++}`); values.push(updates.customer_address); }
  if (updates.customer_email !== undefined) { fields.push(`customer_email = $${idx++}`); values.push(updates.customer_email || null); }

  if (fields.length === 0) {
    throw new AppError('No fields to update.', 400);
  }

  values.push(order.id);
  await query(`UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx}`, values);

  return { success: true, message: 'Order details updated successfully.' };
}

/**
 * Cancel an order (only if not shipped/delivered). Restores stock.
 */
async function cancelOrder(trackId, requestorPhone) {
  const normalized = trackId.trim().toUpperCase();

  let result = await query('SELECT * FROM orders WHERE track_id = $1', [normalized]);
  if (result.rows.length === 0) {
    throw new AppError('Order not found.', 404);
  }

  const order = result.rows[0];

  // IDOR prevention
  if (requestorPhone && order.customer_phone !== requestorPhone) {
    throw new AppError('Access denied. You can only cancel your own orders.', 403);
  }

  if (order.status === 'shipped' || order.status === 'delivered') {
    throw new AppError('Cannot cancel an order that is already shipped or delivered.', 400);
  }
  if (order.status === 'cancelled') {
    throw new AppError('Order is already cancelled.', 400);
  }

  return transaction(async (client) => {
    await client.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [order.id]);

    // Restore stock
    const items = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [order.id]);
    for (const item of items.rows) {
      await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity, item.product_id]);
    }

    return { success: true, message: 'Order cancelled successfully.' };
  });
}

module.exports = {
  placeOrder,
  trackOrder,
  getOrdersByPhone,
  getOrdersByUser,
  updateOrder,
  cancelOrder,
};
