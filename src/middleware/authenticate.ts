import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { JWT_COOKIE_NAMES, MSG } from '../utils/constants';
import { UnauthorizedError } from '../utils/api-error';
import {
  getClearAccessTokenOptions,
  getClearRefreshTokenOptions,
} from '../utils/cookie';
import { tokenService } from '../services/token.service';

/*
 🔒 Authentication Middleware — JWT Version

 Flow:
   1. Read access_token cookie (JWT)
   2. Verify signature locally — zero DB / Redis hit (happy path)
   3. Check Redis blocklist for jti (covers logout / password change)
   4. Fetch user from DB to ensure account is still active
   5. Attach req.user + req.userId + req.sessionToken

 ── PREVIOUS SESSION-ONLY MIDDLEWARE (commented — not removed) ──
 import { sessions } from "../db/schema";
 import { COOKIE_NAMES } from "../utils/constants";
 import { getClearCookieOptions } from "../utils/cookie";
 import { hashToken } from "../utils/crypto";

 export async function authenticate(req, res, next) {
   try {
     const token = req.cookies?.[COOKIE_NAMES.SESSION];
     if (!token) throw new UnauthorizedError(MSG.UNAUTHORIZED);

     const session = await db.query.sessions.findFirst({
       where: eq(sessions.token, hashToken(token)),
       with: { user: true },
     });

     if (!session) {
       res.clearCookie(COOKIE_NAMES.SESSION, getClearCookieOptions());
       throw new UnauthorizedError(MSG.SESSION_EXPIRED);
     }
     if (session.expiresAt < new Date()) {
       await db.delete(sessions).where(eq(sessions.id, session.id));
       res.clearCookie(COOKIE_NAMES.SESSION, getClearCookieOptions());
       throw new UnauthorizedError(MSG.SESSION_EXPIRED);
     }
     if (session.user.isBlocked) {
       await db.delete(sessions).where(eq(sessions.id, session.id));
       res.clearCookie(COOKIE_NAMES.SESSION, getClearCookieOptions());
       throw new UnauthorizedError("🚫 Your account has been suspended.");
     }
     req.user = { id: session.user.id, email: session.user.email,
       name: session.user.name, image: session.user.image,
       role: session.user.role, emailVerified: session.user.emailVerified };
     req.sessionToken = token;
     next();
   } catch (error) { next(error); }
 }
*/

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const accessToken = req.cookies?.[JWT_COOKIE_NAMES.ACCESS_TOKEN];

    if (!accessToken) {
      throw new UnauthorizedError(MSG.UNAUTHORIZED);
    }

    // 1. Verify JWT signature + expiry locally (no DB / Redis needed)
    const payload = tokenService.verifyAccessToken(accessToken);

    if (!payload) {
      // Token invalid or expired — tell client to refresh
      res.clearCookie(
        JWT_COOKIE_NAMES.ACCESS_TOKEN,
        getClearAccessTokenOptions(),
      );
      throw new UnauthorizedError(MSG.SESSION_EXPIRED);
    }

    // 2. Check blocklist (only populated on logout / password change)
    //    This Redis call is the ONLY network cost on normal requests
    const isBlocked = await tokenService.isAccessTokenBlocked(payload.jti);
    if (isBlocked) {
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

    // 3. Fetch user from DB to verify account is still active
    //    (catches blocked / deleted accounts between token issuances)
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user) {
      throw new UnauthorizedError(MSG.UNAUTHORIZED);
    }

    if (user.isBlocked) {
      throw new UnauthorizedError(
        '🚫 Your account has been suspended. Please contact support.',
      );
    }

    // 4. Attach to request — downstream handlers + other services use these
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      emailVerified: user.emailVerified,
    };
    req.userId = payload.userId;
    // sessionToken embedded in JWT — available for other services
    req.sessionToken = payload.sessionToken;

    next();
  } catch (error) {
    next(error);
  }
}
