'use strict';

const { Router } = require('express');
const orderController = require('../controllers/orderController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { orderLimiter } = require('../middleware/rateLimiter');
const { placeOrderSchema, updateOrderSchema } = require('../schemas/orderSchemas');

const router = Router();

/**
 * Order Routes — /api/orders/*
 */

// Place order (requires auth)
router.post('/place', authenticate, orderLimiter, validate(placeOrderSchema), orderController.placeOrder);

// Track order (public)
router.get('/track/:trackId', orderController.trackOrder);

// Get orders by phone (public — used on my-orders page)
router.get('/my-orders/:phone', orderController.getMyOrders);

// Get orders for authenticated user
router.get('/user-orders', authenticate, orderController.getUserOrders);

// Update order details (requires auth)
router.put('/update/:trackId', authenticate, validate(updateOrderSchema), orderController.updateOrder);

// Cancel order (requires auth)
router.put('/cancel/:trackId', authenticate, orderController.cancelOrder);

module.exports = router;
