import { getDatabasePool } from '../config/database.js';

export const MAX_CSV_EXPORT_ROWS = 10000;

function buildWhere(filters) {
  const clauses = [];
  const values = [];
  if (filters.keyword) {
    const escaped = filters.keyword.replace(/[!%_]/gu, (character) => `!${character}`);
    const pattern = `%${escaped}%`;
    clauses.push("(name LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' OR message LIKE ? ESCAPE '!')");
    values.push(pattern, pattern, pattern);
  }
  if (filters.startDate) {
    clauses.push('created_at >= ?');
    values.push(`${filters.startDate} 00:00:00`);
  }
  if (filters.endDateExclusive) {
    clauses.push('created_at < ?');
    values.push(`${filters.endDateExclusive} 00:00:00`);
  }
  if (filters.feedbackType) {
    clauses.push('feedback_type = ?');
    values.push(filters.feedbackType);
  }
  if (filters.rating !== undefined) {
    clauses.push('rating = ?');
    values.push(filters.rating);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
}

/** Count and retrieve one filtered page using only bound filter values. */
export async function listAdminFeedback(filters) {
  const pool = getDatabasePool();
  const where = buildWhere(filters);
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM feedback ${where.sql}`, where.values);
  const totalRecords = Number(countRows[0].total);
  const totalPages = Math.ceil(totalRecords / filters.limit);
  const currentPage = totalPages > 0 ? Math.min(filters.page, totalPages) : 1;
  const offset = (currentPage - 1) * filters.limit;
  const orderBy = filters.sort === 'oldest' ? 'created_at ASC, id ASC' : 'created_at DESC, id DESC';
  const [rows] = await pool.execute(
    `SELECT id, name, email, feedback_type AS feedbackType, rating, message, created_at AS createdAt
     FROM feedback ${where.sql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...where.values, filters.limit, offset],
  );
  return {
    data: rows,
    pagination: { currentPage, limit: filters.limit, totalRecords, totalPages },
  };
}

/** Fetch every matching row up to one past the hard export cap. */
export async function exportAdminFeedback(filters) {
  const where = buildWhere(filters);
  const orderBy = filters.sort === 'oldest' ? 'created_at ASC, id ASC' : 'created_at DESC, id DESC';
  const [rows] = await getDatabasePool().execute(
    `SELECT id, name, email, feedback_type AS feedbackType, rating, message, created_at AS createdAt
     FROM feedback ${where.sql} ORDER BY ${orderBy} LIMIT ?`,
    [...where.values, MAX_CSV_EXPORT_ROWS + 1],
  );
  return { rows, truncated: rows.length > MAX_CSV_EXPORT_ROWS };
}

/** Return one feedback record by validated ID, or null when it does not exist. */
export async function getAdminFeedbackById(id) {
  const [rows] = await getDatabasePool().execute(
    `SELECT id, name, email, feedback_type AS feedbackType, rating, message, created_at AS createdAt
     FROM feedback WHERE id = ? LIMIT 1`, [id],
  );
  return rows[0] ?? null;
}

/** Permanently delete one feedback row and report whether it existed. */
export async function deleteAdminFeedback(id) {
  const [result] = await getDatabasePool().execute('DELETE FROM feedback WHERE id = ?', [id]);
  return result.affectedRows === 1;
}

export function parseFeedbackId(value) {
  if (typeof value !== 'string' || !/^\d{1,10}$/u.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id >= 1 && id <= 4294967295 ? id : null;
}
