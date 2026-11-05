import 'dotenv/config';
import { closeDatabasePool, getDatabasePool } from './config/database.js';
import { getAuthConfig } from './config/auth.js';
import app from './app.js';

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  let pool;
  try {
    getAuthConfig();
    if (!process.env.TURNSTILE_SECRET_KEY?.trim()) {
      throw new Error('Missing required configuration: TURNSTILE_SECRET_KEY');
    }
    pool = getDatabasePool();
    await pool.query('SELECT 1');
  } catch (error) {
    if (error.message.startsWith('Missing required') || error.message.startsWith('DB_') || error.message.startsWith('JWT_') || error.message.startsWith('CLIENT_')) {
      console.error(`Configuration error: ${error.message}`);
    } else {
      console.error('Database connection failed. Confirm local MySQL is running and server/.env is correct.');
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
