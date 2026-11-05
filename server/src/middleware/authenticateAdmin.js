import { verifyAdminToken } from '../services/authService.js';
import { getAuthConfig } from '../config/auth.js';

function readCookie(header, name) {
  for (const part of (header || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return ''; }
  }
  return '';
}

export function authenticateAdmin(request, response, next) {
  const { secret } = getAuthConfig();
  const token = readCookie(request.headers.cookie, 'admin_session');
  const identity = token ? verifyAdminToken(token, secret) : null;
  if (!identity) return response.status(401).json({ success: false, message: 'Authentication required.' });
  request.adminIdentity = identity;
  next();
}
