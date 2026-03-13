import rateLimit from 'express-rate-limit';
import { MSG } from '../utils/constants';

// 🛡️ Rate Limiting Middleware

const rateLimitResponse = (message: string) => ({
  success: false,
  statusCode: 429,
  message,
  data: null,
  timestamp: new Date().toISOString(),
});

/** Global: 100 requests per 15 min per IP */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(MSG.RATE_LIMITED),
});

/** Auth routes: 10 requests per 15 min per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    '🚫 Too many authentication attempts. Please try again in 15 minutes.',
  ),
});

/** Password reset: 3 requests per 15 min per IP */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    '🚫 Too many password reset requests. Please try again later.',
  ),
});

/** Signup: 5 requests per 60 min per IP */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    '🚫 Too many sign-up attempts. Please try again in an hour.',
  ),
});
