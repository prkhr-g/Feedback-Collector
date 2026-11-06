import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool, types } = pg;
const configDirectory = dirname(fileURLToPath(import.meta.url));

// Local Neon CLI variables live at the repository root. The server's local
// file remains available for application secrets and is never committed.
dotenv.config({ path: resolve(configDirectory, '../../../.env.local') });
dotenv.config({ path: resolve(configDirectory, '../../.env') });

let pool;

const safeIntegerParser = (value) => {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : value;
};

function validateDatabaseUrl(value) {
  if (!value?.trim()) throw new Error('Missing required database configuration: DATABASE_URL');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('DATABASE_URL must include a PostgreSQL protocol, host, and database name');
  }
  return value.trim();
}

/** Create a bounded PostgreSQL pool using the pooled Neon URL at runtime. */
export function createDatabasePool(env = process.env) {
  const connectionString = validateDatabaseUrl(env.DATABASE_URL);
  const databasePool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    types: {
      getTypeParser(oid, format) {
        if (oid === 20 && format === 'text') return safeIntegerParser;
        return types.getTypeParser(oid, format);
      },
    },
  });
  databasePool.on('error', () => {
    console.error('Unexpected error on an idle PostgreSQL connection.');
  });
  return databasePool;
}

/** Return the shared application pool. */
export function getDatabasePool(env = process.env) {
  if (!pool) pool = createDatabasePool(env);
  return pool;
}

/** Close the shared pool cleanly, if it has been created. */
export async function closeDatabasePool() {
  if (!pool) return;
  const activePool = pool;
  pool = undefined;
  await activePool.end();
}
