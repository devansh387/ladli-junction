'use strict';

/**
 * Frontend Configuration
 * Single source of truth for API base URL and other settings.
 * Change API_BASE when deploying to production.
 */

const CONFIG = Object.freeze({
  // Backend API base URL (no trailing slash)
  API_BASE: window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://ladli-junction.onrender.com', // Your Render URL

  // Token storage key
  ACCESS_TOKEN_KEY: '__lj_at',

  // Cart storage key
  CART_KEY: 'ladli_cart',

  // Phone storage key (for convenience)
  PHONE_KEY: 'ladli_customer_phone',
});
