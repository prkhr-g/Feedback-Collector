import express from 'express';
import feedbackRouter from './routes/feedbackRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { publicFeedbackRateLimiter } from './middleware/publicRateLimiter.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import authRouter from './routes/authRoutes.js';
import adminFeedbackRouter from './routes/adminFeedbackRoutes.js';
import dashboardRouter from './routes/dashboardRoutes.js';

const app = express();

app.disable('x-powered-by');
app.use(securityHeaders);
app.use('/api/feedback', publicFeedbackRateLimiter);
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ success: true, status: 'ok' });
});

app.use('/api/feedback', feedbackRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin/feedback', adminFeedbackRouter);
app.use('/api/admin/dashboard', dashboardRouter);
app.use(errorHandler);

export default app;
