# 🔐 Personal Auth API

A **production-grade** authentication REST API built with **TypeScript, Express, Drizzle ORM, PostgreSQL, Redis, and Zod**. Features JWT + Refresh Token auth, role-based access control (RBAC), Google OAuth, guest sessions, and a full admin panel.

---

## ✨ Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Sign-up (email + password) | ✅ |
| 2 | Sign-in (email + password) | ✅ |
| 3 | Secure password hashing (bcrypt) | ✅ |
| 4 | Email verification (token + expiry) | ✅ |
| 5 | Password reset (forgot + reset) | ✅ |
| 6 | **JWT access token** (15 min, HttpOnly cookie) | ✅ |
| 7 | **Opaque refresh token** (7 day, Redis, HttpOnly cookie) | ✅ |
| 8 | **Refresh token rotation** (one-time use, family theft detection) | ✅ |
| 9 | **JWT blocklist** (Redis, auto-expires with token lifetime) | ✅ |
| 10 | **PG session tracking** (token hash stored, max 5 per user) | ✅ |
| 11 | Get current user (`/api/auth/me`) | ✅ |
| 12 | Update profile (name, avatar) | ✅ |
| 13 | Change password (with old-password check) | ✅ |
| 14 | Delete account (cascade) | ✅ |
| 15 | Google OAuth login (with CSRF state param) | ✅ |
| 16 | Rate limiting (global, auth, signup, reset, verify, password reset) | ✅ |
| 17 | Guest sessions (cart, prefs, merge on login, 16 KB data limit) | ✅ |
| 18 | Block / suspend user (admin only, OAuth-aware) | ✅ |
| 19 | Login activity audit trail (IP + UA, failed & successful) | ✅ |
| 20 | Structured JSON responses with emojis | ✅ |
| 21 | **Role-based access control (RBAC)** | ✅ |
| 22 | **Admin-only role management** | ✅ |
| 23 | **SHA-256 token hashing** (sessions, verification, password reset, refresh tokens) | ✅ |
| 24 | **Periodic cleanup** (expired sessions, guests, tokens — hourly) | ✅ |
| 25 | **Request ID tracing** (`X-Request-Id` header on every response) | ✅ |
| 26 | **UUID param validation** (all `:userId` routes) | ✅ |
| 27 | **Admin self-action guard** (cannot block/demote yourself) | ✅ |
| 28 | **Full token revocation on password change / reset / block / delete** | ✅ |
| 29 | **Multi-origin CORS** (comma-separated `CLIENT_URL`) | ✅ |
| 30 | **Race-condition-safe registration** (INSERT + catch unique violation) | ✅ |
| 31 | **Cross-subdomain cookie support** (`COOKIE_DOMAIN` env var) | ✅ |

---

## 🏗️ Tech Stack

- **Runtime:** Node.js ≥ 18 + TypeScript (strict mode)
- **Framework:** Express 4
- **Database:** PostgreSQL ≥ 14
- **Cache / Token Store:** Redis ≥ 7 (refresh tokens + JWT blocklist)
- **ORM:** Drizzle ORM (postgres.js driver)
- **Auth:** JSON Web Tokens (`jsonwebtoken`) + opaque refresh tokens
- **Validation:** Zod (all request bodies)
- **Password Hashing:** bcryptjs (pure JS, no native binaries)
- **Rate Limiting:** express-rate-limit
- **Email:** Nodemailer (console logger in dev)
- **OAuth:** google-auth-library (Authorization Code flow)

---

## 📂 Project Structure

```
src/
├── config/            # Zod-validated env config
├── db/
│   ├── schema/        # Drizzle table definitions + relations
│   │   ├── users.ts         # users table + roleEnum ("user" | "admin")
│   │   ├── sessions.ts      # PG login sessions (token stored as SHA-256 hash)
│   │   ├── guests.ts        # guest sessions
│   │   ├── oauth-accounts.ts
│   │   ├── verification-tokens.ts
│   │   ├── password-reset-tokens.ts
│   │   ├── login-activity.ts
│   │   └── index.ts         # re-exports + relations
│   ├── index.ts       # DB connection pool
│   └── migrate.ts     # Migration runner
├── lib/
│   └── redis.ts           # ioredis singleton (refresh tokens + JWT blocklist)
├── middleware/
│   ├── authenticate.ts    # JWT cookie → req.user + req.userId + req.sessionToken
│   ├── authorize.ts       # Role-based guard (RBAC)
│   ├── validate.ts        # Zod body + params validation
│   ├── rate-limiter.ts    # Per-route rate limiters
│   ├── error-handler.ts   # Global error handler
│   └── guest.ts           # Guest cookie middleware
├── validators/
│   ├── auth.schema.ts     # register, login, verify, reset schemas
│   ├── user.schema.ts     # updateProfile, changePassword schemas
│   ├── admin.schema.ts    # updateRole + userIdParam (UUID) schemas
│   └── guest.schema.ts    # updateGuestData schema (16 KB limit)
├── services/          # Business logic (no HTTP concerns)
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── session.service.ts      # PG session CRUD (kept alongside JWT flow)
│   ├── token.service.ts        # JWT access token + opaque refresh token (Redis)
│   ├── guest.service.ts
│   ├── google-oauth.service.ts
│   ├── email.service.ts
│   └── login-activity.service.ts
├── controllers/       # HTTP request → service → response
│   ├── auth.controller.ts
│   ├── user.controller.ts
│   ├── admin.controller.ts
│   └── guest.controller.ts
├── routes/
│   ├── auth.routes.ts     # /api/auth   (public + rate-limited)
│   ├── user.routes.ts     # /api/user   (authenticated)
│   ├── admin.routes.ts    # /api/admin  (authenticated + admin role)
│   └── guest.routes.ts    # /api/guest  (public)
├── utils/
│   ├── api-error.ts       # Error class hierarchy
│   ├── api-response.ts    # Standardized JSON responses
│   ├── password.ts        # bcryptjs hash / compare
│   ├── crypto.ts          # Secure token generation + SHA-256 hashing
│   ├── cookie.ts          # Cookie options factory (session + JWT variants)
│   └── constants.ts       # Cookie names, JWT cookie names, token expiry, messages
├── types/
│   └── express.d.ts       # Extends Express Request (user, userId, sessionToken, etc.)
├── app.ts             # Express app setup (helmet, cors, trust proxy, request IDs)
└── server.ts          # Entry point with graceful shutdown + periodic cleanup
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **Redis** ≥ 7 (refresh tokens + JWT blocklist)
- **npm** or **pnpm**

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database URL and session secret
```

**Minimum required:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auth_db
SESSION_SECRET=your-random-secret-kept-for-compatibility
JWT_SECRET=your-random-64-char-secret-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
PORT=3001
NODE_ENV=development

# Optional — set only if needed
# COOKIE_DOMAIN=.yourdomain.com     ← for cross-subdomain cookie sharing
# REDIS_PASSWORD=your-redis-password
```

### 3. Create the database

```sql
CREATE DATABASE auth_db;
```

### 4. Push schema or run migrations

```bash
# Development — push schema directly
npm run db:push

# Production — generate & apply migration files
npm run db:generate
npm run db:migrate
```

### 5. Seed the first admin user

After creating your account via `POST /api/auth/register`, promote it to admin directly in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

Once you have an admin, further role changes can be done via the API:
```bash
curl -X PATCH http://localhost:3001/api/admin/users/<userId>/role \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}' \
  --cookie "auth_session=<your-admin-session-token>"
```

### 6. Start the server

```bash
# Development (with hot-reload via nodemon + ts-node)
npm run dev

# Production
npm run build
npm start
```

---

## 📡 API Endpoints

### Auth (`/api/auth`) — Public

| Method | Path | Rate Limit | Description |
|--------|------|------------|-------------|
| `POST` | `/register` | 5 / hr | Create a new account (role defaults to `user`) |
| `POST` | `/login` | 10 / 15 min | Sign in — issues `access_token` + `refresh_token` cookies |
| `POST` | `/refresh` | 10 / 15 min | Rotate refresh token → issue new access + refresh token pair |
| `POST` | `/logout` | — | Sign out (**requires auth**, revokes JWT + refresh token, clears both cookies) |
| `POST` | `/verify-email` | 10 / 15 min | Verify email with token |
| `POST` | `/resend-verification` | 10 / 15 min | Resend verification email |
| `POST` | `/forgot-password` | 3 / 15 min | Request password reset link |
| `POST` | `/reset-password` | 10 / 15 min | Set a new password via reset token (revokes all tokens) |
| `GET`  | `/me` | — | Get current user (**requires auth**) |
| `GET`  | `/google` | — | Redirect to Google OAuth consent (sets CSRF state cookie) |
| `GET`  | `/google/callback` | — | Google OAuth callback (validates CSRF state) |

### User (`/api/user`) — Requires Authentication

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/profile` | Get your full profile (includes `role`) |
| `PATCH`  | `/profile` | Update name or avatar |
| `PATCH`  | `/password` | Change password (revokes all tokens + sessions on all devices) |
| `DELETE` | `/account` | Permanently delete your account (revokes JWT, clears cookies, cascade-deletes all data) |

### Admin (`/api/admin`) — Requires Authentication + Admin Role

All admin routes are protected by the `authenticate` → `authorize("admin")` middleware chain. Non-admin users receive a `403 Forbidden` response. All `:userId` params are validated as UUIDs.

> **Self-action guard:** Admins cannot block, unblock, or change the role of their own account.

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `PATCH` | `/users/:userId/role` | `{ "role": "user" \| "admin" }` | Update a user's role (cannot target self) |
| `PATCH` | `/users/:userId/block` | — | Block a user (kills all sessions, cannot target self) |
| `PATCH` | `/users/:userId/unblock` | — | Unblock a user |
| `GET`   | `/users/:userId/activity` | — | Get login activity audit log |

### Guest (`/api/guest`) — Public

| Method | Path | Description |
|--------|------|-------------|
| `POST`  | `/init` | Create a guest session (sets cookie) |
| `GET`   | `/data` | Get guest session data (cart, prefs) |
| `PATCH` | `/data` | Update guest session data (max 16 KB payload) |

---

## 🔐 Role-Based Access Control (RBAC)

The API uses a simple two-role system defined as a PostgreSQL enum:

| Role | Value | Capabilities |
|------|-------|-------------|
| **User** | `"user"` | Default role. Full access to own profile, sessions, and account |
| **Admin** | `"admin"` | Everything a user can do, plus access to all `/api/admin/*` endpoints |

### How it works

1. **`roleEnum`** — A Postgres enum (`user_role`) with values `"user"` and `"admin"`.
2. **`users.role`** column — Defaults to `"user"` on registration.
3. **`authenticate` middleware** — Validates the session cookie and attaches `req.user` (including `role`) to every request.
4. **`authorize(...roles)` middleware** — Checks that `req.user.role` is in the allowed list. Returns `403` if not.

```typescript
// Example: protect a route for admins only
router.use(authenticate, authorize("admin"));

// Example: allow both admin and user roles
router.use(authenticate, authorize("admin", "user"));
```

### Promoting the first admin

Since there's no admin panel before you have an admin, promote the first user manually:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

---

## 📦 Response Format

Every response follows a consistent JSON structure.

### Success

```json
{
  "success": true,
  "statusCode": 200,
  "message": "✅ Logged in successfully! Welcome back.",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "emailVerified": true
    }
  },
  "timestamp": "2026-02-20T12:00:00.000Z"
}
```

### Error

```json
{
  "success": false,
  "statusCode": 400,
  "message": "❌ Validation failed.",
  "errors": [
    { "field": "password", "message": "Password must be at least 8 characters." }
  ],
  "timestamp": "2026-02-20T12:00:00.000Z"
}
```

### Admin Role Update Success

```json
{
  "success": true,
  "statusCode": 200,
  "message": "✅ User role updated successfully!",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "admin",
      "emailVerified": true
    }
  },
  "timestamp": "2026-02-20T12:00:00.000Z"
}
```

---

## 🔧 Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Core user accounts (includes `role` column — `user` or `admin`) |
| `sessions` | Active login sessions (token stored as **SHA-256 hash**) |
| `guests` | Guest sessions (pre-login, for cart / prefs) |
| `oauth_accounts` | Linked social accounts (Google, etc.) |
| `verification_tokens` | Email verification tokens (stored as **SHA-256 hash**, with expiry) |
| `password_reset_tokens` | Password reset tokens (stored as **SHA-256 hash**, with expiry) |
| `login_activity` | Audit trail — IP, user agent, timestamp, **success/failure status** |

### Enums

| Enum | Values | Used In |
|------|--------|---------|
| `user_role` | `"user"`, `"admin"` | `users.role` column |

Use **Drizzle Studio** to inspect your DB:
```bash
npm run db:studio
```

---

## 🍪 Cookie Strategy

| Cookie | Purpose | HttpOnly | Secure | SameSite | Path | Max-Age |
|--------|---------|----------|--------|----------|------|---------|
| `access_token` | JWT access token (15 min) | ✅ | ✅ (prod) | None (prod) / Lax (dev) | `/` | 15 min |
| `refresh_token` | Opaque refresh token (7 day, one-time use) | ✅ | ✅ (prod) | None (prod) / Lax (dev) | `/api/auth` | 7 days |
| `guest_session` | Guest token | ✅ | ✅ (prod) | Lax | `/` | 7 days |
| `oauth_state` | OAuth CSRF state nonce | ✅ | ✅ (prod) | Lax | `/` | 10 min |

> **`refresh_token` path is `/api/auth`** — the browser only sends it to `/api/auth/refresh` and `/api/auth/logout`, not to every API call. This limits the attack surface of the long-lived cookie.

> **Cross-subdomain sharing** — set `COOKIE_DOMAIN=.yourdomain.com` in `.env` to share cookies across subdomains (e.g., `api.yourdomain.com` + `app.yourdomain.com`). Requires `sameSite: 'none'` + `secure: true`, which is the default in production.

---

## 🛡️ Security Features

### Cryptography & Token Storage
- **bcrypt** password hashing (12 salt rounds via bcryptjs)
- **SHA-256 token hashing** — session tokens, verification tokens, password reset tokens, and refresh tokens are all hashed before storage. Raw tokens are only ever held in HttpOnly cookies or transient in-memory variables; neither the database nor Redis ever stores a reversible token.

### JWT + Refresh Token Security
- **Short-lived JWT access tokens** (15 min, HS256) — verified locally on every request with zero database reads on the happy path
- **Opaque refresh tokens** (7 day) — cryptographically random, SHA-256 hashed before Redis storage; never stored in the database
- **Refresh token rotation** — each call to `POST /refresh` consumes the old token and issues a new one. Old tokens are immediately invalidated in Redis
- **Token family tracking** — each login creates a token family ID stored alongside the refresh token. If a refresh token is replayed (already consumed), the entire family is revoked instantly, protecting against token theft
- **JWT blocklist** — on logout and account delete, the current JWT `jti` is written to Redis with a TTL matching the token's remaining lifetime. Subsequent requests with a blocklisted `jti` are rejected even if the signature is valid
- **Full revocation on critical actions:**
  - `POST /reset-password` → deletes all PG sessions + all Redis refresh tokens for the user
  - `PATCH /password` → deletes all PG sessions + all Redis refresh tokens for the user
  - `PATCH /admin/users/:id/block` → deletes all PG sessions + all Redis refresh tokens for the user
  - `DELETE /user/account` → blocks current JWT jti, deletes all refresh tokens, then cascade-deletes all PG data

### Session Security
- **HttpOnly + Secure + SameSite** cookies for both `access_token` and `refresh_token`
- **PG session tracking** — login sessions are recorded in PostgreSQL (token stored as SHA-256 hash); max 5 concurrent sessions per user; oldest sessions are automatically evicted
- **Blocked users** cannot log in; all sessions and Redis tokens are killed immediately on block

### OAuth Security
- **CSRF state parameter** — Google OAuth flow generates a cryptographic nonce stored in an `oauth_state` HttpOnly cookie. The callback validates the state before processing the authorization code.
- **Blocked-user check on all OAuth paths** — existing OAuth link, email-based link, and new registration all verify the user is not blocked before issuing a session.

### Input Validation & Rate Limiting
- **Zod validation** on all request bodies
- **UUID parameter validation** — all `:userId` route params are validated as UUIDs via `router.param()` middleware, preventing invalid IDs from reaching the database
- **Guest data size limit** — `PATCH /api/guest/data` payload capped at 16 KB to prevent abuse
- **Rate limiting** on auth, signup, password reset, email verification, token refresh, and password reset token redemption endpoints

### Admin Safety
- **Self-action guard** — admins cannot block, unblock, or change the role of their own account
- **Role-based authorization** — admin-only endpoints gated by `authorize("admin")` middleware

### Infrastructure & Observability
- **Helmet** security headers
- **CORS** with credentials support and multi-origin (`CLIENT_URL` accepts comma-separated origins)
- **Trust proxy** configured before all middleware so `req.ip` and rate limiter use the correct client IP behind reverse proxies
- **Request ID tracing** — every response includes an `X-Request-Id` header (propagated from the client or generated via `crypto.randomUUID()`)
- **Periodic cleanup** — hourly background job purges expired sessions, guest sessions, and token records from the database
- **Graceful shutdown** — `SIGINT`/`SIGTERM` handlers close the DB connection pool and clear the cleanup interval

### Race Conditions & Data Integrity
- **Race-condition-safe registration** — uses direct `INSERT` with a `catch` on PostgreSQL unique-violation error code `23505`, avoiding the TOCTOU gap of SELECT-then-INSERT
- **Failed login recording** — both successful and failed login attempts are recorded in the `login_activity` table with IP address and user agent
- **Tokens** with expiry & single-use enforcement (deleted on redemption)
- **No plain-text** passwords ever stored or returned

---

## 📧 Email in Development

In development mode (`NODE_ENV=development`), emails are **not sent** — they're logged to the console with the verification/reset token and URL. No SMTP config needed during development.

For production, configure SMTP in `.env`:
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
EMAIL_FROM=noreply@example.com
```

---

## 🔗 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Set authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
4. Add credentials to `.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
   ```
5. Users who sign in via Google get an `oauth_accounts` record linked to their `users` entry. If the Google email already exists, accounts are automatically linked. The OAuth flow uses a **CSRF state parameter** stored in an HttpOnly cookie to prevent cross-site request forgery. Blocked users are denied access on all OAuth paths.

---

## 📜 Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start with hot-reload (nodemon + ts-node) |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `start` | `npm start` | Run compiled JS (`dist/server.js`) |
| `db:generate` | `npm run db:generate` | Generate SQL migration files |
| `db:migrate` | `npm run db:migrate` | Apply migrations to database |
| `db:push` | `npm run db:push` | Push schema directly (dev) |
| `db:studio` | `npm run db:studio` | Open Drizzle Studio UI |

---

## 📄 License
