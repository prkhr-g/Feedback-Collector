import assert from 'node:assert/strict';
import { closeDatabasePool, getDatabasePool } from '../src/config/database.js';

const pool = getDatabasePool();
const heldClients = new Set();

async function acquireClients(count) {
  const clients = await Promise.all(Array.from({ length: count }, () => pool.connect()));
  for (const client of clients) heldClients.add(client);
  return clients;
}

function releaseClient(client) {
  if (!heldClients.delete(client)) return;
  client.release();
}

async function assertUtcSession(client) {
  const result = await client.query(
    `SELECT current_setting('TimeZone') AS "timeZone",
            EXTRACT(EPOCH FROM NOW()) * 1000 AS "nowEpoch",
            EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000 AS "currentEpoch"`,
  );
  const { timeZone, nowEpoch, currentEpoch } = result.rows[0];
  assert.match(timeZone, /^(?:UTC|Etc\/UTC|GMT|\+00:00)$/iu);
  assert.ok(Math.abs(Number(nowEpoch) - Number(currentEpoch)) < 1, 'NOW() and CURRENT_TIMESTAMP should represent the same instant');
  return timeZone;
}

async function main() {
  let transactionClient;
  try {
    const initialClients = await acquireClients(3);
    const initialIds = initialClients;
    assert.equal(new Set(initialIds).size, initialIds.length, 'Pool did not provide distinct checked-out clients');
    const timeZones = [];
    for (const client of initialClients) timeZones.push(await assertUtcSession(client));
    console.log(`PASS: ${initialClients.length} new pool connections report UTC; session settings: ${timeZones.join(', ')}`);

    for (const client of initialClients) releaseClient(client);
    const reusedClients = await acquireClients(3);
    assert.ok(reusedClients.every((client) => initialIds.includes(client)), 'Pool did not reuse the released client objects');
    for (const client of reusedClients) await assertUtcSession(client);
    console.log(`PASS: ${reusedClients.length} reused pool connections retain UTC session behavior`);
    for (const client of reusedClients) releaseClient(client);

    transactionClient = await pool.connect();
    heldClients.add(transactionClient);
    await transactionClient.query('BEGIN');
    const inserted = await transactionClient.query(
      `INSERT INTO feedback (name, email, feedback_type, rating, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      ['UTC integration check', 'utc-check@example.invalid', 'Other', 3, 'Temporary default timestamp check'],
    );
    const defaultTimestamp = inserted.rows[0].created_at;
    const currentResult = await transactionClient.query(
      `SELECT ABS(EXTRACT(EPOCH FROM (created_at - CURRENT_TIMESTAMP)) * 1000) AS "deltaMs"
       FROM feedback WHERE id = $1`,
      [inserted.rows[0].id],
    );
    const defaultDelta = Number(currentResult.rows[0].deltaMs);
    assert.ok(defaultDelta <= 2_000, `DEFAULT CURRENT_TIMESTAMP differed by ${defaultDelta} ms`);
    assert.ok(defaultTimestamp instanceof Date && Number.isFinite(defaultTimestamp.getTime()), 'TIMESTAMPTZ should decode to a valid JavaScript Date');
    console.log(`PASS: DEFAULT CURRENT_TIMESTAMP round-trips as an instant (${defaultDelta.toFixed(0)} ms from query time)`);

    const expectedTimestamp = '2024-07-08T09:10:11.000Z';
    const explicitInsert = await transactionClient.query(
      `INSERT INTO feedback (name, email, feedback_type, rating, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz) RETURNING id`,
      ['UTC round-trip check', 'utc-roundtrip@example.invalid', 'Other', 3, 'Temporary explicit timestamp check', expectedTimestamp],
    );
    const explicitSelect = await transactionClient.query(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS "createdAt"
       FROM feedback WHERE id = $1`,
      [explicitInsert.rows[0].id],
    );
    assert.equal(explicitSelect.rows[0].createdAt, '2024-07-08 09:10:11');
    console.log(`PASS: explicit timestamp insert/retrieval round-trip (${explicitSelect.rows[0].createdAt} UTC)`);

    await transactionClient.query('ROLLBACK');
    releaseClient(transactionClient);
    transactionClient = undefined;
    console.log('PASS: temporary timestamp rows were rolled back');
  } finally {
    if (transactionClient) {
      await transactionClient.query('ROLLBACK').catch(() => {});
      releaseClient(transactionClient);
    }
    for (const client of heldClients) releaseClient(client);
    await closeDatabasePool();
  }
}

await main();
