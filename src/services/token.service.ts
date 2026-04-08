import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { redis } from '../lib/redis';
import { generateSecureToken, hashToken } from '../utils/crypto';
import { env } from '../config/env';

/*
🔑 Token Service — JWT Access + Opaque Refresh
Access Token  (JWT, short-lived ~15m)
  • Stored as cookie: access_token
  • Payload: { userId, sessionToken, role, jti }  ← jti set via SignOptions.jwtid
  • Verified locally — zero DB / Redis hit per request
  • On logout → jti added to Redis blocklist until natural expiry
Refresh Token  (opaque, long-lived ~7d)
  • Stored as cookie: refresh_token  (path: /api/auth)
  • SHA-256 hashed before storing in Redis
  • Supports token family rotation — detects refresh-token theft
  • Redis key: refresh:{hash}  → { userId, sessionToken, family }
*/

// ── Redis key prefixes ────────────────────────────────────
const REFRESH_PREFIX = 'refresh:';
const BLOCKLIST_PREFIX = 'blocked:';

// ── JWT payload shape ─────────────────────────────────────
export interface AccessTokenPayload {
  userId: string;
  email?: string;
  /** Raw session token from the PG sessions table (passed through for other services) */
  sessionToken: string;
  /** Unique token ID — used for blocklisting on logout */
  jti: string;
  /**
   * User role — embedded so consumer services (crud-factory-registry-api,
   * payments-subs-api) can authorise without an extra DB call.
   * Values mirror the DB enum: 'user' | 'admin'
   */
  role: string;
  /** Standard JWT expiry claim — seconds since epoch */
  exp?: number;
  iat?: number;
}

export interface RefreshTokenData {
  userId: string;
  email?: string;
  sessionToken: string;
  /**
   * User role — carried through token rotation so that re-issued access
   * tokens always reflect the correct role without a DB round-trip.
   */
  role: string;
  /** Token family — all rotated tokens share a family. Re-use of an old
   *  family member signals theft → entire family is invalidated. */
  family: string;
}

// ─────────────────────────────────────────────────────────
class TokenService {
  // ── Access Token ────────────────────────────────────────

  /**
   * Issue a signed JWT access token.
   *
   * The raw session token from PG is embedded so downstream
   * services can identify the exact PG session if needed.
   *
   * `role` is now embedded so consumer services (crud-factory-registry-api,
   * payments-subs-api) can authorise admin routes without a DB call.
   */
  generateAccessToken(
    userId: string,
    sessionToken: string,
    role: string,
    email: string,
  ): { token: string; jti: string; expiresIn: number } {
    const jti = crypto.randomUUID();
    const expiresIn = env.JWT_EXPIRES_IN; // e.g. "15m"

    // jti is set via options.jwtid — jsonwebtoken writes it as payload.jti automatically.
    // Do NOT also add jti to the payload object; that would duplicate the claim.
    const payload: Omit<AccessTokenPayload, 'jti'> = {
      userId,
      email,
      sessionToken,
      role,
    };

    const options: SignOptions = {
      expiresIn: expiresIn as SignOptions['expiresIn'],
      jwtid: jti, // sets payload.jti in the signed token
    };

    const token = jwt.sign(payload, env.JWT_SECRET, options);

    // Convert expiry string to ms for cookie maxAge
    const expiresInMs = this.parseExpiryToMs(expiresIn);

    return { token, jti, expiresIn: expiresInMs };
  }

  /**
   * Verify a JWT access token.
   * Returns the decoded payload or null if invalid / expired.
   */
  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    } catch {
      return null;
    }
  }

  /**
   * Decode a JWT without verification (useful for extracting jti on logout
   * even when the token is expired).
   */
  decodeAccessToken(token: string): AccessTokenPayload | null {
    try {
      return jwt.decode(token) as AccessTokenPayload;
    } catch {
      return null;
    }
  }

  // ── Refresh Token ────────────────────────────────────────

  /**
   * Generate an opaque refresh token, store its hash in Redis with
   * { userId, sessionToken, role, family }.
   *
   * `role` is persisted so that rotation (refresh → new access token) can
   * re-embed the role without a DB round-trip.
   *
   * Returns the raw token (sent to client as httpOnly cookie).
   */
  async generateRefreshToken(
    userId: string,
    sessionToken: string,
    role: string,
    email: string,
    family?: string,
  ): Promise<string> {
    const rawToken = generateSecureToken(64);
    const tokenHash = hashToken(rawToken);
    const tokenFamily = family ?? crypto.randomUUID();

    const ttl = this.parseExpiryToMs(env.JWT_REFRESH_EXPIRES_IN) / 1000; // seconds for Redis

    const data: RefreshTokenData = {
      userId,
      email,
      sessionToken,
      role,
      family: tokenFamily,
    };

    await redis.setex(
      `${REFRESH_PREFIX}${tokenHash}`,
      Math.floor(ttl),
      JSON.stringify(data),
    );

    return rawToken;
  }

  /**
   * Consume a refresh token:
   * 1. Hash the raw token
   * 2. Look up in Redis
   * 3. Delete it immediately (rotation — one-time use)
   * 4. Returns stored data or null if not found / expired
   */
  async consumeRefreshToken(
    rawToken: string,
  ): Promise<RefreshTokenData | null> {
    const tokenHash = hashToken(rawToken);
    const key = `${REFRESH_PREFIX}${tokenHash}`;

    const stored = await redis.get(key);
    if (!stored) return null;

    // Delete immediately — prevents replay
    await redis.del(key);

    return JSON.parse(stored) as RefreshTokenData;
  }

  /**
   * Revoke all refresh tokens belonging to a token family.
   * Called when a family member re-use is detected (token theft).
   * NOTE: Requires a scan — use sparingly. Better to rely on short TTL.
   */
  async revokeTokenFamily(family: string): Promise<void> {
    // Scan for all refresh keys and remove those matching the family
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${REFRESH_PREFIX}*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        const data: RefreshTokenData = JSON.parse(raw);
        if (data.family === family) {
          await redis.del(key);
        }
      }
    } while (cursor !== '0');
  }

  /**
   * Delete a specific refresh token by its raw value (e.g. on logout).
   */
  async deleteRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await redis.del(`${REFRESH_PREFIX}${tokenHash}`);
  }

  /**
   * Delete ALL refresh tokens for a userId (e.g. password change, account delete).
   * NOTE: Requires a scan — acceptable for low-frequency events.
   */
  async deleteAllRefreshTokensForUser(userId: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${REFRESH_PREFIX}*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        const data: RefreshTokenData = JSON.parse(raw);
        if (data.userId === userId) {
          await redis.del(key);
        }
      }
    } while (cursor !== '0');
  }

  // ── Blocklist ────────────────────────────────────────────

  /**
   * Add a JWT jti to the blocklist.
   * TTL is set to the token's remaining lifetime so Redis auto-cleans it.
   */
  async blockAccessToken(jti: string, expiresAt: number): Promise<void> {
    const ttlSeconds = Math.max(expiresAt - Math.floor(Date.now() / 1000), 0);
    if (ttlSeconds > 0) {
      await redis.setex(`${BLOCKLIST_PREFIX}${jti}`, ttlSeconds, '1');
    }
  }

  /**
   * Check if a JWT jti is blocklisted.
   */
  async isAccessTokenBlocked(jti: string): Promise<boolean> {
    const result = await redis.exists(`${BLOCKLIST_PREFIX}${jti}`);
    return result === 1;
  }

  // ── Internal helpers ─────────────────────────────────────

  /** Expose refresh token max age in ms — used by controller for cookie maxAge. */
  getRefreshMaxAgeMs(): number {
    return this.parseExpiryToMs(env.JWT_REFRESH_EXPIRES_IN);
  }

  private parseExpiryToMs(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000; // default 15m

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] ?? 60 * 1000);
  }
}

export const tokenService = new TokenService();
