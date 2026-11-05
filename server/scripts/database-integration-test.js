import 'dotenv/config';
import { closeDatabasePool, getDatabasePool } from '../src/config/database.js';

const pool = getDatabasePool();
const heldConnections = new Set();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function acquireConnections(count) {
  const connections = await Promise.all(
    Array.from({ length: count }, () => pool.getConnection()),
  );
  for (const connection of connections) heldConnections.add(connection);
  return connections;
}

function releaseConnection(connection) {
  if (!heldConnections.has(connection)) return;
  heldConnections.delete(connection);
  connection.release();
}

async function assertUtcSession(connection) {
  const [rows] = await connection.query(
    `SELECT @@session.time_zone AS timeZone,
            TIMESTAMPDIFF(MICROSECOND, NOW(6), UTC_TIMESTAMP(6)) AS deltaMicros`,
  );
  const { timeZone, deltaMicros } = rows[0];
  assert(timeZone === '+00:00', `Expected +00:00 session timezone; got ${timeZone}`);
  assert(
    Math.abs(Number(deltaMicros)) <= 1_000_000,
    `NOW() and UTC_TIMESTAMP() differ by ${deltaMicros} microseconds`,
  );
  return Number(deltaMicros);
}

async function main() {
  let activeTransaction;
  try {
    const initialConnections = await acquireConnections(3);
    const initialIds = initialConnections.map((connection) => connection.threadId);
    assert(new Set(initialIds).size === initialConnections.length, 'Pool did not provide distinct connections');

    const initialDeltas = [];
    for (const connection of initialConnections) {
      initialDeltas.push(await assertUtcSession(connection));
      await connection.query("SET SESSION time_zone = 'SYSTEM'");
    }
    console.log(`PASS: ${initialConnections.length} new pool connections use UTC; clock deltas (microseconds): ${initialDeltas.join(', ')}`);

    for (const connection of initialConnections) releaseConnection(connection);

    const reusedConnections = await acquireConnections(3);
    const reusedIds = reusedConnections.map((connection) => connection.threadId);
    assert(
      reusedIds.every((threadId) => initialIds.includes(threadId)),
      'Expected the pool to reuse the previously acquired connections',
    );

    for (const connection of reusedConnections) await assertUtcSession(connection);
    console.log(`PASS: ${reusedConnections.length} reused connections were reset to UTC before use`);
    for (const connection of reusedConnections) releaseConnection(connection);

    const connection = await pool.getConnection();
    heldConnections.add(connection);
    await connection.beginTransaction();
    activeTransaction = connection;

    const [defaultInsert] = await connection.execute(
      `INSERT INTO feedback (name, email, feedback_type, rating, message)
       VALUES (?, ?, ?, ?, ?)`,
      ['UTC integration check', 'utc-check@example.invalid', 'Other', 3, 'Temporary default timestamp check'],
    );
    const [defaultRows] = await connection.execute(
      'SELECT created_at AS createdAt, UTC_TIMESTAMP(6) AS utcNow FROM feedback WHERE id = ?',
      [defaultInsert.insertId],
    );
    const defaultTimestampDelta = Math.abs(
      new Date(defaultRows[0].createdAt).getTime() - new Date(defaultRows[0].utcNow).getTime(),
    );
    assert(defaultTimestampDelta <= 2_000, `CURRENT_TIMESTAMP differed from UTC by ${defaultTimestampDelta} ms`);
    console.log(`PASS: CURRENT_TIMESTAMP default is UTC (retrieved delta: ${defaultTimestampDelta} ms)`);

    const expectedTimestamp = '2024-07-08 09:10:11';
    const [explicitInsert] = await connection.execute(
      `INSERT INTO feedback (name, email, feedback_type, rating, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['UTC round-trip check', 'utc-roundtrip@example.invalid', 'Other', 3, 'Temporary explicit timestamp check', expectedTimestamp],
    );
    const [explicitRows] = await connection.execute(
      "SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt FROM feedback WHERE id = ?",
      [explicitInsert.insertId],
    );
    assert(
      explicitRows[0].createdAt === expectedTimestamp,
      `Expected timestamp ${expectedTimestamp}; got ${explicitRows[0].createdAt}`,
    );
    console.log(`PASS: explicit UTC timestamp insert/retrieval round-trip (${explicitRows[0].createdAt})`);

    await connection.rollback();
    activeTransaction = undefined;
    console.log('PASS: timestamp integration rows were rolled back');
  } finally {
    if (activeTransaction) await activeTransaction.rollback();
    for (const connection of heldConnections) releaseConnection(connection);
    await closeDatabasePool();
  }
}

await main();
