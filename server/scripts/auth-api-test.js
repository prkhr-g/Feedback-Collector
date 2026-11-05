import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import http from 'node:http';
import { promisify } from 'node:util';

process.env.JWT_SECRET = 'phase-four-test-only-secret-value-0123456789';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const [{ default: app }, database, auth] = await Promise.all([
  import('../src/app.js'),
  import('../src/config/database.js'),
  import('../src/services/authService.js'),
]);
const pool = database.getDatabasePool();
const email = `auth-test-${randomUUID()}@example.invalid`;
const password = 'phase-four-test-password-42';
const legacyEmail = `auth-legacy-test-${randomUUID()}@example.invalid`;
const legacyPassword = 'legacy-phase-four-password-42';
const scrypt = promisify(scryptCallback);
let adminId;
let legacyAdminId;
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

try {
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = server.address().port;
  let response = await request(port, '/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { success: true, status: 'ok' });
  console.log('PASS: Express health endpoint remains available');

  const passwordHash = await auth.hashAdminPassword(password);
  assert.match(passwordHash, /^\$2[aby]\$12\$/u);
  const [result] = await pool.execute('INSERT INTO admins (email, password_hash) VALUES (?, ?)', [email, passwordHash]);
  adminId = result.insertId;

  assert.equal(await auth.verifyAdminPassword(password, passwordHash), true);
  assert.equal(await auth.verifyAdminPassword(`${password}x`, passwordHash), false);
  assert.equal(await auth.verifyAdminPassword(`${password}${'x'.repeat(73)}`, passwordHash), false);
  console.log('PASS: password hash verifies correct credentials and rejects incorrect credentials');

  response = await request(port, '/api/auth/login', { method: 'POST', origin: null, body: { email, password } });
  assert.equal(response.status, 403);
  response = await request(port, '/api/auth/login', { method: 'POST', body: { email: 'missing@example.invalid', password } });
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { success: false, message: 'Invalid email or password.' });
  console.log('PASS: login enforces strict Origin and returns generic invalid-credential errors');

  response = await request(port, '/api/auth/login', { method: 'POST', body: { email: email.toUpperCase(), password } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.admin, { id: adminId, email });
  assert.equal(JSON.stringify(response.body).includes('token'), false);
  const setCookie = response.headers['set-cookie']?.[0];
  assert.ok(setCookie);
  assert.match(setCookie, /^admin_session=/u);
  assert.match(setCookie, /HttpOnly/u);
  assert.match(setCookie, /SameSite=Lax/u);
  assert.match(setCookie, /Path=\/api/u);
  const cookie = setCookie.split(';')[0];
  console.log('PASS: successful login sets scoped HttpOnly SameSite=Lax cookie and returns only minimal admin data');

  const legacySalt = randomBytes(16);
  const legacyKey = await scrypt(legacyPassword, legacySalt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const legacyHash = `scrypt$16384$8$1$${legacySalt.toString('base64url')}$${legacyKey.toString('base64url')}`;
  const [legacyResult] = await pool.execute(
    'INSERT INTO admins (email, password_hash) VALUES (?, ?)', [legacyEmail, legacyHash],
  );
  legacyAdminId = legacyResult.insertId;
  response = await request(port, '/api/auth/login', { method: 'POST', body: { email: legacyEmail, password: legacyPassword } });
  assert.equal(response.status, 200);
  const [upgradedRows] = await pool.execute('SELECT password_hash FROM admins WHERE id = ?', [legacyAdminId]);
  assert.match(upgradedRows[0].password_hash, /^\$2[aby]\$12\$/u);
  console.log('PASS: existing scrypt account upgrades to bcrypt after a successful login');

  response = await request(port, '/api/auth/me');
  assert.equal(response.status, 401);
  response = await request(port, '/api/auth/me', { cookie });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.admin, { id: adminId, email });
  const expiredCookie = `admin_session=${encodeURIComponent(auth.signAdminToken({ id: adminId, email }, { secret: process.env.JWT_SECRET, expiresInSeconds: 0 }))}`;
  response = await request(port, '/api/auth/me', { cookie: expiredCookie });
  assert.equal(response.status, 401);
  console.log('PASS: /me rejects missing and expired sessions and accepts a valid session');

  response = await request(port, '/api/auth/logout', { method: 'POST', cookie, origin: null });
  assert.equal(response.status, 403);
  response = await request(port, '/api/auth/logout', { method: 'POST', cookie });
  assert.equal(response.status, 200);
  assert.match(response.headers['set-cookie']?.[0] || '', /Expires=Thu, 01 Jan 1970 00:00:00 GMT/u);
  assert.match(response.headers['set-cookie']?.[0] || '', /Path=\/api/u);
  response = await request(port, '/api/auth/me', { cookie });
  assert.equal(response.status, 200);
  console.log('PASS: logout emits matching cookie clear attributes');

  for (let index = 0; index < 2; index += 1) {
    response = await request(port, '/api/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } });
    assert.equal(response.status, 401);
  }
  response = await request(port, '/api/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } });
  assert.equal(response.status, 429);
  console.log('PASS: login limiter allows five attempts and rejects the sixth per IP');
} finally {
  if (adminId) await pool.execute('DELETE FROM admins WHERE id = ?', [adminId]);
  if (legacyAdminId) await pool.execute('DELETE FROM admins WHERE id = ?', [legacyAdminId]);
  await new Promise((resolve) => server.close(resolve));
  await database.closeDatabasePool();
}
