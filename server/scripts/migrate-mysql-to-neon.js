import 'dotenv/config';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { createDatabasePool } from '../src/config/database.js';
import { planRows, sameAdmin, sameFeedback, timestampMillis } from '../src/utils/dataMigration.js';

const BATCH_SIZE = 250;
const apply = process.argv.includes('--apply');
const allowedArgs = new Set(['--apply']);
if (process.argv.slice(2).some((argument) => !allowedArgs.has(argument))) {
  console.error('Usage: npm run db:migrate:mysql --workspace server [-- --apply]');
  process.exit(2);
}

function requiredMysqlConfig(env) {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing required source database configuration: ${missing.join(', ')}`);
  if (env.DB_SSL && !['true', 'false'].includes(env.DB_SSL)) {
    throw new Error('DB_SSL must be either true or false');
  }
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be a valid TCP port');
  }
  let ssl;
  if (env.DB_SSL === 'true') {
    ssl = { minVersion: 'TLSv1.2' };
    if (env.DB_SSL_CA_PATH?.trim()) ssl.ca = readFileSync(env.DB_SSL_CA_PATH.trim());
  }
  return {
    host: env.DB_HOST.trim(), port, user: env.DB_USER.trim(), password: env.DB_PASSWORD,
    database: env.DB_NAME.trim(), timezone: 'Z', ssl,
  };
}

async function sourceRows(connection) {
  await connection.query("SET SESSION time_zone = '+00:00'");
  await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  const [feedback] = await connection.query(
    `SELECT id, name, email, feedback_type, rating, message, created_at
     FROM feedback ORDER BY id`,
  );
  const [admins] = await connection.query(
    `SELECT id, email, password_hash, created_at
     FROM admins ORDER BY id`,
  );
  return { feedback, admins };
}

async function targetRowsByIds(client, rows, table, emails = []) {
  const idList = rows.map((row) => row.id);
  if (!idList.length && !emails.length) return [];
  if (table === 'admins') {
    const result = await client.query(
      'SELECT id, email, password_hash, created_at FROM admins WHERE id = ANY($1::bigint[]) OR email = ANY($2::text[])',
      [idList, emails],
    );
    return result.rows;
  }
  const result = await client.query(
    'SELECT id, name, email, feedback_type, rating, message, created_at FROM feedback WHERE id = ANY($1::bigint[])',
    [idList],
  );
  return result.rows;
}

async function insertRows(client, table, rows) {
  const columns = table === 'feedback'
    ? ['id', 'name', 'email', 'feedback_type', 'rating', 'message', 'created_at']
    : ['id', 'email', 'password_hash', 'created_at'];
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const values = [];
    const tuples = batch.map((row) => {
      const fields = columns.map((column) => {
        let value = row[column];
        if (column === 'id') value = String(value);
        if (column === 'created_at') value = new Date(timestampMillis(value));
        values.push(value);
        return `$${values.length}`;
      });
      return `(${fields.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
      values,
    );
  }
}

async function counts(client) {
  const result = await client.query(
    `SELECT (SELECT COUNT(*) FROM feedback) AS feedback_count,
            (SELECT COUNT(*) FROM admins) AS admin_count`,
  );
  return {
    feedback: Number(result.rows[0].feedback_count),
    admins: Number(result.rows[0].admin_count),
  };
}

async function resetIdentitySequence(client, table) {
  await client.query(
    `SELECT setval(pg_get_serial_sequence($1, 'id'),
       COALESCE(MAX(id), 1), COUNT(*) > 0) FROM ${table}`,
    [table],
  );
}

async function verifyImported(client, source) {
  const targetFeedback = await targetRowsByIds(client, source.feedback, 'feedback');
  const targetAdmins = await targetRowsByIds(
    client, source.admins, 'admins', source.admins.map((row) => row.email),
  );
  const feedbackPlan = planRows(source.feedback, targetFeedback, sameFeedback);
  const adminsPlan = planRows(source.admins, targetAdmins, sameAdmin, { emailUnique: true });
  return {
    feedback: { total: source.feedback.length, identical: feedbackPlan.identical, missing: feedbackPlan.missing.length, conflicts: feedbackPlan.conflicts },
    admins: { total: source.admins.length, identical: adminsPlan.identical, missing: adminsPlan.missing.length, conflicts: adminsPlan.conflicts },
    feedbackMissing: feedbackPlan.missing,
    adminsMissing: adminsPlan.missing,
  };
}

async function migrate() {
  let sourceConnection;
  let targetClient;
  let targetPool;
  let sourceTransaction = false;
  let targetTransaction = false;
  let targetCommitted = false;
  try {
    sourceConnection = await mysql.createConnection(requiredMysqlConfig(process.env));
    const source = await sourceRows(sourceConnection);
    sourceTransaction = true;
    console.log(JSON.stringify({ sourceSnapshot: { feedback: source.feedback.length, admins: source.admins.length } }));

    const directUrl = process.env.DATABASE_URL_UNPOOLED?.trim();
    if (!directUrl) throw new Error('Missing required database configuration: DATABASE_URL_UNPOOLED');
    let directHost;
    try {
      directHost = new URL(directUrl).hostname;
    } catch {
      throw new Error('DATABASE_URL_UNPOOLED must be a valid PostgreSQL connection URL');
    }
    if (directHost.includes('-pooler')) {
      throw new Error('DATABASE_URL_UNPOOLED must use the direct Neon endpoint, without the -pooler hostname.');
    }
    targetPool = createDatabasePool({ DATABASE_URL: directUrl });
    targetClient = await targetPool.connect();

    const before = await counts(targetClient);
    const plan = await verifyImported(targetClient, source);
    const sourceCounts = { feedback: plan.feedback.total, admins: plan.admins.total };
    const existing = { feedback: plan.feedback.identical, admins: plan.admins.identical };
    const pending = { feedback: plan.feedback.missing, admins: plan.admins.missing };
    const conflicts = { feedback: plan.feedback.conflicts, admins: plan.admins.conflicts };
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', source: sourceCounts, targetBefore: before, alreadyMatching: existing, toInsert: pending, conflicts }));

    if (conflicts.feedback || conflicts.admins) {
      throw new Error('Migration stopped because target IDs or admin emails conflict with source records. No rows were written.');
    }
    if (!apply) {
      console.log('DRY RUN: no target data was changed. Re-run with -- --apply to insert only missing records.');
      return;
    }

    await targetClient.query('BEGIN');
    targetTransaction = true;
    await insertRows(targetClient, 'feedback', plan.feedbackMissing);
    await insertRows(targetClient, 'admins', plan.adminsMissing);
    await resetIdentitySequence(targetClient, 'feedback');
    await resetIdentitySequence(targetClient, 'admins');

    const verify = await verifyImported(targetClient, source);
    if (verify.feedback.missing || verify.feedback.conflicts || verify.admins.missing || verify.admins.conflicts) {
      throw new Error('Post-import verification did not match every source row. The target transaction was rolled back.');
    }
    await targetClient.query('COMMIT');
    targetTransaction = false;
    targetCommitted = true;
    const after = await counts(targetClient);
    console.log(JSON.stringify({ result: 'PASS', verified: { feedback: sourceCounts.feedback, admins: sourceCounts.admins }, targetAfter: after }));
  } catch (error) {
    if (targetTransaction && targetClient) await targetClient.query('ROLLBACK').catch(() => {});
    if (error.message.startsWith('Missing required') || error.message.startsWith('DB_') || error.message.startsWith('Migration stopped') || error.message.startsWith('Post-import')) {
      console.error(error.message);
    } else if (targetCommitted) {
      console.error('Neon committed the migration, but the final count query failed. Re-run the dry run to verify totals. The local MySQL source was not modified.');
    } else {
      console.error(`Migration failed safely (${error.code || error.name}). The local MySQL source was not modified.`);
    }
    process.exitCode = 1;
  } finally {
    if (sourceTransaction && sourceConnection) await sourceConnection.rollback().catch(() => {});
    if (sourceConnection) await sourceConnection.end().catch(() => {});
    if (targetClient) targetClient.release();
    if (targetPool) await targetPool.end();
  }
}

await migrate();
