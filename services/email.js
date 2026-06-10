const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function initTransporter() {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.GMAIL_USER,
      pass: config.GMAIL_APP_PASSWORD
    }
  });
}

// Send simple order notification to shop owner (just info, no approve/reject)
async function sendOrderNotification(order) {
  if (!transporter) initTransporter();
  if (config.GMAIL_APP_PASSWORD === 'YOUR_APP_PASSWORD_HERE') {
    console.log('⚠️  Email not configured.');
    return false;
  }

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;">
        <img src="${item.image_url || ''}" width="50" height="50" style="border-radius:8px;object-fit:cover;" alt="">
      </td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${item.name}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">x${item.quantity}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;text-align:right;">₹${(item.price * item.quantity).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f5ff;padding:20px;">
      <div style="background:#5D0F33;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="margin:0;font-size:1.4rem;">🛍️ New Order Received!</h1>
        <p style="margin:8px 0 0;opacity:0.9;font-size:0.9rem;">Order ID: <strong>${order.track_id}</strong></p>
      </div>
      
      <div style="background:white;padding:24px;border-radius:0 0 12px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        
        <!-- Customer Info -->
        <h3 style="color:#5D0F33;margin-bottom:12px;">👤 Customer Details</h3>
        <table style="width:100%;font-size:0.9rem;margin-bottom:24px;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#666;width:100px;">Name:</td><td style="padding:6px 0;font-weight:600;">${order.customer_name}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Phone:</td><td style="padding:6px 0;font-weight:600;">${order.customer_phone}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Email:</td><td style="padding:6px 0;font-weight:600;">${order.customer_email || 'Not provided'}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Address:</td><td style="padding:6px 0;font-weight:600;">${order.customer_address}</td></tr>
          ${order.notes ? `<tr><td style="padding:6px 0;color:#666;">Notes:</td><td style="padding:6px 0;font-style:italic;">${order.notes}</td></tr>` : ''}
        </table>

        <!-- Items -->
        <h3 style="color:#5D0F33;margin-bottom:12px;">📦 Items Purchased</h3>
        <table style="width:100%;font-size:0.9rem;margin-bottom:24px;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9f5ff;">
              <th style="padding:10px;text-align:left;font-size:0.8rem;color:#666;">Image</th>
              <th style="padding:10px;text-align:left;font-size:0.8rem;color:#666;">Item</th>
              <th style="padding:10px;text-align:center;font-size:0.8rem;color:#666;">Qty</th>
              <th style="padding:10px;text-align:right;font-size:0.8rem;color:#666;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Total -->
        <div style="background:#f9f5ff;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0;color:#666;font-size:0.85rem;">Total Amount</p>
          <p style="margin:4px 0 0;font-size:1.5rem;font-weight:700;color:#5D0F33;">₹${Number(order.total_amount).toLocaleString()}</p>
        </div>

        <p style="margin-top:20px;font-size:0.8rem;color:#999;text-align:center;">
          Manage orders from <a href="${config.BASE_URL}/admin" style="color:#5D0F33;">Admin Panel</a>
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Ladlee Sarees" <${config.GMAIL_USER}>`,
      to: config.OWNER_EMAIL,
      subject: `🛍️ New Order ${order.track_id} — ₹${Number(order.total_amount).toLocaleString()} from ${order.customer_name}`,
      html
    });
    console.log(`📧 Order notification sent for ${order.track_id}`);
    return true;
  } catch (err) {
    console.error('❌ Email failed:', err.message);
    return false;
  }
}

module.exports = { sendOrderNotification };
