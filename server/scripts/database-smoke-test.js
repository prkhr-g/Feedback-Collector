import { closeDatabasePool, getDatabasePool } from '../src/config/database.js';

const pool = getDatabasePool();
const client = await pool.connect();

try {
  await client.query('BEGIN');
  const inserted = await client.query(
    `INSERT INTO feedback (name, email, feedback_type, rating, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ['Database smoke test', 'smoke-test@example.invalid', 'Other', 3, 'Temporary transactional check'],
  );
  const selected = await client.query(
    'SELECT id, name, email, feedback_type, rating, message FROM feedback WHERE id = $1',
    [inserted.rows[0].id],
  );

  if (selected.rows.length !== 1 || selected.rows[0].name !== 'Database smoke test') {
    throw new Error('Parameterized PostgreSQL insert/select verification failed');
  }

  await client.query('ROLLBACK');
  console.log('Database smoke check passed; temporary row was rolled back.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await closeDatabasePool();
}
