import { db } from '../db';
import { users, verificationTokens, passwordResetTokens } from '../db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateToken, hashToken } from '../utils/crypto';
import { emailService } from './email.service';
import { sessionService } from './session.service';
import { tokenService } from './token.service';
import { loginActivityService } from './login-activity.service';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
} from '../utils/api-error';
import { TOKEN_EXPIRY } from '../utils/constants';

// 🔐 Auth Service — core authentication business logic

/** Pre-hashed dummy password used to prevent timing-based user enumeration. */
const DUMMY_HASH =
  '$2a$12$LJ3m4ys3Gzl9B9yL9B9yL.DummyHashForTimingAttackMitigationXYZ';

/** Max consecutive failed logins before temporary lockout. */
const MAX_FAILED_ATTEMPTS = 5;
/** Lockout duration in milliseconds (15 minutes). */
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000;

class AuthService {
  // ── Register ───────────────────────────────────────────
  async register(
    email: string,
    password: string,
    name?: string,
    meta?: { ipAddress: string; userAgent: string; clientUrl?: string },
  ) {
    const normalizedEmail = email.toLowerCase().trim();

    // Hash password (do this before DB check so timing is consistent
    // whether or not the email exists — mitigates timing-based enumeration)
    const passwordHash = await hashPassword(password);

    // Try to insert directly — catch unique violation to handle race condition
    let user;
    try {
      const [inserted] = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          name: name ?? null,
          passwordHash,
        })
        .returning();
      user = inserted;
    } catch (error: any) {
      // PostgreSQL unique_violation code: 23505
      // Return same shape as success to prevent email enumeration
      if (error?.code === '23505') {
        // Send a notification to the existing account holder instead
        await emailService
          .sendAccountExistsEmail(normalizedEmail, meta?.clientUrl)
          .catch(() => {});
        return {
          id: 'redacted',
          email: normalizedEmail,
          name: name ?? null,
          image: null,
          role: 'user' as const,
          emailVerified: false,
        };
      }
      throw error;
    }

    // Generate & store verification token (hashed in DB, raw sent via email)
    const token = generateToken();
    await db.insert(verificationTokens).values({
      userId: user.id,
      token: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY.VERIFICATION),
    });

    // Send verification email (non-blocking in dev)
    await emailService.sendVerificationEmail(
      user.email,
      token,
      meta?.clientUrl,
    );

    // Record successful registration activity
    if (meta) {
      await loginActivityService
        .record(user.id, meta.ipAddress, meta.userAgent, true)
        .catch(() => {});
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }

  // ── Login ──────────────────────────────────────────────
  async login(
    email: string,
    password: string,
    meta?: { ipAddress: string; userAgent: string },
  ) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (!user || !user.passwordHash) {
      // Perform a dummy bcrypt compare so the response time is identical
      // to a real comparison — prevents timing-based user enumeration
      await verifyPassword(password, DUMMY_HASH);
      throw new UnauthorizedError('🔐 Invalid email or password.');
    }

    if (user.isBlocked) {
      // Record blocked login attempt
      if (meta) {
        await loginActivityService
          .record(user.id, meta.ipAddress, meta.userAgent, false)
          .catch(() => {});
      }
      throw new ForbiddenError(
        '🚫 Your account has been suspended. Please contact support.',
      );
    }

    // ── Per-account brute-force lockout ──────────────────
    const recentFailures = await loginActivityService.countRecentFailures(
      user.id,
      ACCOUNT_LOCKOUT_MS,
    );
    if (recentFailures >= MAX_FAILED_ATTEMPTS) {
      throw new ForbiddenError(
        '🔒 Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.',
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      // Record failed login attempt
      if (meta) {
        await loginActivityService
          .record(user.id, meta.ipAddress, meta.userAgent, false)
          .catch(() => {});
      }
      throw new UnauthorizedError('🔐 Invalid email or password.');
    }

    // Update last login timestamp
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Record successful login attempt
    if (meta) {
      await loginActivityService
        .record(user.id, meta.ipAddress, meta.userAgent, true)
        .catch(() => {});
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }

  // ── Verify Email ───────────────────────────────────────
  async verifyEmail(token: string) {
    const tokenHash = hashToken(token);
    const record = await db.query.verificationTokens.findFirst({
      where: eq(verificationTokens.token, tokenHash),
    });

    if (!record) {
      throw new BadRequestError('❌ Invalid verification token.');
    }

    if (record.expiresAt < new Date()) {
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.id, record.id));
      throw new BadRequestError(
        '⏰ Verification token has expired. Please request a new one.',
      );
    }

    // Mark user as verified & clean up tokens
    await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, record.userId));

    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.userId, record.userId));
  }

  // ── Resend Verification ────────────────────────────────
  async resendVerification(email: string, clientUrl?: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    });

    // Don't reveal whether the user exists
    if (!user) return;

    // Silently return if already verified — don't reveal status
    if (user.emailVerified) return;

    // Rotate token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.userId, user.id));

    const token = generateToken();
    await db.insert(verificationTokens).values({
      userId: user.id,
      token: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY.VERIFICATION),
    });

    await emailService.sendVerificationEmail(user.email, token, clientUrl);
  }

  // ── Forgot Password ───────────────────────────────────
  async forgotPassword(email: string, clientUrl?: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    });

    // Don't reveal whether the user exists
    if (!user) return;

    // Rotate reset tokens
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    const token = generateToken();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY.PASSWORD_RESET),
    });

    await emailService.sendPasswordResetEmail(user.email, token, clientUrl);
  }

  // ── Reset Password ────────────────────────────────────
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const record = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, tokenHash),
        eq(passwordResetTokens.used, false),
      ),
    });

    if (!record) {
      throw new BadRequestError('❌ Invalid or already-used reset token.');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestError(
        '⏰ Reset token has expired. Please request a new one.',
      );
    }

    // Update password
    const passwordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, record.userId));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, record.id));

    // Invalidate ALL existing PG sessions (security)
    await sessionService.deleteAllUserSessions(record.userId);

    // Fix Issue 5: Also purge all Redis refresh tokens so no device
    // can silently re-authenticate after a password reset
    await tokenService.deleteAllRefreshTokensForUser(record.userId);
  }

  // ── Cleanup Expired Tokens ─────────────────────────────
  /** Remove expired verification & password reset tokens. */
  async cleanupExpiredTokens() {
    await db
      .delete(verificationTokens)
      .where(lt(verificationTokens.expiresAt, new Date()));
    await db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, new Date()));
  }
}

export const authService = new AuthService();
