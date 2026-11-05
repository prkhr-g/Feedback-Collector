import { Router } from 'express';
import { login, logout, me } from '../controllers/authController.js';
import { authenticateAdmin } from '../middleware/authenticateAdmin.js';
import { requireSameOrigin } from '../middleware/requireSameOrigin.js';
import { createIpRateLimiter } from '../middleware/publicRateLimiter.js';

const router = Router();
const loginRateLimiter = createIpRateLimiter({
  maxRequests: 5,
  message: 'Too many login attempts. Please try again later.',
});

router.post('/login', requireSameOrigin, loginRateLimiter, login);
router.post('/logout', requireSameOrigin, logout);
router.get('/me', authenticateAdmin, me);

export default router;
