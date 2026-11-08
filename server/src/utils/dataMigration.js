/** Normalize a MySQL DATETIME or PostgreSQL TIMESTAMPTZ value to an epoch. */
export function timestampMillis(value) {
  if (value instanceof Date) return value.getTime();
  const normalized = String(value).replace(' ', 'T');
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/u.test(normalized) ? normalized : `${normalized}Z`).getTime();
}

export function sameTimestamp(left, right) {
  const leftMillis = timestampMillis(left);
  return Number.isFinite(leftMillis) && leftMillis === timestampMillis(right);
}

export function sameFeedback(left, right) {
  return String(left.id) === String(right.id)
    && left.name === right.name
    && left.email === right.email
    && left.feedback_type === right.feedback_type
    && Number(left.rating) === Number(right.rating)
    && left.message === right.message
    && sameTimestamp(left.created_at, right.created_at);
}

export function sameAdmin(left, right) {
  return String(left.id) === String(right.id)
    && left.email === right.email
    && left.password_hash === right.password_hash
    && sameTimestamp(left.created_at, right.created_at);
}

/** Plan idempotent imports and detect any primary-key or unique-email collision. */
export function planRows(source, target, compare, { emailUnique = false } = {}) {
  const byId = new Map(target.map((row) => [String(row.id), row]));
  const byEmail = new Map(target.filter((row) => row.email).map((row) => [row.email, row]));
  const missing = [];
  let identical = 0;
  let conflicts = 0;
  for (const sourceRow of source) {
    const found = byId.get(String(sourceRow.id));
    if (found) {
      if (compare(sourceRow, found)) identical += 1;
      else conflicts += 1;
      continue;
    }
    if (emailUnique && sourceRow.email && byEmail.has(sourceRow.email)) {
      conflicts += 1;
      continue;
    }
    missing.push(sourceRow);
  }
  return { missing, identical, conflicts };
}
