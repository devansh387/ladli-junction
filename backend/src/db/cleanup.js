'use strict';

/**
 * Database Cleanup Script
 * Removes expired OTPs and old revoked sessions.
 * Run periodically (e.g., daily via cron or manually).
 *
 * Usage: node src/db/cleanup.js
 */

const { pool, query } = require('../config/database');

async function cleanup() {
  console.log('🧹 Running database cleanup...\n');

  try {
    // Remove expired OTPs (older than 1 day)
    const otpResult = await query(
      "DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 day'"
    );
    console.log(`  ✅ Removed ${otpResult.rowCount} expired OTP(s).`);

    // Remove used OTPs older than 7 days
    const usedOtps = await query(
      "DELETE FROM otp_codes WHERE is_used = TRUE AND created_at < NOW() - INTERVAL '7 days'"
    );
    console.log(`  ✅ Removed ${usedOtps.rowCount} used OTP(s) older than 7 days.`);

    // Remove revoked sessions older than 30 days
    const sessionsResult = await query(
      "DELETE FROM user_sessions WHERE is_revoked = TRUE AND created_at < NOW() - INTERVAL '30 days'"
    );
    console.log(`  ✅ Removed ${sessionsResult.rowCount} revoked session(s) older than 30 days.`);

    // Remove expired sessions (not revoked but past expiry)
    const expiredSessions = await query(
      "DELETE FROM user_sessions WHERE expires_at < NOW() AND is_revoked = FALSE"
    );
    console.log(`  ✅ Removed ${expiredSessions.rowCount} expired session(s).`);

    console.log('\n✅ Cleanup complete.\n');
  } catch (err) {
    console.error('❌ Cleanup failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  cleanup();
}

module.exports = { cleanup };
