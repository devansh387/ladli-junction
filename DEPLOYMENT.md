# Deployment Guide — Ladli Junction

Step-by-step instructions to deploy the platform to production.

---

## Prerequisites

- GitHub account with the repo pushed
- [Render](https://render.com) account (free tier works)
- [Vercel](https://vercel.com) account (free tier works)
- Supabase database already configured (✅ done)
- Brevo API key (✅ done)

---

## Step 1: Push Code to GitHub

```bash
# From the project root
git init
git add backend/ frontend/ README.md DEPLOYMENT.md .gitignore
git commit -m "Initial commit — enterprise rewrite"
git remote add origin https://github.com/YOUR_USER/ladli-junction.git
git push -u origin main
```

> **Important:** Do NOT commit `backend/.env`, `node_modules/`, or `uploads/`.

---

## Step 2: Deploy Backend to Render

### 2.1 Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Name:** `ladli-junction-api`
   - **Region:** Singapore (closest to India)
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Starter for always-on)

### 2.2 Set Environment Variables

In Render → Your Service → Environment, add these:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DATABASE_URL` | `postgresql://postgres.zckhmimgzrrkdtndiewf:woSwhhyX3pScCFYT@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres` |
| `JWT_ACCESS_SECRET` | (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `JWT_REFRESH_SECRET` | (generate a DIFFERENT 64-char hex) |
| `ACCESS_TOKEN_EXPIRY` | `15m` |
| `REFRESH_TOKEN_EXPIRY_DAYS` | `7` |
| `FRONTEND_URL` | `https://your-app.vercel.app` (set after Vercel deploy) |
| `BREVO_API_KEY` | `xkeysib-5215b6ca...` (your key) |
| `MAIL_FROM` | `ladlijunction33@gmail.com` |
| `MAIL_FROM_NAME` | `Ladli Junction` |
| `ORDER_NOTIFICATION_EMAIL` | `ladlijunction33@gmail.com` |
| `ADMIN_EMAIL` | `ladlijunction33@gmail.com` |
| `ADMIN_PHONE` | `9429670205` |
| `ADMIN_PASSWORD` | (choose a strong password) |
| `MAX_FILE_SIZE_MB` | `20` |

### 2.3 Add Persistent Disk (for file uploads)

1. In Render → Your Service → Disks
2. Add Disk:
   - **Name:** `uploads`
   - **Mount Path:** `/opt/render/project/src/uploads`
   - **Size:** 1 GB

### 2.4 Run Migration & Seed

After the first deploy succeeds:

1. Go to Render → Your Service → Shell
2. Run:
   ```bash
   npm run migrate
   npm run seed
   ```

### 2.5 Verify

Visit: `https://ladli-junction-api.onrender.com/api/health`

Expected response:
```json
{"status":"healthy","timestamp":"...","database":"connected"}
```

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Import Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repo
4. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Other (no framework)
   - **Build Command:** (leave empty)
   - **Output Directory:** `.` (current directory)

### 3.2 Update API Base URL

Before deploying, update `frontend/js/config.js`:

```javascript
const CONFIG = Object.freeze({
  API_BASE: window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://ladli-junction-api.onrender.com',  // ← Your actual Render URL
  // ...
});
```

Commit and push — Vercel will auto-deploy.

### 3.3 Update CORS on Backend

After you have the Vercel URL (e.g., `https://ladli-junction.vercel.app`):

1. Go to Render → Environment Variables
2. Set `FRONTEND_URL` to your Vercel URL (no trailing slash)
3. Render will auto-redeploy

---

## Step 4: Verify Full System

### Test Checklist

| Test | Expected |
|------|----------|
| Visit frontend URL | Shop loads, products display |
| Click "My Account" | Login form appears |
| Login with admin creds | Redirects to admin panel |
| Admin → Products | Product list (empty initially) |
| Admin → Add Product | Upload works, product appears |
| Logout → Login as customer | Signup with OTP works |
| Place order | Confirmation with tracking ID |
| Track order | Timeline shows status |
| Admin → Orders | New order visible |
| Admin → Change status | Status updates |

### Common Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Check `FRONTEND_URL` env var matches your Vercel domain exactly |
| 401 on refresh | Ensure cookies work: `SameSite=None; Secure` in production CORS config |
| Slow first request | Render free tier sleeps after 15 min of inactivity — first request wakes it (~30s) |
| Email not received | Verify sender email in Brevo dashboard, check spam folder |
| File uploads 404 | Ensure Render disk is mounted at correct path |

---

## Step 5: Custom Domain (Optional)

### Frontend (Vercel)
1. Vercel → Settings → Domains
2. Add your domain (e.g., `ladlijunction.com`)
3. Update DNS records as instructed

### Backend (Render)
1. Render → Your Service → Settings → Custom Domains
2. Add subdomain (e.g., `api.ladlijunction.com`)
3. Update DNS CNAME

After custom domain:
- Update `FRONTEND_URL` in Render to your new domain
- Update `API_BASE` in `frontend/js/config.js`

---

## Monitoring & Maintenance

### Logs
- **Render:** Dashboard → Your Service → Logs (live tail)
- **Supabase:** Dashboard → Database → Logs

### Database Cleanup
Expired OTPs and revoked sessions accumulate. Run periodically:

```sql
-- Clean expired OTPs (older than 1 day)
DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 day';

-- Clean revoked sessions (older than 30 days)
DELETE FROM user_sessions WHERE is_revoked = TRUE AND created_at < NOW() - INTERVAL '30 days';
```

Or add a cron job on Render (Starter plan+):
```bash
# Add to render.yaml or run manually
node -e "const {query,pool}=require('./src/config/database'); query(\"DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 day'\").then(r=>console.log('Cleaned',r.rowCount,'OTPs')).then(()=>query(\"DELETE FROM user_sessions WHERE is_revoked = TRUE AND created_at < NOW() - INTERVAL '30 days'\")).then(r=>console.log('Cleaned',r.rowCount,'sessions')).finally(()=>pool.end());"
```

### Backup
Supabase handles automated daily backups. For manual backup:
- Supabase Dashboard → Database → Backups

---

## Security Checklist for Production

- [x] All secrets in environment variables (never in code)
- [x] `.env` in `.gitignore`
- [x] HTTPS enforced (Render + Vercel handle this automatically)
- [x] CORS restricted to frontend domain only
- [x] Rate limiting on auth endpoints
- [x] JWT tokens expire (15 min access, 7 day refresh)
- [x] Refresh token rotation (old token revoked on use)
- [x] Passwords hashed with bcrypt (cost 12)
- [x] OTPs hashed with SHA-256 before storage
- [x] Account lockout after 5 failed attempts
- [x] No stack traces in production error responses
- [x] Input validation on every endpoint (Zod)
- [x] Parameterized SQL queries (no interpolation)
- [x] File upload type + size validation
- [x] Security headers (helmet + Vercel CSP)
- [x] httpOnly cookies for refresh tokens
- [ ] Monitor for unusual login patterns (future: add alerting)
- [ ] Set up Render health check alerts
