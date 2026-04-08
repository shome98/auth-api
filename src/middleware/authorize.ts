import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/api-error';
import { MSG } from '../utils/constants';
import type { UserRole } from '../db/schema/users';

/* 🛡️ Role-Based Authorization Middleware
 Must be used AFTER authenticate middleware.
 Usage:
   router.use(authenticate, authorize("admin"));
   router.use(authenticate, authorize("admin", "user"));
*/

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ForbiddenError(MSG.FORBIDDEN));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          "🚫 You don't have the required permissions. Admin access only.",
        ),
      );
    }

    next();
  };
}
