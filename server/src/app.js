import express from 'express';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ success: true, status: 'ok' });
});

export default app;
