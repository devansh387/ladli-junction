const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const { initDb } = require('./database/db');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: 'saree-shop-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/my-orders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'my-orders.html'));
});

app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account.html'));
});

// Start server after DB is ready
async function start() {
  await initDb();

  // Routes (loaded after DB init)
  const adminRoutes = require('./routes/admin');
  const shopRoutes = require('./routes/shop');
  const orderRoutes = require('./routes/order');
  const userRoutes = require('./routes/user');
  const billRoutes = require('./routes/bill');

  app.use('/api/admin', adminRoutes);
  app.use('/api/shop', shopRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/bill', billRoutes);

  app.listen(PORT, () => {
    console.log(`\n🛍️  Ladli Junction is running at http://localhost:${PORT}`);
    console.log(`📋 Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`\n   Default Admin Login:`);
    console.log(`   Username: admin`);
    console.log(`   Password: admin123\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
