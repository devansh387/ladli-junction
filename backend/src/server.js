'use strict';

const app = require('./app');
const config = require('./config');
const { healthCheck } = require('./config/database');

/**
 * Server Entry Point
 * Starts the Express server after verifying database connectivity.
 */

async function start() {
  // Verify database connection
  console.log('🔗 Connecting to database...');
  const dbHealth = await healthCheck();
  if (!dbHealth.ok) {
    console.error('❌ Database connection failed:', dbHealth.error);
    console.error('   Check DATABASE_URL in your .env file.');
    process.exit(1);
  }
  console.log('✅ Database connected successfully.');

  // Start server
  app.listen(config.port, () => {
    console.log(`\n🚀 Ladli Junction API Server`);
    console.log(`   Environment: ${config.env}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   Frontend: ${config.frontendUrl}`);
    console.log(`   Health: http://localhost:${config.port}/api/health`);
    console.log(`\n   API Endpoints:`);
    console.log(`   ├── /api/auth/*     — Authentication`);
    console.log(`   ├── /api/shop/*     — Public shop`);
    console.log(`   ├── /api/orders/*   — Orders`);
    console.log(`   ├── /api/user/*     — User profile`);
    console.log(`   ├── /api/admin/*    — Admin panel`);
    console.log(`   └── /api/bill/*     — PDF billing`);
    console.log('');
  });
}

// Handle uncaught errors gracefully
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Unhandled rejection:', err.message);
  if (!config.isProduction) console.error(err.stack);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message);
  if (!config.isProduction) console.error(err.stack);
  process.exit(1);
});

start();
