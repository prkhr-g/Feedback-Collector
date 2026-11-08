import { Router } from 'express';
import { deleteFeedback, exportFeedback, getFeedback, listFeedback } from '../controllers/adminFeedbackController.js';
import { authenticateAdmin } from '../middleware/authenticateAdmin.js';
import { requireSameOrigin } from '../middleware/requireSameOrigin.js';

const router = Router();
router.use(authenticateAdmin);
router.get('/export', exportFeedback);
router.get('/', listFeedback);
router.get('/:id', getFeedback);
router.delete('/:id', requireSameOrigin, deleteFeedback);

export default router;
