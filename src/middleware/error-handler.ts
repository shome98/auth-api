import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { MSG } from '../utils/constants';

// 🚨 Global Error Handler Middleware

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // ── Known operational error ────────────────────────────
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Zod validation error (safety net) ──────────────────
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: MSG.VALIDATION_FAILED,
      errors: err.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
      timestamp: new Date().toISOString(),
    });
  }

  // ── Unexpected / programmer error ──────────────────────
  console.error('💥 Unhandled Error:', err);

  const isDev = env.NODE_ENV === 'development';

  return res.status(500).json({
    success: false,
    statusCode: 500,
    message: MSG.INTERNAL_ERROR,
    errors: null,
    ...(isDev && {
      stack: err.stack,
      raw: err.message,
    }),
    timestamp: new Date().toISOString(),
  });
}
