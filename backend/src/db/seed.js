'use strict';

/**
 * Database Seed Script
 * Seeds the admin user and default categories.
 * Idempotent — safe to run multiple times (checks before inserting).
 *
 * Usage: node src/db/seed.js
 */

const { pool, query } = require('../config/database');
const { hashPassword } = require('../utils/hash');
const config = require('../config');

const DEFAULT_CATEGORIES = [
  { name: 'Silk Sarees', description: 'Premium silk sarees for special occasions' },
  { name: 'Cotton Sarees', description: 'Comfortable cotton sarees for daily wear' },
  { name: 'Designer Sarees', description: 'Exclusive designer collection' },
  { name: 'Wedding Sarees', description: 'Bridal and wedding collection' },
  { name: 'Casual Sarees', description: 'Everyday casual wear sarees' },
];

async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    // ── Seed Admin User ──────────────────────────────────────────────────────
    const existingAdmin = await query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [config.admin.email, config.admin.phone]
    );

    if (existingAdmin.rows.length === 0) {
      const passwordHash = await hashPassword(config.admin.password);
      await query(
        `INSERT INTO users (name, email, phone, password_hash, is_email_verified, role)
         VALUES ($1, $2, $3, $4, TRUE, 'admin')`,
        ['Admin', config.admin.email, config.admin.phone, passwordHash]
      );
      console.log('✅ Admin user created:');
      console.log(`   Email: ${config.admin.email}`);
      console.log(`   Phone: ${config.admin.phone}`);
    } else {
      console.log('ℹ️  Admin user already exists, skipping.');
    }

    // ── Seed Default Categories ──────────────────────────────────────────────
    const existingCats = await query('SELECT COUNT(*) as count FROM categories');
    const catCount = parseInt(existingCats.rows[0].count, 10);

    if (catCount === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await query(
          'INSERT INTO categories (name, description) VALUES ($1, $2)',
          [cat.name, cat.description]
        );
      }
      console.log(`✅ ${DEFAULT_CATEGORIES.length} default categories seeded.`);
    } else {
      console.log(`ℹ️  ${catCount} categories already exist, skipping.`);
    }

    // ── Seed Hero Config ─────────────────────────────────────────────────────
    const heroExists = await query('SELECT id FROM hero_config LIMIT 1');
    if (heroExists.rows.length === 0) {
      await query("INSERT INTO hero_config (files) VALUES ('[]'::jsonb)");
      console.log('✅ Hero config row created.');
    }

    console.log('\n✅ Seed complete.\n');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seed();
}

module.exports = { seed };
