import assert from 'node:assert/strict';
import { closeDatabasePool, createDatabasePool, getDatabasePool } from '../src/config/database.js';

for (const value of [undefined, '', 'not-a-url', 'mysql://user:password@localhost/database']) {
  assert.throws(() => createDatabasePool({ DATABASE_URL: value }), /DATABASE_URL/u);
}

const pool = createDatabasePool({ DATABASE_URL: 'postgresql://test:test@example.invalid/testdb?sslmode=require' });
try {
  assert.equal(pool.options.max, 5);
  assert.equal(pool.options.connectionTimeoutMillis, 10_000);
  assert.equal(pool.options.idleTimeoutMillis, 30_000);
  console.log('PASS: PostgreSQL URL validation rejects missing, malformed, and non-PostgreSQL URLs');
  console.log('PASS: database pool has bounded connection, idle, and timeout settings');
} finally {
  await pool.end();
}

assert.ok(process.env.DATABASE_URL?.trim(), 'root .env.local should provide the pooled runtime URL');
assert.ok(process.env.DATABASE_URL_UNPOOLED?.trim(), 'root .env.local should provide the direct schema URL');
const runtimePool = getDatabasePool();
assert.equal(runtimePool.options.max, 5);
const schemaPool = createDatabasePool({ DATABASE_URL: process.env.DATABASE_URL_UNPOOLED });
try {
  assert.equal(schemaPool.options.max, 5);
  console.log('PASS: pooled and direct Neon URLs load from local environment without exposing their values');
} finally {
  await schemaPool.end();
  await closeDatabasePool();
}
