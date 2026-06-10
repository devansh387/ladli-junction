/**
 * Configuration file for the Saree Shop
 * 
 * IMPORTANT: You need to set up a Gmail App Password for emails to work.
 * 
 * Steps to get App Password:
 * 1. Go to https://myaccount.google.com/security
 * 2. Enable 2-Step Verification (if not already)
 * 3. Go to https://myaccount.google.com/apppasswords
 * 4. Select "Mail" and "Windows Computer"
 * 5. Click Generate — copy the 16-character password
 * 6. Paste it below in GMAIL_APP_PASSWORD
 */

module.exports = {
  // Shop owner's email — receives order notifications
  OWNER_EMAIL: 'shahdevansh3807@gmail.com',

  // Gmail SMTP credentials (use App Password, NOT your regular password)
  GMAIL_USER: 'shahdevansh3807@gmail.com',
  GMAIL_APP_PASSWORD: 'otsp dgaz avbi jrla', // Replace with your 16-char app password

  // Secret token for approve/reject links (change this to anything random)
  APPROVE_SECRET: 'saree-shop-approve-2024-secret',

  // Base URL of your site (change when deploying)
  BASE_URL: 'http://localhost:3000'
};
