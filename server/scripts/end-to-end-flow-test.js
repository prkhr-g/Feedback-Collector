import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';

process.env.JWT_SECRET = 'phase-ten-end-to-end-test-secret-value';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.TURNSTILE_SECRET_KEY = 'phase-ten-test-turnstile-secret';
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(JSON.parse(options.body).response, 'phase-ten-test-token');
  return { ok: true, json: async () => ({ success: true }) };
};

const [{ default: app }, database, auth] = await Promise.all([
  import('../src/app.js'),
  import('../src/config/database.js'),
  import('../src/services/authService.js'),
]);
const pool = database.getDatabasePool();
const unique = randomUUID().replaceAll('-', '');
const marker = `endtoend${unique}`;
const email = `e2e-admin-${unique}@example.invalid`;
const password = 'phase-ten-e2e-password-42';
const server = app.listen(0, '127.0.0.1');
let feedbackId;
let adminId;

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
        let json;
        try { json = JSON.parse(text); } catch { /* CSV response */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

try {
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = server.address().port;
  const adminResult = await pool.query(
    'INSERT INTO admins (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, await auth.hashAdminPassword(password)],
  );
  adminId = adminResult.rows[0].id;

  let response = await request(port, '/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(response.status, 200, response.text);
  const cookie = response.headers['set-cookie'][0].split(';')[0];

  response = await request(port, '/api/admin/dashboard/stats', { cookie });
  assert.equal(response.status, 200, response.text);
  const baselineStats = response.json.data;
  response = await request(port, '/api/admin/dashboard/charts', { cookie });
  assert.equal(response.status, 200, response.text);
  const baselineCharts = response.json.data;

  response = await request(port, '/api/feedback', {
    method: 'POST',
    body: {
      name: `QA ${marker}`,
      email: `${marker}@example.invalid`,
      feedbackType: 'General feedback',
      rating: 4,
      message: `public submission ${marker}`,
      turnstileToken: 'phase-ten-test-token',
    },
  });
  assert.equal(response.status, 201, response.text);
  feedbackId = response.json.data.id;

  response = await request(port, `/api/admin/feedback?${new URLSearchParams({ keyword: marker })}`, { cookie });
  assert.equal(response.status, 200, response.text);
  const record = response.json.data.find((item) => item.id === feedbackId);
  assert.ok(record, 'publicly submitted feedback should appear in the authenticated admin list');
  assert.equal(record.email, `${marker}@example.invalid`);
  assert.equal(record.message, `public submission ${marker}`);

  response = await request(port, '/api/admin/dashboard/stats', { cookie });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.totalFeedback, baselineStats.totalFeedback + 1);
  assert.ok(response.json.data.todayFeedback >= baselineStats.todayFeedback);
  assert.ok(response.json.data.thisWeekFeedback >= baselineStats.thisWeekFeedback);

  response = await request(port, '/api/admin/dashboard/charts', { cookie });
  assert.equal(response.status, 200, response.text);
  const chartDate = new Date(record.createdAt).toISOString().slice(0, 10);
  const todayBefore = baselineCharts.feedbackVolume.find((item) => item.date === chartDate)?.count ?? 0;
  const todayAfter = response.json.data.feedbackVolume.find((item) => item.date === chartDate)?.count;
  assert.equal(todayAfter, todayBefore + 1);
  const ratingBefore = baselineCharts.ratingDistribution.find((item) => item.rating === record.rating)?.count ?? 0;
  const ratingAfter = response.json.data.ratingDistribution.find((item) => item.rating === record.rating)?.count;
  assert.equal(ratingAfter, ratingBefore + 1);
  const typeBefore = baselineCharts.feedbackTypeDistribution.find((item) => item.feedbackType === record.feedbackType)?.count ?? 0;
  const typeAfter = response.json.data.feedbackTypeDistribution.find((item) => item.feedbackType === record.feedbackType)?.count;
  assert.equal(typeAfter, typeBefore + 1);

  response = await request(port, `/api/admin/feedback/export?${new URLSearchParams({ keyword: marker })}`, { cookie });
  assert.equal(response.status, 200, response.text);
  assert.match(response.text, new RegExp(marker, 'u'));
  assert.match(response.headers['content-type'], /^text\/csv; charset=utf-8/u);

  response = await request(port, `/api/admin/feedback/${feedbackId}`, { method: 'DELETE', cookie });
  assert.equal(response.status, 200, response.text);
  const rows = await pool.query('SELECT id FROM feedback WHERE id = $1', [feedbackId]);
  assert.equal(rows.rows.length, 0);
  feedbackId = undefined;
  response = await request(port, '/api/admin/dashboard/stats', { cookie });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.data.totalFeedback, baselineStats.totalFeedback);
  console.log('PASS: public submission is verified and stored, appears in the authenticated admin list and CSV export, updates dashboard totals/charts, and deletion restores the total to baseline');
} finally {
  if (feedbackId) await pool.query('DELETE FROM feedback WHERE id = $1', [feedbackId]);
  if (adminId) await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await new Promise((resolve) => server.close(resolve));
  await database.closeDatabasePool();
}
