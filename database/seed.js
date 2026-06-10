/**
 * Seed script - populates the database with dummy saree products
 * Run: node database/seed.js
 */
const { initDb, getAll, run, getScalar } = require('./db');

async function seed() {
  await initDb();

  // Check if products already exist
  const count = getScalar('SELECT COUNT(*) FROM products');
  if (count > 0) {
    console.log(`Database already has ${count} products. Skipping seed.`);
    console.log('To re-seed, delete database/shop.db and run again.');
    return;
  }

  console.log('🌱 Seeding database with dummy saree data...\n');

  // Get category IDs
  const categories = getAll('SELECT * FROM categories');
  const catMap = {};
  categories.forEach(c => { catMap[c.name] = c.id; });

  // Dummy products with placeholder images from Unsplash
  const products = [
    {
      name: 'Royal Banarasi Silk Saree',
      description: 'Exquisite handwoven Banarasi silk saree with intricate gold zari work. Perfect for weddings and grand celebrations. Features traditional motifs with a modern touch.',
      price: 8999,
      original_price: 12999,
      category: 'Silk Sarees',
      stock: 15,
      featured: 1,
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=750&fit=crop'
    },
    {
      name: 'Kanjivaram Pure Silk Saree',
      description: 'Authentic Kanjivaram silk saree from Tamil Nadu. Rich temple border with peacock motifs. A must-have in every bride\'s trousseau.',
      price: 15999,
      original_price: 19999,
      category: 'Wedding Sarees',
      stock: 8,
      featured: 1,
      image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=600&h=750&fit=crop'
    },
    {
      name: 'Chanderi Cotton Silk Saree',
      description: 'Lightweight Chanderi saree with delicate golden buttis. Perfect for office wear and casual gatherings. Comfortable for all-day wear.',
      price: 2499,
      original_price: 3999,
      category: 'Cotton Sarees',
      stock: 25,
      featured: 1,
      image: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=600&h=750&fit=crop'
    },
    {
      name: 'Designer Georgette Saree',
      description: 'Trendy georgette saree with sequin work and designer blouse piece. Contemporary design for parties and evening events.',
      price: 4599,
      original_price: 6999,
      category: 'Designer Sarees',
      stock: 20,
      featured: 1,
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&h=750&fit=crop'
    },
    {
      name: 'Pochampally Ikat Saree',
      description: 'Handloom Pochampally Ikat saree with geometric patterns. Double ikat weave technique from Telangana. Unique and artistic.',
      price: 3999,
      original_price: 5499,
      category: 'Cotton Sarees',
      stock: 12,
      featured: 1,
      image: 'https://images.unsplash.com/photo-1602584386177-47b tried-8c8e-4?w=600&h=750&fit=crop'
    },
    {
      name: 'Mysore Crepe Silk Saree',
      description: 'GI tagged Mysore silk saree in rich jewel tones. Smooth crepe texture with kasuti embroidery border. Ideal for festivals.',
      price: 6999,
      original_price: 8999,
      category: 'Silk Sarees',
      stock: 10,
      featured: 1,
      image: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=600&h=750&fit=crop'
    },
    {
      name: 'Linen Handloom Saree',
      description: 'Pure linen saree with silver zari border. Breathable and lightweight fabric perfect for summer. Minimalist elegance.',
      price: 1899,
      original_price: 2999,
      category: 'Casual Sarees',
      stock: 30,
      featured: 0,
      image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=750&fit=crop'
    },
    {
      name: 'Paithani Bridal Saree',
      description: 'Maharashtra\'s pride - Paithani saree with peacock pallu. Pure silk with real gold-silver thread work. A bridal heirloom piece.',
      price: 25999,
      original_price: 35000,
      category: 'Wedding Sarees',
      stock: 5,
      featured: 1,
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=750&fit=crop&q=80'
    },
    {
      name: 'Tant Cotton Bengali Saree',
      description: 'Traditional Bengali tant saree in white and red. Lightweight cotton with jamdani-inspired motifs. Perfect for Durga Puja.',
      price: 1299,
      original_price: 1999,
      category: 'Cotton Sarees',
      stock: 35,
      featured: 0,
      image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=600&h=750&fit=crop&q=80'
    },
    {
      name: 'Bandhani Saree from Rajasthan',
      description: 'Vibrant bandhani (tie-dye) saree in multiple colors. Mirror work embellishments on border. Festive Rajasthani craftsmanship.',
      price: 3499,
      original_price: 4999,
      category: 'Designer Sarees',
      stock: 18,
      featured: 0,
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&h=750&fit=crop&q=80'
    },
    {
      name: 'Organza Floral Print Saree',
      description: 'Trendy organza saree with digital floral prints. Lightweight and semi-transparent. Comes with matching satin blouse piece.',
      price: 2999,
      original_price: 4499,
      category: 'Designer Sarees',
      stock: 22,
      featured: 1,
      image: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=600&h=750&fit=crop&q=80'
    },
    {
      name: 'Tussar Silk Printed Saree',
      description: 'Natural tussar silk saree with hand-painted Madhubani art. Earthy tones with tribal patterns. Art you can wear.',
      price: 5499,
      original_price: 7999,
      category: 'Silk Sarees',
      stock: 8,
      featured: 0,
      image: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=600&h=750&fit=crop&q=80'
    },
    {
      name: 'Chiffon Party Wear Saree',
      description: 'Lightweight chiffon saree with stone and pearl work. Elegant drape for cocktail parties and receptions. Available in pastel shades.',
      price: 3799,
      original_price: 5999,
      category: 'Designer Sarees',
      stock: 14,
      featured: 0,
      image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=750&fit=crop&q=80'
    },
    {
      name: 'Maheshwari Handloom Saree',
      description: 'Heritage Maheshwari saree from Madhya Pradesh. Cotton-silk blend with distinctive reversible border. Comfortable yet elegant.',
      price: 2199,
      original_price: 3499,
      category: 'Casual Sarees',
      stock: 20,
      featured: 0,
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=750&fit=crop&q=70'
    },
    {
      name: 'Heavy Embroidered Bridal Lehenga Saree',
      description: 'Grand bridal lehenga saree with heavy zardozi and kundan work. Pre-stitched pleats for easy draping. Complete wedding look.',
      price: 35999,
      original_price: 49999,
      category: 'Wedding Sarees',
      stock: 3,
      featured: 1,
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&h=750&fit=crop&q=70'
    },
    {
      name: 'Daily Wear Cotton Saree',
      description: 'Simple and elegant cotton saree for everyday use. Soft fabric with contrast border. Easy to maintain and iron.',
      price: 799,
      original_price: 1299,
      category: 'Casual Sarees',
      stock: 50,
      featured: 0,
      image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=600&h=750&fit=crop&q=70'
    }
  ];

  // Insert products
  for (const p of products) {
    const categoryId = catMap[p.category] || null;
    run(
      `INSERT INTO products (name, description, price, original_price, category_id, image_url, stock, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.name, p.description, p.price, p.original_price, categoryId, p.image, p.stock, p.featured]
    );
    console.log(`  ✅ Added: ${p.name} — ₹${p.price}`);
  }

  // Add a sample order to demonstrate the order system
  run(
    `INSERT INTO orders (track_id, customer_name, customer_phone, customer_address, customer_email, total_amount, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['SE-DEMO01', 'Priya Sharma', '9876543210', '42, MG Road, Jaipur, Rajasthan - 302001', 'priya@example.com', 11498, 'confirmed', 'Please gift wrap']
  );

  // Get the order ID
  const orderId = getScalar('SELECT MAX(id) FROM orders');

  // Add items to the sample order
  run('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [orderId, 1, 1, 8999]);
  run('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [orderId, 3, 1, 2499]);

  console.log(`\n  📦 Added sample order #${orderId} (Priya Sharma - ₹11,498)`);
  console.log('\n🎉 Database seeded successfully!');
  console.log(`   Total Products: ${products.length}`);
  console.log('   Total Orders: 1\n');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
