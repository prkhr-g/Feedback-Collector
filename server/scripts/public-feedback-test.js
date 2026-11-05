import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';

const TEST_SECRET = 'test-only-siteverify-secret';
process.env.TURNSTILE_SECRET_KEY = TEST_SECRET;

let siteverifyMode = 'success';
let siteverifyCalls = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(options.method, 'POST');
  const requestBody = JSON.parse(options.body);
  assert.equal(requestBody.secret, TEST_SECRET);
  assert.equal(requestBody.response, 'test-token');
  siteverifyCalls += 1;

  if (siteverifyMode === 'unavailable') throw new Error('Simulated provider outage');
  return {
    ok: true,
    json: async () => siteverifyMode === 'bad-secret'
      ? { success: false, 'error-codes': ['invalid-input-secret'] }
      : ({ success: siteverifyMode === 'success' }),
  };
};

const { default: app } = await import('../src/app.js');
const { closeDatabasePool, getDatabasePool } = await import('../src/config/database.js');
const { verifyTurnstileToken } = await import('../src/services/captchaService.js');
const { validateFeedbackPayload } = await import('../src/utils/feedbackValidation.js');
const pool = getDatabasePool();

function sendRequest(port, body, rawBody) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: '/api/feedback',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: text ? JSON.parse(text) : undefined,
        });
      });
    });
    request.on('error', reject);
    request.end(rawBody ?? JSON.stringify(body));
  });
}

const validPayload = {
  name: '  Zoë O’Connor  ',
  email: `  API-TEST-${randomUUID()}@EXAMPLE.INVALID `,
  feedbackType: 'General feedback',
  rating: 5,
  message: '  <script>alert("text")</script>  ',
  turnstileToken: 'test-token',
};

const validationResult = validateFeedbackPayload(validPayload);
assert.equal(validationResult.value.name, 'Zoë O’Connor');
assert.equal(validationResult.value.email, validPayload.email.trim().toLowerCase());
assert.equal(validationResult.value.message, '<script>alert("text")</script>');
assert.ok(validateFeedbackPayload({}).errors.name);
assert.ok(validateFeedbackPayload({}).errors.email);
assert.ok(validateFeedbackPayload({}).errors.feedbackType);
assert.ok(validateFeedbackPayload({}).errors.rating);
assert.ok(validateFeedbackPayload({}).errors.message);
assert.ok(validateFeedbackPayload({}).errors.turnstileToken);
assert.equal(validateFeedbackPayload({ ...validPayload, name: `a${'a'.repeat(100)}` }).errors.name, 'Name must be 100 characters or fewer.');
assert.equal(validateFeedbackPayload({ ...validPayload, message: 'm'.repeat(1001) }).errors.message, 'Message must be 1,000 characters or fewer.');
assert.equal(validateFeedbackPayload({ ...validPayload, email: 'invalid' }).errors.email, 'Enter a valid email address.');
assert.ok(validateFeedbackPayload({ ...validPayload, name: 'Ada\nLovelace' }).errors.name);
console.log('PASS: required fields, limits, type/rating allowlists, control characters, and Unicode normalization');

const server = app.listen(0, '127.0.0.1');
let insertedId;

try {
  siteverifyMode = 'bad-secret';
  await assert.rejects(
    verifyTurnstileToken('test-token'),
    (error) => error.code === 'TURNSTILE_UNAVAILABLE',
  );
  siteverifyMode = 'success';
  console.log('PASS: invalid Siteverify secret is treated as a safe provider/configuration failure');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = server.address().port;

  const created = await sendRequest(port, validPayload);
  assert.equal(created.status, 201);
  assert.equal(created.body.success, true);
  insertedId = created.body.data.id;
  assert.equal(created.headers['x-content-type-options'], 'nosniff');
  assert.equal(created.headers['x-frame-options'], 'SAMEORIGIN');
  assert.equal(created.headers['referrer-policy'], 'no-referrer');
  assert.equal(created.headers['x-powered-by'], undefined);
  const contentSecurityPolicy = created.headers['content-security-policy'];
  assert.match(contentSecurityPolicy, /script-src 'self' https:\/\/challenges\.cloudflare\.com/u);
  assert.match(contentSecurityPolicy, /frame-src https:\/\/challenges\.cloudflare\.com/u);
  console.log('PASS: Content Security Policy permits the Turnstile script and iframe origins');

  const [storedRows] = await pool.execute(
    'SELECT name, email, feedback_type AS feedbackType, rating, message FROM feedback WHERE id = ?',
    [insertedId],
  );
  assert.equal(storedRows.length, 1);
  assert.equal(storedRows[0].name, 'Zoë O’Connor');
  assert.equal(storedRows[0].email, validPayload.email.trim().toLowerCase());
  assert.equal(storedRows[0].message, '<script>alert("text")</script>');
  await pool.execute('DELETE FROM feedback WHERE id = ?', [insertedId]);
  insertedId = undefined;
  console.log('PASS: valid request verifies CAPTCHA and stores normalized Unicode/text data');

  const callsBeforeInvalid = siteverifyCalls;
  const invalid = await sendRequest(port, { ...validPayload, rating: 6, feedbackType: 'Unknown' });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.errors.rating);
  assert.ok(invalid.body.errors.feedbackType);
  assert.equal(siteverifyCalls, callsBeforeInvalid);
  console.log('PASS: invalid fields are rejected before Siteverify or database access');

  siteverifyMode = 'rejected';
  const captchaRejected = await sendRequest(port, validPayload);
  assert.equal(captchaRejected.status, 400);
  assert.equal(captchaRejected.body.success, false);
  const [rejectedRows] = await pool.execute(
    'SELECT COUNT(*) AS count FROM feedback WHERE email = ?',
    [validPayload.email.trim().toLowerCase()],
  );
  assert.equal(Number(rejectedRows[0].count), 0);
  console.log('PASS: rejected CAPTCHA does not create feedback');

  siteverifyMode = 'unavailable';
  const providerFailure = await sendRequest(port, validPayload);
  assert.equal(providerFailure.status, 503);
  assert.equal(providerFailure.body.success, false);
  assert.equal(JSON.stringify(providerFailure.body).includes(TEST_SECRET), false);
  console.log('PASS: Siteverify outage returns a safe 503 without exposing the secret');

  const malformed = await sendRequest(port, undefined, '{invalid json');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.message, 'Request body must be valid JSON.');
  console.log('PASS: malformed JSON returns a safe 400');

  const rateLimited = await sendRequest(port, validPayload);
  assert.equal(rateLimited.status, 429);
  assert.ok(rateLimited.headers['retry-after']);
  assert.equal(siteverifyCalls, 4);
  console.log('PASS: sixth attempt is rate limited before body validation and Siteverify');
} finally {
  if (insertedId) {
    await getDatabasePool().execute('DELETE FROM feedback WHERE id = ?', [insertedId]);
  }
  await new Promise((resolve) => server.close(resolve));
  await closeDatabasePool();
}
