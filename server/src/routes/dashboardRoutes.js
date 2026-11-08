import { Router } from 'express';
import { dashboardCharts, dashboardStats } from '../controllers/dashboardController.js';
import { authenticateAdmin } from '../middleware/authenticateAdmin.js';

const router = Router();
router.use(authenticateAdmin);
router.get('/stats', dashboardStats);
router.get('/charts', dashboardCharts);

export default router;
