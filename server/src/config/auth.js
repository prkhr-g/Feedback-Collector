export function getAuthConfig(env = process.env) {
  const secret = env.JWT_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 bytes');
  }
  const originValue = env.CLIENT_ORIGIN?.trim();
  let clientOrigin;
  try {
    clientOrigin = new URL(originValue).origin;
  } catch {
    throw new Error('CLIENT_ORIGIN must be set to an absolute URL');
  }
  if (env.NODE_ENV === 'production' && new URL(originValue).protocol !== 'https:') {
    throw new Error('CLIENT_ORIGIN must use HTTPS in production');
  }
  const expiresIn = env.JWT_EXPIRES_IN?.trim() || '1d';
  const match = /^(\d+)(s|m|h|d)$/u.exec(expiresIn);
  if (!match || Number(match[1]) < 1) throw new Error('JWT_EXPIRES_IN must be a positive number followed by s, m, h, or d');
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  const expiresInSeconds = Number(match[1]) * factor;
  if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds > 30 * 86400) {
    throw new Error('JWT_EXPIRES_IN must not exceed 30 days');
  }
  return { secret, clientOrigin, expiresInSeconds };
}
