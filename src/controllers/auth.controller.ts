import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { authService } from '../services/auth.service';
import { sessionService } from '../services/session.service';
import { guestService } from '../services/guest.service';
import { googleOAuthService } from '../services/google-oauth.service';
import { tokenService } from '../services/token.service';
import { db } from '../db';
import { users } from '../db/schema';
import { ApiResponse } from '../utils/api-response';
import { BadRequestError, UnauthorizedError } from '../utils/api-error';
import { COOKIE_NAMES, JWT_COOKIE_NAMES, MSG } from '../utils/constants';
import {
  getClearCookieOptions,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getClearAccessTokenOptions,
  getClearRefreshTokenOptions,
} from '../utils/cookie';
import { generateToken } from '../utils/crypto';
import { env, getAllowedClientUrl, getPrimaryClientUrl } from '../config/env';

// 🔐 Auth Controller

class AuthController {
  private readonly clientUrl = getPrimaryClientUrl();

  // POST /api/auth/register
  register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password, name } = req.body;
      const user = await authService.register(email, password, name, {
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? 'unknown',
        clientUrl: this.resolveClientUrl(req),
      });

      // [SESSION] Create PG session — kept for reference
      // const session = await sessionService.createSession(
      //   user.id,
      //   req.ip ?? undefined,
      //   req.headers["user-agent"]
      // );
      // res.cookie(COOKIE_NAMES.SESSION, session.rawToken, getCookieOptions(env.SESSION_MAX_AGE_DAYS));
      //

      // [JWT] Create PG session + issue JWT + refresh token
      const session = await sessionService.createSession(
        user.id,
        req.ip ?? undefined,
        req.headers['user-agent'],
      );
      await this.issueTokenPair(
        res,
        user.id,
        session.rawToken,
        user.role,
        user.email,
      );

      // Clean up guest session if applicable
      await this.cleanupGuest(req, res);

      ApiResponse.created(res, MSG.REGISTER_SUCCESS, { user });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/auth/login
  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password } = req.body;
      const user = await authService.login(email, password, {
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? 'unknown',
      });

      // [SESSION] Create PG session — kept for reference
      // const session = await sessionService.createSession(
      //   user.id,
      //   req.ip ?? undefined,
      //   req.headers["user-agent"]
      // );
      // res.cookie(COOKIE_NAMES.SESSION, session.rawToken, getCookieOptions(env.SESSION_MAX_AGE_DAYS));

      // [JWT] Create PG session + issue JWT + refresh token ─
      const session = await sessionService.createSession(
        user.id,
        req.ip ?? undefined,
        req.headers['user-agent'],
      );
      await this.issueTokenPair(
        res,
        user.id,
        session.rawToken,
        user.role,
        user.email,
      );
      //

      // Merge guest → user
      await this.cleanupGuest(req, res);

      ApiResponse.ok(res, MSG.LOGIN_SUCCESS, { user });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/auth/logout ─
  logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // [SESSION] Delete PG session — kept for reference
      // const token = req.cookies?.[COOKIE_NAMES.SESSION];
      // if (token) await sessionService.deleteSession(token);
      // res.clearCookie(COOKIE_NAMES.SESSION, getClearCookieOptions());

      // [JWT] Blocklist access token jti + delete refresh token
      const accessToken = req.cookies?.[JWT_COOKIE_NAMES.ACCESS_TOKEN];
      if (accessToken) {
        // Decode even if expired to get jti for blocklisting
        const payload = tokenService.decodeAccessToken(accessToken);
        if (payload?.jti && payload?.exp) {
          await tokenService.blockAccessToken(payload.jti, payload.exp);
        }
      }

      const refreshToken = req.cookies?.[JWT_COOKIE_NAMES.REFRESH_TOKEN];
      if (refreshToken) {
        await tokenService.deleteRefreshToken(refreshToken);
      }

      // Also clean up the PG session (sessionToken is in JWT payload)
      if (req.sessionToken) {
        await sessionService.deleteSession(req.sessionToken);
      }

      res.clearCookie(
        JWT_COOKIE_NAMES.ACCESS_TOKEN,
        getClearAccessTokenOptions(),
      );
      res.clearCookie(
        JWT_COOKIE_NAMES.REFRESH_TOKEN,
        getClearRefreshTokenOptions(),
      );

      ApiResponse.ok(res, MSG.LOGOUT_SUCCESS);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/auth/verify-email
  verifyEmail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await authService.verifyEmail(req.body.token);
      ApiResponse.ok(res, MSG.EMAIL_VERIFIED);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/auth/resend-verification
  resendVerification = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await authService.resendVerification(
        req.body.email,
        this.resolveClientUrl(req),
      );
      ApiResponse.ok(res, MSG.VERIFICATION_SENT);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/auth/forgot-password
  forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await authService.forgotPassword(
        req.body.email,
        this.resolveClientUrl(req),
      );
      ApiResponse.ok(res, MSG.PASSWORD_RESET_SENT);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/auth/reset-password
  resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      ApiResponse.ok(res, MSG.PASSWORD_RESET_SUCCESS);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/auth/me
  getMe = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      ApiResponse.ok(res, MSG.USER_FETCHED, { user: req.user });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/auth/google
  googleAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Generate CSRF state to prevent login CSRF attacks
      const state = generateToken(16);
      const redirectUrl = this.resolveClientUrl(req);

      res.cookie('oauth_state', state, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
        path: '/',
      });
      res.cookie('oauth_redirect', redirectUrl, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
        path: '/',
      });

      const url = googleOAuthService.getAuthUrl(state);
      return res.redirect(url);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/auth/google/callback
  googleCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, error: oauthError, state } = req.query;
      const redirectUrl =
        getAllowedClientUrl(req.cookies?.oauth_redirect) ?? this.clientUrl;

      // User denied access or other Google-side error
      if (oauthError) {
        res.clearCookie('oauth_redirect', {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });
        return res.redirect(
          `${redirectUrl}/auth/error?message=${encodeURIComponent(
            String(oauthError),
          )}`,
        );
      }

      // Verify CSRF state to prevent login CSRF
      const storedState = req.cookies?.oauth_state;
      if (!state || !storedState || state !== storedState) {
        throw new BadRequestError('❌ Invalid OAuth state. Please try again.');
      }
      res.clearCookie('oauth_state', {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      res.clearCookie('oauth_redirect', {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      if (!code || typeof code !== 'string') {
        throw new BadRequestError('❌ Missing authorization code from Google.');
      }

      const { user } = await googleOAuthService.handleCallback(code, {
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? 'unknown',
      });

      // [SESSION] Create PG session — kept for reference
      // const session = await sessionService.createSession(
      //   user.id,
      //   req.ip ?? undefined,
      //   req.headers["user-agent"]
      // );
      // res.cookie(COOKIE_NAMES.SESSION, session.rawToken, getCookieOptions(env.SESSION_MAX_AGE_DAYS));
      //

      // [JWT] Create PG session + issue JWT + refresh token ─
      const session = await sessionService.createSession(
        user.id,
        req.ip ?? undefined,
        req.headers['user-agent'],
      );
      await this.issueTokenPair(
        res,
        user.id,
        session.rawToken,
        user.role,
        user.email,
      );
      //

      // Clean up guest session
      await this.cleanupGuest(req, res);

      // Redirect to client app
      return res.redirect(redirectUrl);
    } catch (error) {
      next(error);
    }
  };

  private resolveClientUrl(req: Request) {
    const candidateHeaders = [
      req.get('origin'),
      req.get('referer'),
      req.get('referrer'),
    ];

    for (const headerValue of candidateHeaders) {
      const allowedUrl = getAllowedClientUrl(headerValue);
      if (allowedUrl) {
        return allowedUrl;
      }
    }

    return this.clientUrl;
  }

  // POST /api/auth/refresh
  // Called by the client when access_token has expired.
  // Rotates the refresh token — old one is consumed, new pair issued.
  refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const rawRefreshToken = req.cookies?.[JWT_COOKIE_NAMES.REFRESH_TOKEN];

      if (!rawRefreshToken) {
        throw new UnauthorizedError(MSG.UNAUTHORIZED);
      }

      // Consume old refresh token (deleted from Redis on read)
      const stored = await tokenService.consumeRefreshToken(rawRefreshToken);

      if (!stored) {
        // Token not found — expired or already used (possible theft).
        // Fix Issue 8: Decode the old access_token to extract family
        // and revoke all tokens in that family to contain the breach.
        const staleAccessToken = req.cookies?.[JWT_COOKIE_NAMES.ACCESS_TOKEN];
        if (staleAccessToken) {
          const decoded = tokenService.decodeAccessToken(staleAccessToken);
          // We don't have the family here directly; revocation happens
          // per-user as a safety net
          if (decoded?.userId) {
            await tokenService.deleteAllRefreshTokensForUser(decoded.userId);
          }
        }
        res.clearCookie(
          JWT_COOKIE_NAMES.ACCESS_TOKEN,
          getClearAccessTokenOptions(),
        );
        res.clearCookie(
          JWT_COOKIE_NAMES.REFRESH_TOKEN,
          getClearRefreshTokenOptions(),
        );
        throw new UnauthorizedError(MSG.SESSION_EXPIRED);
      }

      // Issue new access + refresh token pair (rotation — same family)
      // Passing stored.family preserves the chain for theft detection
      // Passing stored.role avoids a DB lookup during silent refresh
      let email = stored.email;
      if (!email) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, stored.userId),
        });
        email = user?.email;
      }

      if (!email) {
        throw new UnauthorizedError(MSG.UNAUTHORIZED);
      }

      await this.issueTokenPair(
        res,
        stored.userId,
        stored.sessionToken,
        stored.role,
        email,
        stored.family,
      );

      ApiResponse.ok(res, '🔄 Token refreshed successfully.');
    } catch (error) {
      next(error);
    }
  };

  // Helper: clean up guest session on login/register
  private async cleanupGuest(req: Request, res: Response) {
    const guestToken = req.cookies?.[COOKIE_NAMES.GUEST];
    if (guestToken) {
      await guestService.deleteGuestOnLogin(guestToken);
      res.clearCookie(COOKIE_NAMES.GUEST, getClearCookieOptions());
    }
  }

  // Helper: issue JWT access + refresh token pair ─
  // role:   user role embedded in both tokens so consumer services can
  //         authorise without a DB call (e.g. admin routes in payments-subs-api).
  // family: pass on rotation to preserve theft-detection chain;
  //         omit on first login to start a new family.
  private async issueTokenPair(
    res: Response,
    userId: string,
    sessionToken: string,
    role: string,
    email: string,
    family?: string,
  ) {
    // Access token — short lived JWT
    const { token: accessToken, expiresIn: accessMaxAge } =
      tokenService.generateAccessToken(userId, sessionToken, role, email);

    // Refresh token — opaque, stored in Redis
    // Read expiry from env so cookie maxAge stays in sync with Redis TTL
    const rawRefreshToken = await tokenService.generateRefreshToken(
      userId,
      sessionToken,
      role,
      email,
      family, // Fix Issue 3: preserves family across rotations
    );
    const refreshMaxAge = tokenService.getRefreshMaxAgeMs(); // Fix Issue 4

    res.cookie(
      JWT_COOKIE_NAMES.ACCESS_TOKEN,
      accessToken,
      getAccessTokenCookieOptions(accessMaxAge),
    );
    res.cookie(
      JWT_COOKIE_NAMES.REFRESH_TOKEN,
      rawRefreshToken,
      getRefreshTokenCookieOptions(refreshMaxAge),
    );
  }
}

export const authController = new AuthController();
