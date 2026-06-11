'use strict';

const { Router } = require('express');
const shopController = require('../controllers/shopController');

const router = Router();

/**
 * Shop Routes — /api/shop/*
 * All public (no authentication required).
 */

router.get('/products', shopController.getProducts);
router.get('/products/:id', shopController.getProductById);
router.get('/categories', shopController.getCategories);
router.get('/featured', shopController.getFeatured);

module.exports = router;
