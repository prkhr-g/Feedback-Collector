import { getDatabasePool } from '../config/database.js';

/**
 * Store one validated feedback record using bound SQL parameters.
 *
 * @param {{ name: string, email: string, feedbackType: string, rating: number, message: string }} feedback Normalized record.
 * @returns {Promise<number>} Inserted record ID.
 */
export async function createFeedback(feedback) {
  const pool = getDatabasePool();
  const [result] = await pool.execute(
    `INSERT INTO feedback (name, email, feedback_type, rating, message)
     VALUES (?, ?, ?, ?, ?)`,
    [feedback.name, feedback.email, feedback.feedbackType, feedback.rating, feedback.message],
  );
  return result.insertId;
}
