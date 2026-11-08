import { getDatabasePool } from '../config/database.js';

/**
 * Store one validated feedback record using bound SQL parameters.
 *
 * @param {{ name: string, email: string, feedbackType: string, rating: number, message: string }} feedback Normalized record.
 * @returns {Promise<number>} Inserted record ID.
 */
export async function createFeedback(feedback) {
  const result = await getDatabasePool().query(
    `INSERT INTO feedback (name, email, feedback_type, rating, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [feedback.name, feedback.email, feedback.feedbackType, feedback.rating, feedback.message],
  );
  return result.rows[0].id;
}
