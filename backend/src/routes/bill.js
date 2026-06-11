'use strict';

const { Router } = require('express');
const PDFDocument = require('pdfkit');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { query } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const router = Router();

/**
 * Bill Routes — /api/bill/*
 * Admin-only PDF generation.
 */
router.use(authenticate, requireAdmin);

// Generate bill PDF for an order
router.get('/generate/:trackId', async (req, res, next) => {
  try {
    const trackId = req.params.trackId.trim().toUpperCase();

    let orderResult = await query('SELECT * FROM orders WHERE track_id = $1', [trackId]);
    if (orderResult.rows.length === 0) {
      const numId = parseInt(trackId, 10);
      if (!isNaN(numId) && numId > 0) {
        orderResult = await query('SELECT * FROM orders WHERE id = $1', [numId]);
      }
    }
    if (orderResult.rows.length === 0) {
      throw new AppError('Order not found.', 404);
    }

    const order = orderResult.rows[0];
    const itemsResult = await query(
      `SELECT oi.quantity, oi.price, p.name as product_name
       FROM order_items oi JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    );
    const items = itemsResult.rows;

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Bill-${order.track_id}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(22).font('Helvetica-Bold').text('Ladli Junction', 50, 50);
    doc.fontSize(9).font('Helvetica').fillColor('#666')
      .text('Premium Saree Collection', 50, 75)
      .text('Phone: +91 9429670205 / 7990309748', 50, 88);

    doc.fillColor('#1A1A1A').fontSize(14).font('Helvetica-Bold')
      .text('TAX INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('#666')
      .text(`Invoice #: INV-${order.id.toString().padStart(4, '0')}`, 400, 70, { align: 'right' })
      .text(`Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 400, 83, { align: 'right' })
      .text(`Order: ${order.track_id}`, 400, 96, { align: 'right' });

    doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#E0E0E0').stroke();

    // Bill To
    let y = 130;
    doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text('BILL TO:', 50, y);
    y += 16;
    doc.font('Helvetica').fontSize(10).fillColor('#333').text(order.customer_name, 50, y);
    y += 14;
    doc.fontSize(9).fillColor('#666').text(order.customer_address, 50, y, { width: 250 });
    y += doc.heightOfString(order.customer_address, { width: 250 }) + 4;
    doc.text(`Phone: ${order.customer_phone}`, 50, y);
    y += 12;
    if (order.customer_email) { doc.text(`Email: ${order.customer_email}`, 50, y); y += 12; }

    // Items table
    y = Math.max(y + 20, 210);
    doc.fillColor('#F5F5F5').rect(50, y, 495, 22).fill();
    doc.fillColor('#333').fontSize(8).font('Helvetica-Bold');
    doc.text('#', 58, y + 7, { width: 25 });
    doc.text('ITEM', 85, y + 7, { width: 250 });
    doc.text('QTY', 340, y + 7, { width: 50, align: 'center' });
    doc.text('PRICE', 395, y + 7, { width: 70, align: 'right' });
    doc.text('TOTAL', 470, y + 7, { width: 70, align: 'right' });
    y += 26;

    doc.font('Helvetica').fontSize(9).fillColor('#333');
    let subtotal = 0;

    items.forEach((item, i) => {
      const itemTotal = parseFloat(item.price) * item.quantity;
      subtotal += itemTotal;
      if (i % 2 === 0) doc.fillColor('#FAFAFA').rect(50, y - 2, 495, 20).fill();
      doc.fillColor('#333');
      doc.text((i + 1).toString(), 58, y + 3, { width: 25 });
      doc.text(item.product_name, 85, y + 3, { width: 250 });
      doc.text(item.quantity.toString(), 340, y + 3, { width: 50, align: 'center' });
      doc.text(`₹${Number(item.price).toLocaleString()}`, 395, y + 3, { width: 70, align: 'right' });
      doc.text(`₹${Number(itemTotal).toLocaleString()}`, 470, y + 3, { width: 70, align: 'right' });
      y += 22;
    });

    y += 6;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').stroke();
    y += 16;

    // Grand total
    doc.fillColor('#1A1A1A').rect(370, y - 4, 175, 26).fill();
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold');
    doc.text('TOTAL:', 380, y + 2, { width: 80, align: 'right' });
    doc.text(`₹${Number(order.total_amount).toLocaleString()}`, 470, y + 2, { width: 70, align: 'right' });
    y += 50;

    // Footer
    doc.fillColor('#999').fontSize(8).font('Helvetica');
    doc.text('Thank you for shopping with Ladli Junction!', 50, y, { align: 'center' });

    doc.end();
  } catch (err) { next(err); }
});

// Manual bill
router.post('/manual', async (req, res, next) => {
  try {
    const { customer_name, customer_phone, customer_address, items, notes } = req.body;
    if (!customer_name || !items || items.length === 0) {
      throw new AppError('Customer name and at least one item required.', 400);
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const billNo = 'MAN-' + Date.now().toString().slice(-6);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Bill-${billNo}.pdf`);
    doc.pipe(res);

    doc.fontSize(22).font('Helvetica-Bold').text('Ladli Junction', 50, 50);
    doc.fontSize(9).font('Helvetica').fillColor('#666')
      .text('Premium Saree Collection', 50, 75);

    doc.fillColor('#1A1A1A').fontSize(14).font('Helvetica-Bold')
      .text('BILL / RECEIPT', 400, 50, { align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('#666')
      .text(`Bill #: ${billNo}`, 400, 70, { align: 'right' })
      .text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 400, 83, { align: 'right' });

    doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#E0E0E0').stroke();

    let y = 130;
    doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text('BILL TO:', 50, y);
    y += 16;
    doc.font('Helvetica').fontSize(10).fillColor('#333').text(customer_name, 50, y);
    y += 14;
    if (customer_address) { doc.fontSize(9).fillColor('#666').text(customer_address, 50, y, { width: 250 }); y += 16; }
    if (customer_phone) { doc.fontSize(9).fillColor('#666').text(`Phone: ${customer_phone}`, 50, y); y += 12; }

    y = Math.max(y + 20, 200);
    doc.fillColor('#F5F5F5').rect(50, y, 495, 22).fill();
    doc.fillColor('#333').fontSize(8).font('Helvetica-Bold');
    doc.text('#', 58, y + 7); doc.text('ITEM', 85, y + 7); doc.text('QTY', 340, y + 7, { align: 'center' });
    doc.text('PRICE', 395, y + 7, { align: 'right' }); doc.text('TOTAL', 470, y + 7, { align: 'right' });
    y += 26;

    doc.font('Helvetica').fontSize(9).fillColor('#333');
    let total = 0;
    items.forEach((item, i) => {
      const itemTotal = Number(item.price) * Number(item.qty);
      total += itemTotal;
      doc.text((i + 1).toString(), 58, y + 3); doc.text(item.name || 'Item', 85, y + 3);
      doc.text(String(item.qty), 340, y + 3, { align: 'center' });
      doc.text(`₹${Number(item.price).toLocaleString()}`, 395, y + 3, { align: 'right' });
      doc.text(`₹${itemTotal.toLocaleString()}`, 470, y + 3, { align: 'right' });
      y += 22;
    });

    y += 6; doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').stroke(); y += 16;
    doc.fillColor('#1A1A1A').rect(370, y - 4, 175, 26).fill();
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold');
    doc.text('TOTAL:', 380, y + 2, { width: 80, align: 'right' });
    doc.text(`₹${total.toLocaleString()}`, 470, y + 2, { width: 70, align: 'right' });
    y += 50;
    if (notes) { doc.fillColor('#666').fontSize(8).font('Helvetica').text(`Note: ${notes}`, 50, y); y += 16; }
    doc.fillColor('#999').fontSize(8).text('Thank you for shopping with Ladli Junction!', 50, y, { align: 'center' });

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
