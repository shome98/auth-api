import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import {
  authLimiter,
  signupLimiter,
  passwordResetLimiter,
} from '../middleware/rate-limiter';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.schema';

// 🔐 Auth Routes — /api/auth

const router = Router();

// Registration
router.post(
  '/register',
  signupLimiter,
  validate(registerSchema),
  authController.register,
);

// Login
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// Logout — authenticate populates req.sessionToken for PG session cleanup
// If access_token is already expired the client should call /refresh first
// or the PG session cleanup is skipped (non-critical, expires naturally)
router.post('/logout', authenticate, authController.logout);

// Refresh token — issues new access + refresh token pair
router.post('/refresh', authLimiter, authController.refresh);

// Email verification
router.post(
  '/verify-email',
  authLimiter,
  validate(verifyEmailSchema),
  authController.verifyEmail,
);
router.post(
  '/resend-verification',
  authLimiter,
  validate(resendVerificationSchema),
  authController.resendVerification,
);

// Password reset
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

// Current user (requires auth)
router.get('/me', authenticate, authController.getMe);

// Google OAuth
router.get('/google', authLimiter, authController.googleAuth);
router.get('/google/callback', authLimiter, authController.googleCallback);

export default router;
