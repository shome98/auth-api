import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { ApiResponse } from '../utils/api-response';
import { BadRequestError } from '../utils/api-error';
import { MSG } from '../utils/constants';

// 🛡️ Admin Controller — admin-only user management

class AdminController {
  /** Guard: prevent admin from modifying their own account. */
  private assertNotSelf(req: Request, action: string): void {
    if (req.params.userId === req.user!.id) {
      throw new BadRequestError(`❌ You cannot ${action} your own account.`);
    }
  }

  //  GET /api/admin/users?page=1&limit=20
  getUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
      const result = await userService.getUserList({ page, limit });
      ApiResponse.ok(res, '✅ Users retrieved.', result);
    } catch (error) {
      next(error);
    }
  };

  //  DELETE /api/admin/users/:userId
  deleteUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      this.assertNotSelf(req, 'delete');
      await userService.deleteAccount(req.params.userId as string);
      ApiResponse.ok(res, '🗑️ User account deleted.');
    } catch (error) {
      next(error);
    }
  };

  //  PATCH /api/admin/users/:userId/role
  updateRole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      this.assertNotSelf(req, 'change the role of');
      const user = await userService.updateRole(
        req.params.userId as string,
        req.body.role,
      );
      ApiResponse.ok(res, MSG.ROLE_UPDATED, { user });
    } catch (error) {
      next(error);
    }
  };

  //  PATCH /api/admin/users/:userId/block
  blockUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      this.assertNotSelf(req, 'block');
      await userService.blockUser(req.params.userId as string);
      ApiResponse.ok(res, MSG.USER_BLOCKED);
    } catch (error) {
      next(error);
    }
  };

  //  PATCH /api/admin/users/:userId/unblock
  unblockUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await userService.unblockUser(req.params.userId as string);
      ApiResponse.ok(res, MSG.USER_UNBLOCKED);
    } catch (error) {
      next(error);
    }
  };

  //  GET /api/admin/users/:userId/activity
  getLoginActivity = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const activity = await userService.getLoginActivity(
        req.params.userId as string,
      );
      ApiResponse.ok(res, MSG.ACTIVITY_FETCHED, { activity });
    } catch (error) {
      next(error);
    }
  };
}

export const adminController = new AdminController();
