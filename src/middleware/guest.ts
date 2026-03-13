import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { guests } from '../db/schema';
import { eq } from 'drizzle-orm';
import { COOKIE_NAMES } from '../utils/constants';
import { getClearCookieOptions } from '../utils/cookie';
import { hashToken } from '../utils/crypto';

// 👻 Guest Session Middleware
// Reads guest cookie → validates → attaches guest info to req

export async function attachGuest(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies?.[COOKIE_NAMES.GUEST];
    if (!token) return next();

    const guest = await db.query.guests.findFirst({
      where: eq(guests.sessionToken, hashToken(token)),
    });

    if (guest && guest.expiresAt > new Date()) {
      req.guestId = guest.id;
      req.guestToken = token;
    }

    next();
  } catch {
    // Silently continue — guest features are non-critical
    next();
  }
}
