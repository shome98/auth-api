import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { tokenService } from '../services/token.service';
import { ApiResponse } from '../utils/api-response';
import { JWT_COOKIE_NAMES, MSG } from '../utils/constants';
import {
  getClearAccessTokenOptions,
  getClearRefreshTokenOptions,
} from '../utils/cookie';

// 👤 User Controller

class UserController {
  //  GET /api/user/profile
  getProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = await userService.getById(req.user!.id);
      ApiResponse.ok(res, MSG.USER_FETCHED, { user });
    } catch (error) {
      next(error);
    }
  };

  //  PATCH /api/user/profile ─
  updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = await userService.updateProfile(req.user!.id, req.body);
      ApiResponse.ok(res, MSG.PROFILE_UPDATED, { user });
    } catch (error) {
      next(error);
    }
  };

  //  PATCH /api/user/password
  changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;
      await userService.changePassword(
        req.user!.id,
        currentPassword,
        newPassword,
        req.sessionToken,
      );
      ApiResponse.ok(res, MSG.PASSWORD_CHANGED);
    } catch (error) {
      next(error);
    }
  };

  //  DELETE /api/user/account
  deleteAccount = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // deleteAccount purges Redis refresh tokens before removing the user row
      await userService.deleteAccount(req.user!.id);

      // Block the current access token jti so it can't be reused
      const accessToken = req.cookies?.[JWT_COOKIE_NAMES.ACCESS_TOKEN];
      if (accessToken) {
        const payload = tokenService.decodeAccessToken(accessToken);
        if (payload?.jti && payload?.exp) {
          await tokenService.blockAccessToken(payload.jti, payload.exp);
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
      ApiResponse.ok(res, MSG.ACCOUNT_DELETED);
    } catch (error) {
      next(error);
    }
  };
}

export const userController = new UserController();
