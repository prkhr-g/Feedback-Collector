import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';

process.env.JWT_SECRET = 'phase-five-test-only-secret-value-0123456789';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const [{ default: app }, database, auth] = await Promise.all([
  import('../src/app.js'),
  import('../src/config/database.js'),
  import('../src/services/authService.js'),
]);
const pool = database.getDatabasePool();
const unique = randomUUID().replaceAll('-', '');
const marker = `phasefive${unique}`;
const adminEmail = `phase-five-${unique}@example.invalid`;
const records = [
  { name: `${marker} Alpha`, email: `a-${unique}@example.invalid`, type: 'Bug report', rating: 5, message: 'first match', created: '2025-04-01 00:00:00' },
  { name: 'Beta', email: `${marker}@example.invalid`, type: 'Bug report', rating: 5, message: 'end boundary', created: '2025-04-02 23:59:59' },
  { name: 'Gamma', email: `c-${unique}@example.invalid`, type: 'Bug report', rating: 4, message: `contains ${marker}`, created: '2025-04-02 12:00:00' },
  { name: `${marker}%`, email: `d-${unique}@example.invalid`, type: 'Feature request', rating: 5, message: 'literal wildcard', created: '2025-04-02 10:00:00' },
  { name: marker, email: `e-${unique}@example.invalid`, type: 'Bug report', rating: 5, message: 'before range', created: '2025-03-31 23:59:59' },
  ...Array.from({ length: 8 }, (_, index) => ({
    name: `${marker} page ${index + 1}`,
    email: `p${index}-${unique}@example.invalid`,
    type: 'Appreciation', rating: 3, message: `pagination ${index + 1}`,
    created: `2025-04-0${(index % 2) + 1} 08:00:0${index}`,
  })),
];
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
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : undefined });
      });
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

function queryString(values) {
  return new URLSearchParams(values).toString();
}

try {
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = server.address().port;
  let response = await request(port, '/api/admin/feedback');
  assert.equal(response.status, 401);
  assert.equal((await request(port, '/api/admin/feedback/1')).status, 401);
  assert.equal((await request(port, '/api/admin/feedback/1', { method: 'DELETE' })).status, 401);

  const password = 'phase-five-integration-password';
  const hash = await auth.hashAdminPassword(password);
  const [adminResult] = await pool.execute('INSERT INTO admins (email, password_hash) VALUES (?, ?)', [adminEmail, hash]);
  adminId = adminResult.insertId;
  for (const record of records) {
    const [result] = await pool.execute(
      `INSERT INTO feedback (name, email, feedback_type, rating, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [record.name, record.email, record.type, record.rating, record.message, record.created],
    );
    insertedIds.push(result.insertId);
  }

  response = await request(port, '/api/auth/login', { method: 'POST', body: { email: adminEmail, password } });
  assert.equal(response.status, 200);
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  console.log('PASS: every feedback management route rejects unauthenticated requests');

  response = await request(port, `/api/admin/feedback?${queryString({ keyword: marker, feedbackType: 'Bug report', rating: '5', startDate: '2025-04-01', endDate: '2025-04-02', sort: 'newest' })}`, { cookie });
  assert.equal(response.status, 200);
  assert.equal(response.body.pagination.totalRecords, 2);
  assert.equal(response.body.data.length, 2);
  assert.equal(response.body.data[0].email, `${marker}@example.invalid`);
  assert.equal(response.body.pagination.currentPage, 1);
  console.log('PASS: combined keyword/type/rating/date filters include the full inclusive UTC end date');
  response = await request(port, `/api/admin/feedback?${queryString({ keyword: marker, feedbackType: 'Bug report', rating: '4' })}`, { cookie });
  assert.equal(response.body.pagination.totalRecords, 1);
  assert.match(response.body.data[0].message, /contains/u);
  console.log('PASS: keyword search covers message text as well as name and email');

  response = await request(port, `/api/admin/feedback?${queryString({ keyword: `${marker}%`, limit: '10' })}`, { cookie });
  assert.equal(response.status, 200);
  assert.equal(response.body.pagination.totalRecords, 1);
  assert.equal(response.body.data[0].name, `${marker}%`);
  console.log('PASS: LIKE wildcards in user keywords are escaped and treated literally');

  response = await request(port, `/api/admin/feedback?${queryString({ keyword: marker, limit: '10', page: '1', sort: 'oldest' })}`, { cookie });
  assert.equal(response.status, 200);
  assert.equal(response.body.pagination.totalRecords, records.length);
  assert.equal(response.body.pagination.totalPages, 2);
  assert.equal(response.body.data.length, 10);
  assert.ok(response.body.data[0].createdAt <= response.body.data[9].createdAt);
  const secondPage = await request(port, `/api/admin/feedback?${queryString({ keyword: marker, limit: '10', page: '2', sort: 'oldest' })}`, { cookie });
  assert.equal(secondPage.body.pagination.currentPage, 2);
  assert.equal(secondPage.body.data.length, 3);
  const outOfRange = await request(port, `/api/admin/feedback?${queryString({ keyword: marker, limit: '10', page: '99' })}`, { cookie });
  assert.equal(outOfRange.body.pagination.currentPage, 2);
  console.log('PASS: server pagination, allowed page size, stable sort, and out-of-range page clamping');

  for (const invalid of [
    'startDate=2025-02-30', 'startDate=2025-04-03&endDate=2025-04-02',
    'rating=6', 'limit=15', 'sort=random', 'page=0', 'feedbackType=unknown', 'page=1&page=2',
  ]) {
    response = await request(port, `/api/admin/feedback?${invalid}`, { cookie });
    assert.equal(response.status, 400, invalid);
  }
  console.log('PASS: malformed dates, reversed dates, and invalid filter/pagination values return 400');

  response = await request(port, `/api/admin/feedback/${insertedIds[0]}`, { cookie });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.id, insertedIds[0]);
  assert.equal((await request(port, '/api/admin/feedback/not-an-id', { cookie })).status, 400);
  assert.equal((await request(port, '/api/admin/feedback/4294967295', { cookie })).status, 404);
  assert.equal((await request(port, '/api/admin/feedback/4294967295', { method: 'DELETE', cookie })).status, 404);
  console.log('PASS: protected detail lookup validates IDs and returns 404 for missing records');

  response = await request(port, `/api/admin/feedback/${insertedIds[0]}`, { method: 'DELETE', cookie, origin: null });
  assert.equal(response.status, 403);
  response = await request(port, `/api/admin/feedback/${insertedIds[0]}`, { method: 'DELETE', cookie });
  assert.equal(response.status, 200);
  const deletedId = insertedIds.shift();
  assert.equal((await request(port, `/api/admin/feedback/${deletedId}`, { cookie })).status, 404);
  console.log('PASS: delete requires same Origin and removes only the parameterized target row');
} finally {
  if (insertedIds.length) {
    const placeholders = insertedIds.map(() => '?').join(',');
    await pool.execute(`DELETE FROM feedback WHERE id IN (${placeholders})`, insertedIds);
  }
  if (adminId) await pool.execute('DELETE FROM admins WHERE id = ?', [adminId]);
  await new Promise((resolve) => server.close(resolve));
  await database.closeDatabasePool();
}
