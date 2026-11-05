import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

let pool;

/**
 * Create or return the shared MySQL connection pool.
 *
 * Connection values come from the environment so local MySQL is the default
 * setup while other MySQL-compatible servers remain configurable.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] Database configuration values.
 * @returns {import('mysql2/promise').Pool} Shared promise-based connection pool.
 * @throws {Error} If required connection settings or TLS configuration are invalid.
 */
export function getDatabasePool(env = process.env) {
  if (pool) return pool;

  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required database configuration: ${missing.join(', ')}`);
  }

  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be a valid TCP port');
  }

  if (env.DB_SSL && !['true', 'false'].includes(env.DB_SSL)) {
    throw new Error('DB_SSL must be either true or false');
  }

  const sslEnabled = env.DB_SSL === 'true';
  let ssl;
  if (sslEnabled) {
    ssl = { minVersion: 'TLSv1.2' };
    if (env.DB_SSL_CA_PATH?.trim()) {
      ssl.ca = readFileSync(env.DB_SSL_CA_PATH.trim());
    }
  }

  pool = mysql.createPool({
    host: env.DB_HOST.trim(),
    port,
    user: env.DB_USER.trim(),
    password: env.DB_PASSWORD,
    database: env.DB_NAME.trim(),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    timezone: 'Z',
    ssl,
  });

  return pool;
}

/**
 * Close the shared pool cleanly, if it has been created.
 *
 * @returns {Promise<void>} Resolves after all pool connections close.
 */
export async function closeDatabasePool() {
  if (!pool) return;
  const activePool = pool;
  pool = undefined;
  await activePool.end();
}
