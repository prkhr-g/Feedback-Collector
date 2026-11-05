import { Router } from 'express';
import { submitFeedback } from '../controllers/feedbackController.js';
import { validateFeedback } from '../middleware/validateFeedback.js';

const feedbackRouter = Router();

feedbackRouter.post('/', validateFeedback, submitFeedback);

export default feedbackRouter;
