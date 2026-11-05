import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';

process.env.JWT_SECRET = 'phase-six-test-only-secret-value-0123456789';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const [{ default: app }, database, auth, dashboard] = await Promise.all([
  import('../src/app.js'),
  import('../src/config/database.js'),
  import('../src/services/authService.js'),
  import('../src/services/dashboardService.js'),
]);
const pool = database.getDatabasePool();
const suffix = randomUUID().replaceAll('-', '');
const adminEmail = `dashboard-${suffix}@example.invalid`;
const today = new Date();
const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
const weekStart = new Date(todayStart.getTime() - ((todayStart.getUTCDay() + 6) % 7) * 86400000);
const previousWeek = new Date(weekStart.getTime() - 86400000);
const datePart = (date) => date.toISOString().slice(0, 10);
const fixtures = [
  { date: `${datePart(todayStart)} 12:00:00`, rating: 5, feedbackType: 'Bug report' },
  { date: `${datePart(todayStart)} 13:00:00`, rating: 1, feedbackType: 'Feature request' },
  { date: `${datePart(weekStart)} 09:00:00`, rating: 3, feedbackType: 'Other' },
  { date: `${datePart(previousWeek)} 09:00:00`, rating: 2, feedbackType: 'Appreciation' },
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

function assertDistributionDelta(before, after, key, additions) {
  const oldCounts = new Map(before.map((item) => [item[key], item.count]));
  const addedCounts = new Map();
  for (const item of additions) addedCounts.set(item[key], (addedCounts.get(item[key]) || 0) + 1);
  for (const item of after) {
    assert.equal(item.count, (oldCounts.get(item[key]) || 0) + (addedCounts.get(item[key]) || 0), `${key} ${item[key]}`);
  }
}

try {
  // Verify Monday UTC week boundaries, including a week that crosses a year.
  const sunday = dashboard.getDashboardBoundaries(new Date('2026-01-04T15:30:00.000Z'));
  assert.equal(sunday.weekStart, '2025-12-29');
  assert.equal(sunday.todayStart, '2026-01-04');
  assert.equal(sunday.tomorrowStart, '2026-01-05');
  const yearEnd = dashboard.getDashboardBoundaries(new Date('2025-12-31T12:00:00.000Z'));
  assert.equal(yearEnd.tomorrowStart, '2026-01-01');
  console.log('PASS: UTC date boundaries use Monday week starts and handle month/year transitions');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = server.address().port;
  assert.equal((await request(port, '/api/admin/dashboard/stats')).status, 401);
  assert.equal((await request(port, '/api/admin/dashboard/charts')).status, 401);

  const password = 'phase-six-integration-password';
  const passwordHash = await auth.hashAdminPassword(password);
  const [adminResult] = await pool.execute('INSERT INTO admins (email, password_hash) VALUES (?, ?)', [adminEmail, passwordHash]);
  adminId = adminResult.insertId;
  let response = await request(port, '/api/auth/login', { method: 'POST', body: { email: adminEmail, password } });
  assert.equal(response.status, 200);
  const cookie = response.headers['set-cookie'][0].split(';')[0];

  const baselineStatsResponse = await request(port, '/api/admin/dashboard/stats', { cookie });
  const baselineChartsResponse = await request(port, '/api/admin/dashboard/charts', { cookie });
  assert.equal(baselineStatsResponse.status, 200);
  assert.equal(baselineChartsResponse.status, 200);
  const baselineStats = baselineStatsResponse.body.data;
  const baselineCharts = baselineChartsResponse.body.data;

  for (const [index, fixture] of fixtures.entries()) {
    const [result] = await pool.execute(
      `INSERT INTO feedback (name, email, feedback_type, rating, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`Dashboard fixture ${suffix} ${index}`, `fixture-${index}-${suffix}@example.invalid`, fixture.feedbackType,
        fixture.rating, `Known dashboard fixture ${suffix}`, fixture.date],
    );
    insertedIds.push(result.insertId);
  }

  const statsResponse = await request(port, '/api/admin/dashboard/stats', { cookie });
  assert.equal(statsResponse.status, 200);
  const stats = statsResponse.body.data;
  const todayDelta = 2 + (datePart(weekStart) === datePart(todayStart) ? 1 : 0);
  assert.deepEqual(stats, {
    totalFeedback: baselineStats.totalFeedback + fixtures.length,
    todayFeedback: baselineStats.todayFeedback + todayDelta,
    thisWeekFeedback: baselineStats.thisWeekFeedback + 3,
  });
  assert.ok(Number.isInteger(stats.totalFeedback) && Number.isInteger(stats.todayFeedback) && Number.isInteger(stats.thisWeekFeedback));
  console.log('PASS: total/today/this-week stats match known rows using UTC Monday-through-today boundaries');

  const chartsResponse = await request(port, '/api/admin/dashboard/charts', { cookie });
  assert.equal(chartsResponse.status, 200);
  const charts = chartsResponse.body.data;
  assert.equal(charts.feedbackVolume.length, 30);
  assert.equal(charts.ratingDistribution.length, 5);
  assert.equal(charts.feedbackTypeDistribution.length, 6);
  assert.equal(charts.feedbackVolume[0].date, dashboard.getDashboardBoundaries().chartStart);
  assert.equal(charts.feedbackVolume.at(-1).date, datePart(todayStart));
  assertDistributionDelta(
    baselineCharts.feedbackVolume,
    charts.feedbackVolume,
    'date',
    fixtures.map((fixture) => ({ ...fixture, date: fixture.date.slice(0, 10) })),
  );
  assertDistributionDelta(baselineCharts.ratingDistribution, charts.ratingDistribution, 'rating', fixtures);
  assertDistributionDelta(baselineCharts.feedbackTypeDistribution, charts.feedbackTypeDistribution, 'feedbackType', fixtures);
  console.log('PASS: 30-day volume, rating, and feedback-type charts match known fixture deltas and remain bounded');
} finally {
  if (insertedIds.length) {
    const placeholders = insertedIds.map(() => '?').join(',');
    await pool.execute(`DELETE FROM feedback WHERE id IN (${placeholders})`, insertedIds);
  }
  if (adminId) await pool.execute('DELETE FROM admins WHERE id = ?', [adminId]);
  await new Promise((resolve) => server.close(resolve));
  await database.closeDatabasePool();
}
