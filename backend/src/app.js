'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shop');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const billRoutes = require('./routes/bill');

const app = express();

// ─── Security Middleware ─────────────────────────────────────────────────────

// Helmet: sets security headers (CSP, X-Content-Type-Options, HSTS, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // disabled for uploaded images
}));

// CORS: only allow frontend origin
app.use(cors({
  origin: config.isProduction
    ? [config.frontendUrl]
    : [config.frontendUrl, 'http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ────────────────────────────────────────────────────────────

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// ─── Rate Limiting (global) ──────────────────────────────────────────────────

app.use(generalLimiter);

// ─── Trust proxy (for Render / reverse proxy) ────────────────────────────────

app.set('trust proxy', 1);

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    name: 'Ladli Junction API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/health',
  });
});

app.get('/api/health', async (req, res) => {
  const { healthCheck } = require('./config/database');
  const db = await healthCheck();
  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: db.ok ? 'connected' : db.error,
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bill', billRoutes);

// ─── Hero config (public endpoint) ──────────────────────────────────────────

app.get('/api/hero-config', async (req, res, next) => {
  try {
    const { query } = require('./config/database');
    const result = await query('SELECT files FROM hero_config ORDER BY id LIMIT 1');
    res.json(result.rows[0]?.files || []);
  } catch (err) { next(err); }
});

// ─── Error Handling ──────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
