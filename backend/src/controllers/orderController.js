'use strict';

const orderService = require('../services/orderService');

/**
 * Order Controller — order placement, tracking, updates.
 */

async function placeOrder(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const order = await orderService.placeOrder(req.body, userId);

    res.status(201).json({
      success: true,
      trackId: order.track_id,
      message: `Order placed successfully! Your tracking ID is ${order.track_id}`,
      orderDetails: order,
    });
  } catch (err) {
    next(err);
  }
}

async function trackOrder(req, res, next) {
  try {
    const trackId = req.params.trackId;
    if (!trackId || !trackId.trim()) {
      return res.status(400).json({ success: false, error: 'Tracking ID is required.' });
    }
    const order = await orderService.trackOrder(trackId);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

async function getMyOrders(req, res, next) {
  try {
    const phone = req.params.phone;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }
    const orders = await orderService.getOrdersByPhone(phone);
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

async function getUserOrders(req, res, next) {
  try {
    const userId = req.user.id;
    // Get user phone for matching
    const { query } = require('../config/database');
    const userResult = await query('SELECT phone FROM users WHERE id = $1', [userId]);
    const phone = userResult.rows[0]?.phone || '';
    const orders = await orderService.getOrdersByUser(userId, phone);
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

async function updateOrder(req, res, next) {
  try {
    const trackId = req.params.trackId;
    // Get requestor's phone for ownership verification
    let requestorPhone = null;
    if (req.user) {
      const { query } = require('../config/database');
      const userResult = await query('SELECT phone FROM users WHERE id = $1', [req.user.id]);
      requestorPhone = userResult.rows[0]?.phone || null;
    }
    const result = await orderService.updateOrder(trackId, req.body, requestorPhone);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const trackId = req.params.trackId;
    let requestorPhone = null;
    if (req.user) {
      const { query } = require('../config/database');
      const userResult = await query('SELECT phone FROM users WHERE id = $1', [req.user.id]);
      requestorPhone = userResult.rows[0]?.phone || null;
    }
    const result = await orderService.cancelOrder(trackId, requestorPhone);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { placeOrder, trackOrder, getMyOrders, getUserOrders, updateOrder, cancelOrder };
