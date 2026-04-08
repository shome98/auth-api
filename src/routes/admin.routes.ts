import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate, validateParams } from '../middleware/validate';
import {
  updateRoleSchema,
  userIdParamSchema,
} from '../validators/admin.schema';

// 🛡️ Admin Routes — /api/admin  (auth + admin role required)

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize('admin'));

// All :userId params must be valid UUIDs
router.param('userId', (req, res, next) => {
  validateParams(userIdParamSchema)(req, res, next);
});

router.patch(
  '/users/:userId/role',
  validate(updateRoleSchema),
  adminController.updateRole,
);
router.patch('/users/:userId/block', adminController.blockUser);
router.patch('/users/:userId/unblock', adminController.unblockUser);
router.get('/users/:userId/activity', adminController.getLoginActivity);
router.get('/users', adminController.getUsers);
router.delete('/users/:userId', adminController.deleteUser);

export default router;
