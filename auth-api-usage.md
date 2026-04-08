# Auth API Usage Guide

This guide is for frontend developers and LLM agents who need to consume the API without re-reading the backend code.

The project/package name is `auth-api`, and the app identifies itself as a personal auth API.

## 1. Quick Summary

- Base API groups:
  - `/api/auth`
  - `/api/user`
  - `/api/admin`
  - `/api/guest`
- Auth model:
  - `access_token` cookie: short-lived JWT, `HttpOnly`
  - `refresh_token` cookie: long-lived opaque token, `HttpOnly`
- Client requirement:
  - always send requests with credentials/cookies enabled
- Response style:
  - mostly standardized JSON envelope with `success`, `statusCode`, `message`, and `timestamp`
- Request body format:
  - JSON

## 2. Base URL and Transport Expectations

Use the backend origin as your base URL, for example:

```ts
const API_BASE_URL = "http://localhost:3000";
```

The server enables CORS with `credentials: true`, so the frontend must also opt into credentials.

Examples:

```ts
await fetch(`${API_BASE_URL}/api/auth/me`, {
  method: "GET",
  credentials: "include",
});
```

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});
```

## 3. Authentication Model

This API is cookie-based, not bearer-token-in-header based.

- Do not try to read `access_token` or `refresh_token` in frontend JS.
- Both auth cookies are `HttpOnly`.
- You authenticate by sending requests with cookies included.
- When the access token expires, call `POST /api/auth/refresh`.
- The refresh cookie is only sent to `/api/auth/*` routes because its cookie path is scoped to `/api/auth`.

### Important FE implication

If an authenticated endpoint returns `401` with a session-expired message, the usual recovery flow is:

1. call `POST /api/auth/refresh`
2. if refresh succeeds, retry the original request once
3. if refresh fails, treat the user as logged out

## 4. Standard Response Shapes

### Success shape

Most success responses look like:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Some message",
  "data": {},
  "timestamp": "2026-03-31T12:00:00.000Z"
}
```

### Error shape

Most errors look like:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Some error message",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address."
    }
  ],
  "timestamp": "2026-03-31T12:00:00.000Z"
}
```

### Notes

- Validation errors use `errors`.
- Success responses use `data`.
- A `404` route-not-found response returns `data: null`.
- Rate-limited responses return `429`.
- Every response includes `X-Request-Id`.

## 5. Auth Endpoints

## `POST /api/auth/register`

Creates an account and immediately logs the user in by setting auth cookies.

Request body:

```json
{
  "email": "alice@example.com",
  "password": "StrongPass1!",
  "name": "Alice"
}
```

Validation rules:

- `email`: valid email
- `password`: min 8, max 100, must include uppercase, lowercase, number, special char
- `name`: optional, min 2, max 100

Success:

- status: `201`
- sets `access_token`
- sets `refresh_token`
- clears guest session if present

Response data:

```json
{
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "name": "Alice",
    "image": null,
    "role": "user",
    "emailVerified": false
  }
}
```

Special behavior:

- if the email already exists, the service intentionally avoids clear email enumeration
- frontend should trust `success` and current auth state, not infer existence from timing/message differences

Rate limit:

- `5` requests per hour per IP

## `POST /api/auth/login`

Logs in with email/password and sets auth cookies.

Request body:

```json
{
  "email": "alice@example.com",
  "password": "StrongPass1!"
}
```

Success:

- status: `200`
- sets `access_token`
- sets `refresh_token`
- clears guest session if present

Response data:

```json
{
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "name": "Alice",
    "image": null,
    "role": "user",
    "emailVerified": true
  }
}
```

Common failures:

- `401`: invalid email/password
- `403`: blocked account
- `403`: temporary lockout after too many failed attempts

Rate limit:

- `10` requests per 15 minutes per IP

## `POST /api/auth/logout`

Logs the user out and clears auth cookies.

Request:

- no body
- requires current authenticated access cookie

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out successfully",
  "data": null
}
```

Note:

- if your access token is already expired, the backend comment suggests refreshing first before logout for full session cleanup

## `POST /api/auth/refresh`

Rotates the refresh token and issues a fresh auth cookie pair.

Request:

- no body
- requires `refresh_token` cookie

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed successfully.",
  "data": null
}
```

Failure:

- `401` if refresh token is missing, expired, consumed already, or invalid
- when refresh fails, cookies may also be cleared by the backend

Recommended client logic:

```ts
async function requestWithRefresh(input: RequestInfo, init: RequestInit = {}) {
  const res = await fetch(input, { ...init, credentials: "include" });

  if (res.status !== 401) return res;

  const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!refreshRes.ok) return res;

  return fetch(input, { ...init, credentials: "include" });
}
```

## `GET /api/auth/me`

Returns the currently authenticated user from the request context.

Request:

- no body
- requires auth cookie

Response data:

```json
{
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "name": "Alice",
    "image": null,
    "role": "user",
    "emailVerified": true
  }
}
```

Use this:

- on app boot
- after refresh
- after login/register redirect flows

## `POST /api/auth/verify-email`

Request body:

```json
{
  "token": "raw-verification-token"
}
```

Success:

- `200`
- no important response data

Failures:

- `400` invalid token
- `400` expired token

## `POST /api/auth/resend-verification`

Request body:

```json
{
  "email": "alice@example.com"
}
```

Success:

- always safe to show a generic success toast
- backend intentionally avoids exposing user existence/verification state

## `POST /api/auth/forgot-password`

Request body:

```json
{
  "email": "alice@example.com"
}
```

Success:

- generic success message even when account does not exist

Rate limit:

- `3` requests per 15 minutes per IP

## `POST /api/auth/reset-password`

Request body:

```json
{
  "token": "raw-reset-token",
  "password": "NewStrongPass1!"
}
```

Success:

- `200`
- no auto-login
- existing sessions/refresh tokens are revoked

Failures:

- `400` invalid token
- `400` already-used token
- `400` expired token

## 6. Google OAuth Flow

## `GET /api/auth/google`

Starts Google login.

Behavior:

- backend sets temporary cookies for OAuth state and redirect origin
- backend redirects the browser to Google

Frontend recommendation:

- use a full-page browser navigation, not AJAX

Example:

```ts
window.location.href = `${API_BASE_URL}/api/auth/google`;
```

## `GET /api/auth/google/callback`

This is a browser redirect endpoint, not a normal SPA fetch target.

Behavior:

- validates state cookie
- logs user in
- sets auth cookies
- redirects back to an allowed client URL

Failure behavior:

- can redirect to `/auth/error?message=...` on the frontend origin

## 7. User Endpoints

All `/api/user/*` endpoints require authentication.

## `GET /api/user/profile`

Response data:

```json
{
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "name": "Alice",
    "image": null,
    "role": "user",
    "emailVerified": true,
    "createdAt": "2026-03-31T12:00:00.000Z"
  }
}
```

## `PATCH /api/user/profile`

Request body:

```json
{
  "name": "Alice Smith",
  "image": "https://example.com/avatar.png"
}
```

Rules:

- `name` optional, min 2
- `image` optional, must be a valid URL, may be `null`

Response data:

```json
{
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "name": "Alice Smith",
    "image": "https://example.com/avatar.png",
    "role": "user",
    "emailVerified": true
  }
}
```

## `PATCH /api/user/password`

Request body:

```json
{
  "currentPassword": "OldStrongPass1!",
  "newPassword": "NewStrongPass1!"
}
```

Rules:

- new password follows the same strong password rules as registration

Success:

- all other sessions are invalidated
- all refresh tokens for the user are purged
- current request still succeeds

Frontend implication:

- after password change, other tabs/devices should expect auth loss
- current tab may later need refresh/login again depending on token state

Special failure:

- social-login-only users cannot change password and get `400`

## `DELETE /api/user/account`

Deletes the logged-in account.

Success:

- clears auth cookies
- removes account and related data

Frontend action after success:

- clear local auth state
- redirect to public/landing/login page

## 8. Guest Endpoints

Guest support is useful for carts, preferences, or pre-login draft state.

The guest session is also cookie-based using `guest_session`.

## `POST /api/guest/init`

Creates a guest session if one does not already exist.

Success data:

```json
{
  "guestId": "uuid",
  "data": {}
}
```

If a valid guest session already exists, the API returns `200` and the existing guest payload instead of creating a new one.

## `GET /api/guest/data`

Possible outcomes:

- no guest cookie: `200` with `data: { "data": null }`
- expired/missing guest record: `200` with `data: { "data": null }` and guest cookie cleared
- active guest session: returns `guestId` and `data`

Active-session response data:

```json
{
  "guestId": "uuid",
  "data": {
    "cart": [],
    "theme": "dark"
  }
}
```

## `PATCH /api/guest/data`

Request body must be a flat JSON object. It is merged shallowly into existing guest data.

Example:

```json
{
  "cart": [
    {
      "productId": "p1",
      "qty": 2
    }
  ],
  "theme": "light"
}
```

Rules:

- body must be a JSON object
- payload must stay under `16 KB`
- merge is shallow, not deep

Failure cases:

- `400` if there is no guest session
- `400` if the guest session expired

Important behavior on login/register:

- guest session is deleted after successful login/register/OAuth callback
- the backend currently deletes guest data but does not merge it into a user profile/cart automatically

## 9. Admin Endpoints

All `/api/admin/*` endpoints require:

- valid auth cookies
- authenticated user with `role === "admin"`

Non-admin users get `403`.

## `GET /api/admin/users?page=1&limit=20`

Returns a paginated user list.

Response data:

```json
{
  "users": [
    {
      "id": "uuid",
      "email": "alice@example.com",
      "name": "Alice",
      "role": "user",
      "emailVerified": true,
      "isBlocked": false,
      "createdAt": "2026-03-31T12:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

Notes:

- `limit` is capped at `100`

## `PATCH /api/admin/users/:userId/role`

Request body:

```json
{
  "role": "admin"
}
```

Rules:

- `userId` must be a UUID v4
- role must be `"user"` or `"admin"`

Response data:

```json
{
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "name": "Alice",
    "role": "admin"
  }
}
```

Important:

- admin cannot change their own role

## `PATCH /api/admin/users/:userId/block`

Blocks the user and kills active sessions/refresh tokens.

Important:

- admin cannot block themselves

## `PATCH /api/admin/users/:userId/unblock`

Unblocks the user.

## `GET /api/admin/users/:userId/activity`

Returns recent login activity for a user.

Response data:

```json
{
  "activity": [
    {
      "id": "uuid",
      "userId": "uuid",
      "ipAddress": "127.0.0.1",
      "userAgent": "Mozilla/5.0 ...",
      "success": true,
      "createdAt": "2026-03-31T12:00:00.000Z"
    }
  ]
}
```

## `DELETE /api/admin/users/:userId`

Deletes another user account.

Important:

- admin cannot delete themselves via this endpoint

## 10. Validation Rules That Matter to FE

### Strong password rule

Used in registration and password reset/change:

- minimum 8 characters
- maximum 100 characters
- at least 1 uppercase letter
- at least 1 lowercase letter
- at least 1 number
- at least 1 special character

### UUID route param validation

Admin `:userId` params must be UUID v4.

### Request size

- JSON body parser limit: `10kb`
- guest data custom limit: `16kb`

For normal FE requests, keep payloads small.

## 11. Common Status Codes

- `200`: success
- `201`: created
- `400`: validation or bad request
- `401`: unauthenticated or expired session
- `403`: authenticated but forbidden, blocked, or temporarily locked
- `404`: missing resource or route
- `429`: rate limited
- `500`: server error

## 12. Recommended Frontend Integration Pattern

## App startup

1. load app
2. call `GET /api/auth/me`
3. if `200`, store user
4. if `401`, try `POST /api/auth/refresh`
5. if refresh succeeds, call `/api/auth/me` again
6. if refresh fails, mark user logged out

## Login flow

1. call `POST /api/auth/login`
2. on success, update user state from `data.user`
3. optionally call `/api/user/profile` if you need the full profile shape

## Logout flow

1. call `POST /api/auth/logout`
2. clear app-side auth state
3. redirect to login/public route

## Protected request wrapper

- send credentials on every request
- if response is `401`, try one refresh
- retry original request once only
- if still failing, log user out locally

## 13. TypeScript Shapes You Can Reuse Client-Side

```ts
export type ApiSuccess<T> = {
  success: true;
  statusCode: number;
  message: string;
  data: T | null;
  timestamp: string;
};

export type ApiError = {
  success: false;
  statusCode: number;
  message: string;
  errors?: Array<{ field?: string; message: string }> | null;
  timestamp: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "user" | "admin";
  emailVerified: boolean;
};
```

## 14. FE and LLM Gotchas

- This is cookie auth, so `Authorization: Bearer ...` is not the main integration path.
- `withCredentials` / `credentials: "include"` is mandatory.
- Refresh token is not sent to all routes because its cookie path is `/api/auth`.
- Guest data update is shallow merge, so replacing nested objects should be done carefully.
- Login/register removes the guest session, but does not perform domain-specific merge logic for you.
- Some endpoints intentionally return generic messages to prevent account enumeration.
- Admin routes include extra endpoints beyond the README basics:
  - `GET /api/admin/users`
  - `DELETE /api/admin/users/:userId`

## 15. Minimal Endpoint Checklist

For a normal auth-enabled frontend, the minimum endpoints you will likely use are:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET /api/user/profile`
- `PATCH /api/user/profile`
- `PATCH /api/user/password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

For guest-aware commerce/pre-login UX:

- `POST /api/guest/init`
- `GET /api/guest/data`
- `PATCH /api/guest/data`

For admin panels:

- `GET /api/admin/users`
- `PATCH /api/admin/users/:userId/role`
- `PATCH /api/admin/users/:userId/block`
- `PATCH /api/admin/users/:userId/unblock`
- `GET /api/admin/users/:userId/activity`
- `DELETE /api/admin/users/:userId`
