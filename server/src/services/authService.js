import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabasePool } from '../config/database.js';

const scrypt = promisify(scryptCallback);
const ISSUER = 'feedback-collector';
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const BCRYPT_ROUNDS = 12;

export function normalizeAdminEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export async function hashAdminPassword(password) {
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Admin passwords must be no longer than 72 UTF-8 bytes for bcrypt.');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyAdminPassword(password, storedHash) {
  if (/^\$2[aby]\$\d{2}\$/u.test(storedHash)) {
    if (Buffer.byteLength(password, 'utf8') > 72) return false;
    return bcrypt.compare(password, storedHash);
  }

  // Existing accounts created before bcrypt was installed remain verifiable.
  // A successful login upgrades their hash to bcrypt in the controller.
  const [algorithm, n, r, p, saltValue, keyValue, ...extra] = String(storedHash).split('$');
  if (algorithm !== 'scrypt' || extra.length
    || n !== String(SCRYPT_N) || r !== String(SCRYPT_R) || p !== String(SCRYPT_P)) return false;
  const salt = Buffer.from(saltValue, 'base64url');
  const expected = Buffer.from(keyValue, 'base64url');
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(password, salt, expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(actual, expected);
}

export function isLegacyAdminPasswordHash(storedHash) {
  return typeof storedHash === 'string' && storedHash.startsWith('scrypt$');
}

export function signAdminToken(admin, { secret, expiresInSeconds }) {
  return jwt.sign(
    { email: admin.email },
    secret,
    { algorithm: 'HS256', issuer: ISSUER, subject: String(admin.id), expiresIn: expiresInSeconds },
  );
}

export function verifyAdminToken(token, secret) {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: ISSUER });
    if (typeof payload !== 'object' || typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function upgradeLegacyAdminPasswordHash(id, oldHash, newHash) {
  await getDatabasePool().execute(
    'UPDATE admins SET password_hash = ? WHERE id = ? AND password_hash = ?',
    [newHash, id, oldHash],
  );
}

export async function findAdminByEmail(email) {
  const [rows] = await getDatabasePool().execute(
    'SELECT id, email, password_hash FROM admins WHERE email = ? LIMIT 1', [email],
  );
  return rows[0] ?? null;
}

export async function findAdminById(id) {
  const [rows] = await getDatabasePool().execute(
    'SELECT id, email FROM admins WHERE id = ? LIMIT 1', [id],
  );
  return rows[0] ?? null;
}
