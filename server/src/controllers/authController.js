import { getAuthConfig } from '../config/auth.js';
import {
  findAdminByEmail, findAdminById, hashAdminPassword, isLegacyAdminPasswordHash,
  normalizeAdminEmail, signAdminToken, upgradeLegacyAdminPasswordHash, verifyAdminPassword,
} from '../services/authService.js';

const COOKIE_NAME = 'admin_session';
const COOKIE_PATH = '/api';
const COOKIE_MAX_AGE = (seconds) => seconds * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: COOKIE_PATH,
  };
}

export async function login(request, response, next) {
  try {
    const email = normalizeAdminEmail(request.body?.email);
    const password = request.body?.password;
    if (!email || typeof password !== 'string' || password.length > 1024 || !password) {
      return response.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const admin = await findAdminByEmail(email);
    let passwordMatches = false;
    if (admin && Buffer.byteLength(password, 'utf8') <= 1024) {
      passwordMatches = await verifyAdminPassword(password, admin.password_hash);
    }
    if (!passwordMatches) return response.status(401).json({ success: false, message: 'Invalid email or password.' });

    if (isLegacyAdminPasswordHash(admin.password_hash) && Buffer.byteLength(password, 'utf8') <= 72) {
      const newHash = await hashAdminPassword(password);
      await upgradeLegacyAdminPasswordHash(admin.id, admin.password_hash, newHash);
    }

    const auth = getAuthConfig();
    const token = signAdminToken(admin, auth);
    response.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: COOKIE_MAX_AGE(auth.expiresInSeconds) });
    return response.json({ success: true, admin: { id: admin.id, email: admin.email } });
  } catch (error) {
    next(error);
  }
}

export function logout(_request, response) {
  response.clearCookie(COOKIE_NAME, cookieOptions());
  return response.json({ success: true, message: 'Logged out.' });
}

export async function me(request, response, next) {
  try {
    const admin = await findAdminById(request.adminIdentity.id);
    if (!admin) return response.status(401).json({ success: false, message: 'Authentication required.' });
    return response.json({ success: true, admin: { id: admin.id, email: admin.email } });
  } catch (error) {
    next(error);
  }
}
