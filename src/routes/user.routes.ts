import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import {
  updateProfileSchema,
  changePasswordSchema,
} from '../validators/user.schema';

// 👤 User Routes — /api/user  (all require authentication)

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/profile', userController.getProfile);

router.patch(
  '/profile',
  validate(updateProfileSchema),
  userController.updateProfile,
);

router.patch(
  '/password',
  validate(changePasswordSchema),
  userController.changePassword,
);

router.delete('/account', userController.deleteAccount);

export default router;
