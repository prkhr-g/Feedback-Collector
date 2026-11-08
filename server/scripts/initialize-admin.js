import 'dotenv/config';
import { closeDatabasePool, getDatabasePool } from '../src/config/database.js';
import { hashAdminPassword, normalizeAdminEmail } from '../src/services/authService.js';

const email = normalizeAdminEmail(process.env.ADMIN_EMAIL);
const password = process.env.ADMIN_PASSWORD;

function validEmail(value) {
  return value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

async function initializeAdmin() {
  if (!validEmail(email) || typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set a valid ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters and at most 72 UTF-8 bytes in server/.env.');
  }
  const passwordHash = await hashAdminPassword(password);
  try {
    await getDatabasePool().query(
      'INSERT INTO admins (email, password_hash) VALUES ($1, $2)', [email, passwordHash],
    );
    console.log('Initial admin created.');
  } catch (error) {
    if (error.code === '23505') throw new Error('An admin with this email already exists; no account was changed.');
    throw error;
  } finally {
    await closeDatabasePool();
  }
}

initializeAdmin().catch((error) => {
  console.error(`Admin initialization failed: ${error.message.startsWith('DB_') || error.message.startsWith('Set ') || error.message.startsWith('An admin') ? error.message : 'Database operation failed.'}`);
  process.exitCode = 1;
});
