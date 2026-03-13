import { OAuth2Client } from 'google-auth-library';
import { db } from '../db';
import { users, oauthAccounts } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { env } from '../config/env';
import { BadRequestError, ForbiddenError } from '../utils/api-error';
import { loginActivityService } from './login-activity.service';

// 🔗 Google OAuth Service

class GoogleOAuthService {
  private client: OAuth2Client | null = null;

  private getClient(): OAuth2Client {
    if (!this.client) {
      if (
        !env.GOOGLE_CLIENT_ID ||
        !env.GOOGLE_CLIENT_SECRET ||
        !env.GOOGLE_CALLBACK_URL
      ) {
        throw new BadRequestError(
          '🔧 Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL in your .env file.',
        );
      }
      this.client = new OAuth2Client(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_CALLBACK_URL,
      );
    }
    return this.client;
  }

  /** Generate the Google consent screen URL with CSRF state. */
  getAuthUrl(state: string): string {
    const client = this.getClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'consent',
      state,
    });
  }

  /**
   * Handle the OAuth callback:
   * 1. Exchange code for tokens
   * 2. Get user info from ID token
   * 3. Find or create user + link OAuth account
   */
  async handleCallback(
    code: string,
    meta?: { ipAddress: string; userAgent: string },
  ) {
    const client = this.getClient();

    // Exchange code for tokens
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new BadRequestError('❌ Failed to obtain ID token from Google.');
    }

    // Verify ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID!,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      throw new BadRequestError('❌ Could not retrieve user info from Google.');
    }

    const { email, name, picture, sub: googleId } = payload;

    // ── 1. Check if this Google account is already linked ──
    const existingOAuth = await db.query.oauthAccounts.findFirst({
      where: and(
        eq(oauthAccounts.provider, 'google'),
        eq(oauthAccounts.providerAccountId, googleId),
      ),
      with: { user: true },
    });

    if (existingOAuth) {
      // Block check — suspended users cannot log in via OAuth
      if (existingOAuth.user.isBlocked) {
        throw new ForbiddenError(
          '🚫 Your account has been suspended. Please contact support.',
        );
      }

      await db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, existingOAuth.userId));

      // Record successful OAuth login
      if (meta) {
        await loginActivityService
          .record(existingOAuth.user.id, meta.ipAddress, meta.userAgent, true)
          .catch(() => {});
      }

      return {
        user: {
          id: existingOAuth.user.id,
          email: existingOAuth.user.email,
          name: existingOAuth.user.name,
          image: existingOAuth.user.image,
          role: existingOAuth.user.role,
          emailVerified: existingOAuth.user.emailVerified,
        },
        isNewUser: false,
      };
    }

    // ── 2. Check if a user with the same email already exists ──
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      // Block check — suspended users cannot log in via OAuth
      if (existingUser.isBlocked) {
        throw new ForbiddenError(
          '🚫 Your account has been suspended. Please contact support.',
        );
      }

      // Link Google account to existing user
      await db.insert(oauthAccounts).values({
        userId: existingUser.id,
        provider: 'google',
        providerAccountId: googleId,
      });

      // Mark email as verified (Google already verified it)
      if (!existingUser.emailVerified) {
        await db
          .update(users)
          .set({
            emailVerified: true,
            image: existingUser.image ?? picture ?? null,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));
      } else {
        await db
          .update(users)
          .set({ lastLoginAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, existingUser.id));
      }

      // Record successful OAuth login (email-linked account)
      if (meta) {
        await loginActivityService
          .record(existingUser.id, meta.ipAddress, meta.userAgent, true)
          .catch(() => {});
      }

      return {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          image: existingUser.image ?? picture ?? null,
          role: existingUser.role,
          emailVerified: true,
        },
        isNewUser: false,
      };
    }

    // ── 3. Create brand-new user ────────────────────────────
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        name: name ?? null,
        image: picture ?? null,
        emailVerified: true, // Google already verified
        lastLoginAt: new Date(),
      })
      .returning();

    await db.insert(oauthAccounts).values({
      userId: newUser.id,
      provider: 'google',
      providerAccountId: googleId,
    });

    // Record successful OAuth registration
    if (meta) {
      await loginActivityService
        .record(newUser.id, meta.ipAddress, meta.userAgent, true)
        .catch(() => {});
    }

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        image: newUser.image,
        role: newUser.role,
        emailVerified: newUser.emailVerified,
      },
      isNewUser: true,
    };
  }
}

export const googleOAuthService = new GoogleOAuthService();
