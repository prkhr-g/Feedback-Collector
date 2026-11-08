export const CSV_COLUMNS = [
  ['id', 'ID'],
  ['name', 'Name'],
  ['email', 'Email'],
  ['feedbackType', 'Feedback Type'],
  ['rating', 'Rating'],
  ['ratingLabel', 'Rating Label'],
  ['message', 'Message'],
  ['createdAt', 'Created At (UTC)'],
];
const RATING_LABELS = ['', 'Very poor', 'Poor', 'Neutral', 'Good', 'Excellent'];

function protectSpreadsheetFormula(value) {
  const text = String(value ?? '');
  return /^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)
    ? `'${text}`
    : text;
}

function formatUtcDate(value) {
  if (value instanceof Date) return `${value.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
  return value ? `${String(value).replace('T', ' ').replace(/Z$/u, '')} UTC` : '';
}

function quoteCsvCell(value) {
  return `"${protectSpreadsheetFormula(value).replace(/"/gu, '""')}"`;
}

/** Serialize feedback rows as UTF-8 CSV with RFC 4180 quoting and formula protection. */
export function serializeFeedbackCsv(rows) {
  const header = CSV_COLUMNS.map(([, label]) => quoteCsvCell(label)).join(',');
  const body = rows.map((row) => CSV_COLUMNS.map(([key]) => quoteCsvCell(
    key === 'createdAt' ? formatUtcDate(row[key])
      : key === 'ratingLabel' ? RATING_LABELS[Number(row.rating)] ?? ''
        : row[key],
  )).join(','));
  return `\uFEFF${[header, ...body].join('\r\n')}\r\n`;
}
