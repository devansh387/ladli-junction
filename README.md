# Ladli Junction — Enterprise E-Commerce Platform

A production-grade saree e-commerce platform with separate frontend and backend, designed for security, scalability, and clean architecture.

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│   Vercel (Frontend)     │  API   │   Render (Backend)       │
│   Static HTML/CSS/JS    │───────▶│   Express.js + Node.js   │
│   /frontend             │        │   /backend               │
└─────────────────────────┘        └────────────┬─────────────┘
                                                │
                                   ┌────────────▼─────────────┐
                                   │   Supabase PostgreSQL     │
                                   │   (Connection Pooler)     │
                                   └──────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (no framework) |
| Backend | Express.js, Node.js 18+ |
| Database | PostgreSQL (Supabase) |
| Auth | JWT (access + refresh rotation) |
| Email | Brevo HTTP API |
| File Storage | Render Disk |
| Validation | Zod |
| Security | Helmet, CORS, bcrypt, rate limiting |

## Quick Start (Local Development)

### 1. Backend

```bash
cd backend
cp .env.example .env    # Fill in your credentials
npm install
npm run migrate         # Create tables
npm run seed            # Seed admin + categories
npm run dev             # Start with auto-reload (port 5000)
```

### 2. Frontend

```bash
cd frontend
# Serve with any static server:
npx serve -s . -l 3000
# Or use Python:
python -m http.server 3000
```

### 3. Access

- **Shop**: http://localhost:3000
- **Admin**: http://localhost:3000/admin.html
- **API Docs**: http://localhost:5000/api/health

### Default Admin Login
- Email: `ladlijunction33@gmail.com`
- Password: (set in .env `ADMIN_PASSWORD`)

## Deployment

### Backend → Render
1. Create a new Web Service from this repo's `backend/` directory
2. Set environment variables (see `.env.example`)
3. Build command: `npm install`
4. Start command: `npm start`
5. Run `npm run migrate && npm run seed` in shell once after first deploy

### Frontend → Vercel
1. Import repo, set root directory to `frontend/`
2. Framework: None (static)
3. Update `js/config.js` with your Render API URL
4. Deploy

## Security Features

- JWT access tokens (15-min) + httpOnly refresh cookies (7-day, rotation)
- bcrypt password hashing (cost 12)
- Account locking (5 failed attempts → 30-min lock)
- OTP email verification (SHA-256 hashed, 5-min TTL, max 5 attempts)
- Input validation (Zod schemas on every endpoint)
- XSS prevention (escapeHtml on all outputs, helmet CSP)
- CSRF protection (tokens via Authorization header, not cookies)
- IDOR prevention (ownership checks on all user resources)
- SQL injection prevention (parameterized queries only)
- Rate limiting (per-IP, per-route)
- Security headers (helmet + Vercel headers)
- No sensitive data in JWTs or error responses
- File upload validation (type + size limits)

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/send-otp | No | Send OTP email |
| POST | /api/auth/verify-otp | No | Verify OTP |
| POST | /api/auth/signup | No | Register (email pre-verified) |
| POST | /api/auth/login | No | Login (returns JWT) |
| POST | /api/auth/refresh | No | Refresh token rotation |
| POST | /api/auth/logout | No | Revoke refresh token |
| POST | /api/auth/forgot-password | No | Send reset OTP |
| POST | /api/auth/reset-password | No | Reset with OTP |
| GET | /api/shop/products | No | List products |
| GET | /api/shop/products/:id | No | Product detail |
| GET | /api/shop/categories | No | All categories |
| GET | /api/shop/featured | No | Best sellers |
| POST | /api/orders/place | Yes | Place order |
| GET | /api/orders/track/:id | No | Track order |
| GET | /api/orders/my-orders/:phone | No | Orders by phone |
| GET | /api/orders/user-orders | Yes | User's orders |
| PUT | /api/orders/update/:id | Yes | Edit order |
| PUT | /api/orders/cancel/:id | Yes | Cancel order |
| GET | /api/user/me | Yes | User profile |
| PUT | /api/user/profile | Yes | Update profile |
| GET | /api/admin/* | Admin | All admin CRUD |
| GET | /api/bill/* | Admin | PDF generation |

## License

Private — All rights reserved.
