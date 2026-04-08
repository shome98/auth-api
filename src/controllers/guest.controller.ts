import { Request, Response, NextFunction } from 'express';
import { guestService } from '../services/guest.service';
import { ApiResponse } from '../utils/api-response';
import { BadRequestError } from '../utils/api-error';
import { COOKIE_NAMES, MSG } from '../utils/constants';
import { getCookieOptions, getClearCookieOptions } from '../utils/cookie';
import { env } from '../config/env';

// 👻 Guest Controller

class GuestController {
  // POST /api/guest/init
  initGuest = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Already has a valid guest session?
      const existingToken = req.cookies?.[COOKIE_NAMES.GUEST];
      if (existingToken) {
        const existing = await guestService.getGuestByToken(existingToken);
        if (existing) {
          ApiResponse.ok(res, MSG.GUEST_EXISTS, {
            guestId: existing.id,
            data: existing.data,
          });
          return;
        }
      }

      // Create new guest session
      const guest = await guestService.createGuestSession();
      res.cookie(
        COOKIE_NAMES.GUEST,
        guest.rawToken,
        getCookieOptions(env.GUEST_SESSION_MAX_AGE_DAYS),
      );

      ApiResponse.created(res, MSG.GUEST_CREATED, {
        guestId: guest.id,
        data: guest.data,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/guest/data
  getGuestData = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = req.cookies?.[COOKIE_NAMES.GUEST];
      if (!token) {
        ApiResponse.ok(res, MSG.GUEST_NO_SESSION, { data: null });
        return;
      }

      const guest = await guestService.getGuestByToken(token);
      if (!guest) {
        res.clearCookie(COOKIE_NAMES.GUEST, getClearCookieOptions());
        ApiResponse.ok(res, MSG.GUEST_EXPIRED, { data: null });
        return;
      }

      ApiResponse.ok(res, MSG.GUEST_DATA_FETCHED, {
        guestId: guest.id,
        data: guest.data,
      });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/guest/data
  updateGuestData = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = req.cookies?.[COOKIE_NAMES.GUEST];
      if (!token) {
        throw new BadRequestError(MSG.GUEST_NO_SESSION);
      }

      const updated = await guestService.updateGuestData(token, req.body);
      if (!updated) {
        res.clearCookie(COOKIE_NAMES.GUEST, getClearCookieOptions());
        throw new BadRequestError(MSG.GUEST_EXPIRED);
      }

      ApiResponse.ok(res, MSG.GUEST_DATA_UPDATED, {
        guestId: updated.id,
        data: updated.data,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const guestController = new GuestController();
