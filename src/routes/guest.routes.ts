import { Router } from 'express';
import { guestController } from '../controllers/guest.controller';
import { validate } from '../middleware/validate';
import { updateGuestDataSchema } from '../validators/guest.schema';
import { authLimiter } from '../middleware/rate-limiter';

// 👻 Guest Routes — /api/guest  (no auth required)

const router = Router();

router.post('/init', authLimiter, guestController.initGuest);
router.get('/data', guestController.getGuestData);
router.patch(
  '/data',
  validate(updateGuestDataSchema),
  guestController.updateGuestData,
);

export default router;
