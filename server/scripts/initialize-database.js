import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDatabasePool } from '../src/config/database.js';

const schemaPath = fileURLToPath(new URL('../sql/postgres-schema.sql', import.meta.url));
const directUrl = process.env.DATABASE_URL_UNPOOLED;
if (!directUrl?.trim()) {
  throw new Error('Missing required database configuration: DATABASE_URL_UNPOOLED');
}

const pool = createDatabasePool({ DATABASE_URL: directUrl });
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query(await readFile(schemaPath, 'utf8'));
  await client.query('COMMIT');
  console.log('PostgreSQL schema initialized successfully.');
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  if (error.message.startsWith('Missing required') || error.message.startsWith('DATABASE_URL')) {
    console.error(`Configuration error: ${error.message}`);
  } else {
    console.error('PostgreSQL schema initialization failed. Confirm Neon is reachable and DATABASE_URL_UNPOOLED is configured.');
  }
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
