import 'dotenv/config';
import { closeDatabasePool, getDatabasePool } from './config/database.js';
import { getAuthConfig } from './config/auth.js';
import app from './app.js';

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  let pool;
  try {
    getAuthConfig();
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!turnstileSecret) {
      throw new Error('Missing required configuration: TURNSTILE_SECRET_KEY');
    }
    if (process.env.NODE_ENV === 'production' && turnstileSecret === '1x0000000000000000000000000000000AA') {
      throw new Error('TURNSTILE_SECRET_KEY must be a live Cloudflare secret in production');
    }
    pool = getDatabasePool();
    await pool.query('SELECT 1');
  } catch (error) {
    if (error.message.startsWith('Missing required') || error.message.startsWith('DATABASE_URL') || error.message.startsWith('JWT_') || error.message.startsWith('CLIENT_') || error.message.startsWith('TURNSTILE_')) {
      console.error(`Configuration error: ${error.message}`);
    } else {
      console.error('Database connection failed. Confirm the PostgreSQL connection URL is valid and the database is reachable.');
    }
    process.exitCode = 1;
    return;
  }

  const server = app.listen(port, () => {
    console.log(`Feedback Collector API listening on port ${port}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async () => {
        await closeDatabasePool();
        process.exit(0);
      });
    });
  }
}

startServer();
