import { CookieOptions } from "express";
import { env } from "../config/env";

// ═══════════════════════════════════════════════════════════
// 🍪 Cookie Option Helpers
// ═══════════════════════════════════════════════════════════

/**
 * Build secure cookie options.
 * @param maxAgeDays – cookie lifetime in days
 */
export function getCookieOptions(maxAgeDays: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

/** Options to clear a cookie (must match path / domain used to set it). */
export function getClearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

// ═══════════════════════════════════════════════════════════
// 🍪 JWT Cookie Helpers — Access + Refresh Token
// sameSite: 'none' + secure: true required for cross-subdomain
// ═══════════════════════════════════════════════════════════

/**
 * Cookie options for the short-lived JWT access token.
 * @param maxAgeMs — lifetime in milliseconds (e.g. 15 * 60 * 1000)
 */
export function getAccessTokenCookieOptions(maxAgeMs: number): CookieOptions {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    // 'none' allows cross-subdomain sharing (requires secure: true)
    sameSite: isProd ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

/**
 * Cookie options for the long-lived opaque refresh token.
 * Path is /api/auth so it is sent to both:
 *   POST /api/auth/refresh  (rotation)
 *   POST /api/auth/logout   (deletion)
 * but NOT on regular /api/* calls — limits exposure.
 * @param maxAgeMs — lifetime in milliseconds (e.g. 7 * 24 * 60 * 60 * 1000)
 */
export function getRefreshTokenCookieOptions(maxAgeMs: number): CookieOptions {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/api/auth",   // covers /refresh AND /logout
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

/** Clear options for JWT access token cookie. */
export function getClearAccessTokenOptions(): CookieOptions {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

/** Clear options for JWT refresh token cookie. */
export function getClearRefreshTokenOptions(): CookieOptions {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/auth",   // must match the path used when setting
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}
