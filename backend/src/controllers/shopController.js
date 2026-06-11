'use strict';

const shopService = require('../services/shopService');

/**
 * Shop Controller — public product/category endpoints.
 */

async function getProducts(req, res, next) {
  try {
    const { category, search, featured, colors } = req.query;
    const products = await shopService.getProducts({ category, search, featured, colors });
    res.json(products);
  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }
    const product = await shopService.getProductById(id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
}

async function getFeatured(req, res, next) {
  try {
    const products = await shopService.getFeaturedProducts();
    res.json(products);
  } catch (err) {
    next(err);
  }
}

async function getCategories(req, res, next) {
  try {
    const categories = await shopService.getCategories();
    res.json(categories);
  } catch (err) {
    next(err);
  }
}

module.exports = { getProducts, getProductById, getFeatured, getCategories };
