import express from 'express';
import feedbackRouter from './routes/feedbackRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { publicFeedbackRateLimiter } from './middleware/publicRateLimiter.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import authRouter from './routes/authRoutes.js';
import adminFeedbackRouter from './routes/adminFeedbackRoutes.js';
import dashboardRouter from './routes/dashboardRoutes.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const serverDirectory = dirname(fileURLToPath(import.meta.url));

function getTrustedProxyHops(value = process.env.TRUST_PROXY_HOPS) {
  if (value === undefined || value.trim() === '') return 0;
  if (!/^(0|[1-9]\d*)$/u.test(value.trim()) || Number(value) > 3) {
    throw new Error('TRUST_PROXY_HOPS must be a whole number from 0 to 3');
  }
  return Number(value);
}

app.disable('x-powered-by');
app.set('trust proxy', getTrustedProxyHops());
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

const clientBuildDirectory = resolve(serverDirectory, '../../client/dist');
app.use(express.static(clientBuildDirectory, { index: false, fallthrough: true, maxAge: '1h' }));
app.get('/{*splat}', (request, response, next) => {
  if (request.path === '/api' || request.path.startsWith('/api/')) return next();
  response.sendFile(resolve(clientBuildDirectory, 'index.html'), (error) => {
    if (error) next();
  });
});

export default app;
