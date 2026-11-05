import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';

process.env.JWT_SECRET = 'phase-nine-test-only-secret-value-0123456789';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const [{ default: app }, database, auth, csv, exportService] = await Promise.all([
  import('../src/app.js'),
  import('../src/config/database.js'),
  import('../src/services/authService.js'),
  import('../src/utils/csv.js'),
  import('../src/services/adminFeedbackService.js'),
]);
const pool = database.getDatabasePool();
const suffix = randomUUID().replaceAll('-', '');
const marker = `csvtest${suffix}`;
const email = `csv-test-${suffix}@example.invalid`;
const password = 'phase-nine-integration-password';
const today = new Date().toISOString().slice(0, 10);
const records = Array.from({ length: 12 }, (_, index) => ({
  name: `CSV record ${index} ${marker}`,
  email: `${marker}-${index}@example.invalid`,
  type: 'Bug report',
  rating: 5,
  message: `ordinary message ${index}`,
  created: `${today} 09:00:${String(index).padStart(2, '0')}`,
}));
records[0] = {
  name: `=HYPERLINK("https://example.invalid","${marker}")`,
  email: `+${marker}@example.invalid`,
  type: 'Bug report',
  rating: 5,
  message: '  =1+1, "quoted"\r\nsecond line',
  created: `${today} 09:00:00`,
};
records[1] = {
  ...records[1],
  name: ` ${marker} row`,
  email: `@SUM(1,2)+${marker}@example.invalid`,
  message: '-2+3, ordinary text',
};
const insertedIds = [];
let adminId;
const server = app.listen(0, '127.0.0.1');

function request(port, path, { method = 'GET', body, cookie, origin = 'http://localhost:5173' } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (origin) headers.Origin = origin;
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        text: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

function parseCsv(text) {
  const input = text.replace(/^\uFEFF/u, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell === '') quoted = true;
    else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\r' && input[index + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      index += 1;
    } else cell += character;
  }
  if (row.length || cell) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

try {
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = server.address().port;
  assert.equal((await request(port, '/api/admin/feedback/export')).status, 401);

  const [adminResult] = await pool.execute(
    'INSERT INTO admins (email, password_hash) VALUES (?, ?)',
    [email, await auth.hashAdminPassword(password)],
  );
  adminId = adminResult.insertId;
  for (const record of records) {
    const [result] = await pool.execute(
      `INSERT INTO feedback (name, email, feedback_type, rating, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [record.name, record.email, record.type, record.rating, record.message, record.created],
    );
    insertedIds.push(result.insertId);
  }

  let response = await request(port, '/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(response.status, 200);
  const cookie = response.headers['set-cookie'][0].split(';')[0];

  const query = new URLSearchParams({
    keyword: marker,
    startDate: today,
    endDate: today,
    feedbackType: 'Bug report',
    rating: '5',
    sort: 'oldest',
    page: '2',
    limit: '10',
  });
  response = await request(port, `/api/admin/feedback/export?${query}`, { cookie });
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /^text\/csv; charset=utf-8/u);
  assert.match(response.headers['content-disposition'], /^attachment; filename="feedback-\d{8}\.csv"$/u);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.ok(response.text.startsWith('\uFEFF'));

  const table = parseCsv(response.text);
  assert.equal(table.length, records.length + 1);
  assert.deepEqual(table[0], ['ID', 'Name', 'Email', 'Feedback Type', 'Rating', 'Rating Label', 'Message', 'Created At (UTC)']);
  assert.ok(table.slice(1).every((row) => row.length === 8));
  assert.ok(table.slice(1).every((row) => row[4] === '5' && row[5] === 'Excellent'));
  const dangerousName = table.find((row) => row[2] === `'${records[0].email}`);
  assert.ok(dangerousName);
  assert.equal(dangerousName[1], `'${records[0].name}`);
  assert.equal(dangerousName[6], `'  =1+1, "quoted"\r\nsecond line`);
  const dangerousEmail = table.find((row) => row[1] === ` ${marker} row`);
  assert.equal(dangerousEmail[2], `'${records[1].email}`);
  assert.equal(dangerousEmail[6], `'-2+3, ordinary text`);
  assert.ok(dangerousName[7].endsWith('UTC'));
  console.log('PASS: protected filtered export returns every matching row independent of page and limit');
  console.log('PASS: CSV headers, attachment metadata, UTC timestamps, quoting, embedded commas/quotes/newlines, and formula neutralization');

  response = await request(port, `/api/admin/feedback/export?${new URLSearchParams({ rating: '6' })}`, { cookie });
  assert.equal(response.status, 400);
  assert.match(JSON.parse(response.text).message, /Invalid export filters/u);
  console.log('PASS: export validates filter allowlists and returns safe errors');

  assert.equal(exportService.MAX_CSV_EXPORT_ROWS, 10000);
  const standalone = csv.serializeFeedbackCsv([{ id: 1, name: '\t=1+1', email: 'x@example.invalid', feedbackType: 'Other', rating: 1, message: 'line, "quote"', createdAt: new Date('2025-01-02T03:04:05.000Z') }]);
  assert.match(standalone, /"'\t=1\+1"/u);
  console.log('PASS: export row limit is fixed at 10,000 and leading tabs are neutralized');
} finally {
  if (insertedIds.length) {
    const placeholders = insertedIds.map(() => '?').join(',');
    await pool.execute(`DELETE FROM feedback WHERE id IN (${placeholders})`, insertedIds);
  }
  if (adminId) await pool.execute('DELETE FROM admins WHERE id = ?', [adminId]);
  await new Promise((resolve) => server.close(resolve));
  await database.closeDatabasePool();
}
