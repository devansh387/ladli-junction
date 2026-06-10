const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { getAll, getOne, run, exec } = require('../database/db');
const config = require('../config');

// Store OTPs temporarily in memory (expires after 5 min)
const otpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTP(email, otp) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.GMAIL_USER, pass: config.GMAIL_APP_PASSWORD }
  });

  await transporter.sendMail({
    from: `"Ladlee Sarees" <${config.GMAIL_USER}>`,
    to: email,
    subject: `Your OTP: ${otp} — Ladlee Sarees Verification`,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:400px;margin:0 auto;background:#f9f5ff;padding:20px;">
        <div style="background:#5D0F33;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h2 style="margin:0;">🪷 Email Verification</h2>
        </div>
        <div style="background:white;padding:24px;border-radius:0 0 12px 12px;text-align:center;">
          <p style="color:#555;">Your OTP for Ladlee Sarees is:</p>
          <p style="font-size:2rem;font-weight:700;color:#5D0F33;letter-spacing:6px;margin:16px 0;">${otp}</p>
          <p style="font-size:0.8rem;color:#999;">Valid for 5 minutes. Do not share this with anyone.</p>
        </div>
      </div>
    `
  });
}

// Send OTP to email
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) return res.status(400).json({ error: 'Please enter your email' });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const otp = generateOTP();
    otpStore[email.trim().toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    await sendOTP(email.trim(), otp);
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    console.error('OTP send error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP. Please check your email and try again.' });
  }
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const key = (email || '').trim().toLowerCase();
  const stored = otpStore[key];

  if (!stored) return res.status(400).json({ error: 'No OTP sent to this email. Please request again.' });
  if (Date.now() > stored.expires) {
    delete otpStore[key];
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }
  if (stored.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
  }

  // OTP verified — mark in session
  delete otpStore[key];
  req.session.emailVerified = key;
  res.json({ success: true, message: 'Email verified!' });
});

// Signup (requires verified email)
router.post('/signup', (req, res) => {
  try {
    const { name, phone, email, password, address } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Please enter your name' });
    if (!email || !email.trim()) return res.status(400).json({ error: 'Please enter your email' });
    if (!phone || !phone.trim()) return res.status(400).json({ error: 'Please enter your phone number' });

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^(\+91|91|0)?[6-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit Indian phone number' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check email was verified
    const verifiedEmail = req.session.emailVerified;
    if (!verifiedEmail || verifiedEmail !== email.trim().toLowerCase()) {
      return res.status(400).json({ error: 'Please verify your email with OTP first' });
    }

    // Check if already registered
    const existingPhone = getOne('SELECT id FROM users WHERE phone = ?', [cleanPhone]);
    if (existingPhone) return res.status(400).json({ error: 'This phone number is already registered. Please login.' });

    const existingEmail = getOne('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existingEmail) return res.status(400).json({ error: 'This email is already registered. Please login.' });

    const hashed = bcrypt.hashSync(password, 10);
    const result = run(
      'INSERT INTO users (name, phone, email, password, address) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), cleanPhone, email.trim().toLowerCase(), hashed, address ? address.trim() : null]
    );

    req.session.userId = result.lastInsertRowid;
    req.session.userName = name.trim();
    req.session.userPhone = cleanPhone;
    delete req.session.emailVerified;

    res.json({ success: true, user: { id: result.lastInsertRowid, name: name.trim(), phone: cleanPhone, email: email.trim().toLowerCase(), address: address || null } });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Login (phone or email + password)
router.post('/login', (req, res) => {
  try {
    const { phone, email, password } = req.body;

    if (!password) return res.status(400).json({ error: 'Please enter your password' });
    if (!phone && !email) return res.status(400).json({ error: 'Please enter your phone or email' });

    let user = null;
    if (phone) {
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      user = getOne('SELECT * FROM users WHERE phone = ?', [cleanPhone]);
    } else if (email) {
      user = getOne('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials. Please check and try again.' });
    }

    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userPhone = user.phone;

    res.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, email: user.email, address: user.address } });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.userId = null;
  req.session.userName = null;
  req.session.userPhone = null;
  res.json({ success: true });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const user = getOne('SELECT id, name, phone, email, address FROM users WHERE id = ?', [req.session.userId]);
  if (!user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user });
});

// Update profile
router.put('/profile', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Please login' });
  const { name, email, address } = req.body;
  const user = getOne('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  exec('UPDATE users SET name = ?, email = ?, address = ? WHERE id = ?', [
    (name || user.name).trim(),
    email !== undefined ? (email || '').trim().toLowerCase() || null : user.email,
    (address || user.address || '').trim() || null,
    user.id
  ]);

  res.json({ success: true, message: 'Profile updated' });
});

// Get my orders
router.get('/orders', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Please login' });

  const orders = getAll('SELECT * FROM orders WHERE user_id = ? OR customer_phone = ? ORDER BY created_at DESC',
    [req.session.userId, req.session.userPhone]);

  const ordersWithItems = orders.map(order => {
    const items = getAll(`
      SELECT oi.quantity, oi.price, p.name as product_name, p.image_url
      FROM order_items oi JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [order.id]);
    return { ...order, items };
  });

  res.json(ordersWithItems);
});

// ===== FORGOT PASSWORD =====
// Step 1: Send OTP to email for password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) return res.status(400).json({ error: 'Please enter your email' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Check if user exists with this email
    const user = getOne('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) {
      return res.status(400).json({ error: 'No account found with this email address' });
    }

    const otp = generateOTP();
    otpStore['reset_' + email.trim().toLowerCase()] = { otp, expires: Date.now() + 5 * 60 * 1000, userId: user.id };

    await sendOTP(email.trim(), otp);
    res.json({ success: true, message: 'OTP sent to your email for password reset' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// Step 2: Verify OTP and set new password
router.post('/reset-password', (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const key = 'reset_' + email.trim().toLowerCase();
  const stored = otpStore[key];

  if (!stored) return res.status(400).json({ error: 'No OTP found. Please request again.' });
  if (Date.now() > stored.expires) {
    delete otpStore[key];
    return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
  }
  if (stored.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  // Update password
  const hashed = bcrypt.hashSync(newPassword, 10);
  exec('UPDATE users SET password = ? WHERE id = ?', [hashed, stored.userId]);
  delete otpStore[key];

  res.json({ success: true, message: 'Password reset successful! You can now login.' });
});

module.exports = router;
