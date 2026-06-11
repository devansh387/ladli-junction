'use strict';

const { Pool } = require('pg');
const config = require('./index');

/**
 * PostgreSQL connection pool.
 * Uses Supabase connection pooler (port 6543) with SSL.
 * Pool settings tuned for production on Render (limited connections).
 */
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Log pool errors (never crash the process)
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterized query.
 * @param {string} text - SQL query with $1, $2, ... placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (!config.isProduction && duration > 500) {
      console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 100));
    }
    return result;
  } catch (err) {
    console.error('[DB] Query error:', err.message);
    console.error('[DB] Query:', text.substring(0, 200));
    throw err;
  }
}

/**
 * Get a client from the pool for transactions.
 * Always release the client in a finally block.
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Execute multiple statements in a transaction.
 * @param {Function} callback - async (client) => { ... }
 */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Health check — verify DB connectivity.
 */
async function healthCheck() {
  try {
    const res = await pool.query('SELECT NOW()');
    return { ok: true, timestamp: res.rows[0].now };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { pool, query, getClient, transaction, healthCheck };
