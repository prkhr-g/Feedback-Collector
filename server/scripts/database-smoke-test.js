import 'dotenv/config';
import { closeDatabasePool, getDatabasePool } from '../src/config/database.js';

const pool = getDatabasePool();
const connection = await pool.getConnection();

try {
  await connection.beginTransaction();
  const [insertResult] = await connection.execute(
    `INSERT INTO feedback (name, email, feedback_type, rating, message)
     VALUES (?, ?, ?, ?, ?)`,
    ['Database smoke test', 'smoke-test@example.invalid', 'Other', 3, 'Temporary transactional check'],
  );

  const [rows] = await connection.execute(
    'SELECT id, name, email, feedback_type, rating, message FROM feedback WHERE id = ?',
    [insertResult.insertId],
  );

  if (rows.length !== 1 || rows[0].name !== 'Database smoke test') {
    throw new Error('Parameterized insert/select verification failed');
  }

  await connection.rollback();
  console.log('Database smoke check passed; temporary row was rolled back.');
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await closeDatabasePool();
}
