const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'shop.db');

let db = null;

// Save database to disk
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Initialize database
async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      parent_id INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      original_price REAL,
      category_id INTEGER,
      sub_category_id INTEGER,
      image_url TEXT,
      images TEXT,
      colors TEXT,
      tags TEXT,
      stock INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (sub_category_id) REFERENCES categories(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      customer_email TEXT,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      password TEXT NOT NULL,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add user_id column to orders if missing
  try { db.run("ALTER TABLE orders ADD COLUMN user_id INTEGER"); } catch (e) {}

  // Add new product columns if missing
  try { db.run("ALTER TABLE products ADD COLUMN sub_category_id INTEGER"); } catch (e) {}
  try { db.run("ALTER TABLE products ADD COLUMN images TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE products ADD COLUMN colors TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE products ADD COLUMN tags TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE products ADD COLUMN color_variants TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE products ADD COLUMN categories_json TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE categories ADD COLUMN parent_id INTEGER"); } catch (e) {}

  // Add track_id column if missing (for existing databases)
  try {
    db.run("ALTER TABLE orders ADD COLUMN track_id TEXT");
  } catch (e) {
    // Column already exists, ignore
  }

  // Fill in missing track_ids for existing orders
  const existingOrders = queryAll("SELECT id FROM orders WHERE track_id IS NULL OR track_id = ''");
  for (const order of existingOrders) {
    const trackId = generateTrackId();
    db.run("UPDATE orders SET track_id = ? WHERE id = ?", [trackId, order.id]);
  }

  // Insert default admin if not exists
  const adminCheck = db.exec("SELECT id FROM admin WHERE username = 'admin'");
  if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run("INSERT INTO admin (username, password) VALUES (?, ?)", ['admin', hashedPassword]);
  }

  // Insert default categories if not exists
  const catCount = db.exec("SELECT COUNT(*) as count FROM categories");
  if (catCount[0].values[0][0] === 0) {
    db.run("INSERT INTO categories (name, description) VALUES (?, ?)", ['Silk Sarees', 'Premium silk sarees for special occasions']);
    db.run("INSERT INTO categories (name, description) VALUES (?, ?)", ['Cotton Sarees', 'Comfortable cotton sarees for daily wear']);
    db.run("INSERT INTO categories (name, description) VALUES (?, ?)", ['Designer Sarees', 'Exclusive designer collection']);
    db.run("INSERT INTO categories (name, description) VALUES (?, ?)", ['Wedding Sarees', 'Bridal and wedding collection']);
    db.run("INSERT INTO categories (name, description) VALUES (?, ?)", ['Casual Sarees', 'Everyday casual wear sarees']);
  }

  saveDb();
  console.log('✅ Database initialized');
  return db;
}

// Generate unique track ID (e.g., "SE-7A3K9X")
function generateTrackId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  let id = 'SE-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// ===== SAFE QUERY HELPERS using db.exec with params =====
// These avoid the prepare/bind bug by using exec() which returns results directly

function queryAll(sql, params = []) {
  let results;
  try {
    results = db.exec(sql, params);
  } catch (e) {
    return [];
  }
  if (!results || results.length === 0) return [];

  const columns = results[0].columns;
  const rows = results[0].values;
  return rows.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec("SELECT last_insert_rowid() as id");
  const id = lastId.length > 0 ? lastId[0].values[0][0] : 0;
  saveDb();
  return { lastInsertRowid: id };
}

function exec(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function getScalar(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return result[0].values[0][0];
}

// Export with new names (keeping old aliases for compatibility)
module.exports = {
  initDb,
  getAll: queryAll,
  getOne: queryOne,
  run,
  exec,
  getScalar,
  saveDb,
  generateTrackId
};
