const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;

export function createIpRateLimiter({ message, maxRequests = MAX_REQUESTS, windowMs = WINDOW_MS }) {
  const requestsByIp = new Map();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of requestsByIp) {
      if (entry.resetAt <= now) requestsByIp.delete(ip);
    }
  }, windowMs);
  cleanupTimer.unref();

  return function ipRateLimiter(request, response, next) {
    const now = Date.now();
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    let entry = requestsByIp.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      requestsByIp.set(ip, entry);
    }
    entry.count += 1;
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    response.setHeader('RateLimit-Limit', maxRequests);
    response.setHeader('RateLimit-Remaining', remaining);
    response.setHeader('RateLimit-Reset', resetSeconds);
    if (entry.count > maxRequests) {
      response.setHeader('Retry-After', resetSeconds);
      response.status(429).json({ success: false, message });
      return;
    }
    next();
  };
}

/**
 * Limit public feedback attempts to five per IP in each 15-minute window.
 *
 * @param {import('express').Request} request Incoming request.
 * @param {import('express').Response} response Outgoing response.
 * @param {import('express').NextFunction} next Express continuation.
 * @returns {void}
 */
export const publicFeedbackRateLimiter = createIpRateLimiter({
  message: 'Too many submission attempts. Please try again later.',
});
