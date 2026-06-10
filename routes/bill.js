const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { getOne, getAll } = require('../database/db');

// Auth middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Generate bill PDF for an order
router.get('/generate/:trackId', requireAdmin, (req, res) => {
  const trackId = req.params.trackId.trim().toUpperCase();

  let order = getOne('SELECT * FROM orders WHERE track_id = ?', [trackId]);
  if (!order) {
    const numId = parseInt(trackId, 10);
    if (!isNaN(numId) && numId > 0) order = getOne('SELECT * FROM orders WHERE id = ?', [numId]);
  }
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = getAll(`
    SELECT oi.quantity, oi.price, p.name as product_name
    FROM order_items oi JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `, [order.id]);

  // Create PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Bill-${order.track_id}.pdf`);
  doc.pipe(res);

  // ===== HEADER =====
  doc.fontSize(22).font('Helvetica-Bold').text('Ladlee Sarees', 50, 50);
  doc.fontSize(9).font('Helvetica').fillColor('#666')
    .text('Premium Saree Collection', 50, 75)
    .text('Phone: +91 9429670205 / 7990309748 | Email: shahdevansh3807@gmail.com', 50, 88);

  // Invoice title
  doc.fillColor('#1A1A1A').fontSize(14).font('Helvetica-Bold')
    .text('TAX INVOICE', 400, 50, { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#666')
    .text(`Invoice #: INV-${order.id.toString().padStart(4, '0')}`, 400, 70, { align: 'right' })
    .text(`Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 400, 83, { align: 'right' })
    .text(`Order: ${order.track_id}`, 400, 96, { align: 'right' });

  // Divider
  doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#E0E0E0').stroke();

  // ===== BILL TO =====
  let y = 130;
  doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text('BILL TO:', 50, y);
  y += 16;
  doc.font('Helvetica').fontSize(10).fillColor('#333')
    .text(order.customer_name, 50, y);
  y += 14;
  doc.fontSize(9).fillColor('#666')
    .text(order.customer_address, 50, y, { width: 250 });
  y += doc.heightOfString(order.customer_address, { width: 250 }) + 4;
  doc.text(`Phone: ${order.customer_phone}`, 50, y);
  y += 12;
  if (order.customer_email) {
    doc.text(`Email: ${order.customer_email}`, 50, y);
    y += 12;
  }

  // ===== STATUS =====
  doc.fontSize(9).fillColor('#666').text(`Status: ${order.status.toUpperCase()}`, 400, 130);

  // ===== ITEMS TABLE =====
  y = Math.max(y + 20, 210);

  // Table header
  doc.fillColor('#F5F5F5').rect(50, y, 495, 22).fill();
  doc.fillColor('#333').fontSize(8).font('Helvetica-Bold');
  doc.text('#', 58, y + 7, { width: 25 });
  doc.text('ITEM', 85, y + 7, { width: 250 });
  doc.text('QTY', 340, y + 7, { width: 50, align: 'center' });
  doc.text('PRICE', 395, y + 7, { width: 70, align: 'right' });
  doc.text('TOTAL', 470, y + 7, { width: 70, align: 'right' });

  y += 26;

  // Table rows
  doc.font('Helvetica').fontSize(9).fillColor('#333');
  let subtotal = 0;

  items.forEach((item, i) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    if (i % 2 === 0) {
      doc.fillColor('#FAFAFA').rect(50, y - 2, 495, 20).fill();
    }

    doc.fillColor('#333');
    doc.text((i + 1).toString(), 58, y + 3, { width: 25 });
    doc.text(item.product_name, 85, y + 3, { width: 250 });
    doc.text(item.quantity.toString(), 340, y + 3, { width: 50, align: 'center' });
    doc.text(`₹${Number(item.price).toLocaleString()}`, 395, y + 3, { width: 70, align: 'right' });
    doc.text(`₹${Number(itemTotal).toLocaleString()}`, 470, y + 3, { width: 70, align: 'right' });

    y += 22;
  });

  // Divider
  y += 6;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').stroke();
  y += 12;

  // ===== TOTALS =====
  doc.fontSize(9).font('Helvetica').fillColor('#666');
  doc.text('Subtotal:', 380, y, { width: 80, align: 'right' });
  doc.fillColor('#333').text(`₹${subtotal.toLocaleString()}`, 470, y, { width: 70, align: 'right' });
  y += 16;

  doc.fillColor('#666').text('Delivery:', 380, y, { width: 80, align: 'right' });
  doc.fillColor('#2E7D32').text('FREE', 470, y, { width: 70, align: 'right' });
  y += 20;

  // Grand total
  doc.fillColor('#1A1A1A').rect(370, y - 4, 175, 26).fill();
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL:', 380, y + 2, { width: 80, align: 'right' });
  doc.text(`₹${Number(order.total_amount).toLocaleString()}`, 470, y + 2, { width: 70, align: 'right' });

  y += 50;

  // ===== FOOTER =====
  doc.fillColor('#999').fontSize(8).font('Helvetica');
  doc.text('Thank you for shopping with Ladlee Sarees!', 50, y, { align: 'center' });
  y += 12;
  doc.text('This is a computer-generated invoice and does not require a signature.', 50, y, { align: 'center' });

  doc.end();
});

// Generate bill from manual input (not linked to existing order)
router.post('/manual', requireAdmin, (req, res) => {
  const { customer_name, customer_phone, customer_address, items, notes } = req.body;

  if (!customer_name || !items || items.length === 0) {
    return res.status(400).json({ error: 'Customer name and at least one item required' });
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const billNo = 'MAN-' + Date.now().toString().slice(-6);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Bill-${billNo}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(22).font('Helvetica-Bold').text('Ladlee Sarees', 50, 50);
  doc.fontSize(9).font('Helvetica').fillColor('#666')
    .text('Premium Saree Collection', 50, 75)
    .text('Phone: +91 9429670205 / 7990309748 | Email: shahdevansh3807@gmail.com', 50, 88);

  doc.fillColor('#1A1A1A').fontSize(14).font('Helvetica-Bold')
    .text('BILL / RECEIPT', 400, 50, { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#666')
    .text(`Bill #: ${billNo}`, 400, 70, { align: 'right' })
    .text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 400, 83, { align: 'right' });

  doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#E0E0E0').stroke();

  // Bill To
  let y = 130;
  doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text('BILL TO:', 50, y);
  y += 16;
  doc.font('Helvetica').fontSize(10).fillColor('#333').text(customer_name, 50, y);
  y += 14;
  if (customer_address) { doc.fontSize(9).fillColor('#666').text(customer_address, 50, y, { width: 250 }); y += 16; }
  if (customer_phone) { doc.fontSize(9).fillColor('#666').text(`Phone: ${customer_phone}`, 50, y); y += 12; }

  // Items
  y = Math.max(y + 20, 200);
  doc.fillColor('#F5F5F5').rect(50, y, 495, 22).fill();
  doc.fillColor('#333').fontSize(8).font('Helvetica-Bold');
  doc.text('#', 58, y + 7, { width: 25 });
  doc.text('ITEM', 85, y + 7, { width: 220 });
  doc.text('QTY', 310, y + 7, { width: 50, align: 'center' });
  doc.text('PRICE', 365, y + 7, { width: 80, align: 'right' });
  doc.text('TOTAL', 450, y + 7, { width: 90, align: 'right' });
  y += 26;

  doc.font('Helvetica').fontSize(9).fillColor('#333');
  let total = 0;

  items.forEach((item, i) => {
    const itemTotal = Number(item.price) * Number(item.qty);
    total += itemTotal;
    if (i % 2 === 0) doc.fillColor('#FAFAFA').rect(50, y - 2, 495, 20).fill();
    doc.fillColor('#333');
    doc.text((i + 1).toString(), 58, y + 3, { width: 25 });
    doc.text(item.name || 'Item', 85, y + 3, { width: 220 });
    doc.text(item.qty.toString(), 310, y + 3, { width: 50, align: 'center' });
    doc.text(`₹${Number(item.price).toLocaleString()}`, 365, y + 3, { width: 80, align: 'right' });
    doc.text(`₹${itemTotal.toLocaleString()}`, 450, y + 3, { width: 90, align: 'right' });
    y += 22;
  });

  y += 6;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').stroke();
  y += 16;

  doc.fillColor('#1A1A1A').rect(370, y - 4, 175, 26).fill();
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL:', 380, y + 2, { width: 80, align: 'right' });
  doc.text(`₹${total.toLocaleString()}`, 470, y + 2, { width: 70, align: 'right' });

  y += 50;
  if (notes) {
    doc.fillColor('#666').fontSize(8).font('Helvetica').text(`Note: ${notes}`, 50, y);
    y += 16;
  }
  doc.fillColor('#999').fontSize(8).text('Thank you for shopping with Ladlee Sarees!', 50, y, { align: 'center' });

  doc.end();
});

module.exports = router;
