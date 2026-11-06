/**
 * Apply baseline browser security headers to API responses.
 *
 * @param {import('express').Request} request Incoming request.
 * @param {import('express').Response} response Outgoing response.
 * @param {import('express').NextFunction} next Express continuation.
 * @returns {void}
 */
export function securityHeaders(_request, response, next) {
  response.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-DNS-Prefetch-Control': 'off',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Permitted-Cross-Domain-Policies': 'none',
  });

  if (process.env.NODE_ENV === 'production') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }

  next();
}
