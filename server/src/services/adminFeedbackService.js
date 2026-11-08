import { getDatabasePool } from '../config/database.js';

function buildWhere(filters) {
  const clauses = [];
  const values = [];
  if (filters.keyword) {
    const escaped = filters.keyword.replace(/[!%_]/gu, (character) => `!${character}`);
    const pattern = `%${escaped}%`;
    const parameter = `$${values.length + 1}`;
    clauses.push(`(name ILIKE ${parameter} ESCAPE '!' OR email ILIKE ${parameter} ESCAPE '!' OR message ILIKE ${parameter} ESCAPE '!')`);
    values.push(pattern);
  }
  if (filters.startDate) {
    clauses.push(`created_at >= $${values.length + 1}::timestamptz`);
    values.push(`${filters.startDate}T00:00:00.000Z`);
  }
  if (filters.endDateExclusive) {
    clauses.push(`created_at < $${values.length + 1}::timestamptz`);
    values.push(`${filters.endDateExclusive}T00:00:00.000Z`);
  }
  if (filters.feedbackType) {
    clauses.push(`feedback_type = $${values.length + 1}`);
    values.push(filters.feedbackType);
  }
  if (filters.rating !== undefined) {
    clauses.push(`rating = $${values.length + 1}`);
    values.push(filters.rating);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
}

/** Count and retrieve one filtered page using only bound filter values. */
export async function listAdminFeedback(filters) {
  const pool = getDatabasePool();
  const where = buildWhere(filters);
  const countRows = await pool.query(`SELECT COUNT(*) AS total FROM feedback ${where.sql}`, where.values);
  const totalRecords = Number(countRows.rows[0].total);
  const totalPages = Math.ceil(totalRecords / filters.limit);
  const currentPage = totalPages > 0 ? Math.min(filters.page, totalPages) : 1;
  const offset = (currentPage - 1) * filters.limit;
  const orderBy = filters.sort === 'oldest' ? 'created_at ASC, id ASC' : 'created_at DESC, id DESC';
  const rows = await pool.query(
    `SELECT id, name, email, feedback_type AS "feedbackType", rating, message, created_at AS "createdAt"
     FROM feedback ${where.sql} ORDER BY ${orderBy} LIMIT $${where.values.length + 1} OFFSET $${where.values.length + 2}`,
    [...where.values, filters.limit, offset],
  );
  return {
    data: rows.rows,
    pagination: { currentPage, limit: filters.limit, totalRecords, totalPages },
  };
}

/** Fetch every row matching the validated filters, independent of pagination. */
export async function exportAdminFeedback(filters) {
  const where = buildWhere(filters);
  const orderBy = filters.sort === 'oldest' ? 'created_at ASC, id ASC' : 'created_at DESC, id DESC';
  const result = await getDatabasePool().query(
    `SELECT id, name, email, feedback_type AS "feedbackType", rating, message, created_at AS "createdAt"
     FROM feedback ${where.sql} ORDER BY ${orderBy}`,
    where.values,
  );
  return { rows: result.rows };
}

/** Return one feedback record by validated ID, or null when it does not exist. */
export async function getAdminFeedbackById(id) {
  const result = await getDatabasePool().query(
    `SELECT id, name, email, feedback_type AS "feedbackType", rating, message, created_at AS "createdAt"
     FROM feedback WHERE id = $1 LIMIT 1`, [id],
  );
  return result.rows[0] ?? null;
}

/** Permanently delete one feedback row and report whether it existed. */
export async function deleteAdminFeedback(id) {
  const result = await getDatabasePool().query('DELETE FROM feedback WHERE id = $1', [id]);
  return result.rowCount === 1;
}

export function parseFeedbackId(value) {
  if (typeof value !== 'string' || !/^\d{1,10}$/u.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id >= 1 && id <= 4294967295 ? id : null;
}
