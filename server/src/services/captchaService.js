const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SITEVERIFY_TIMEOUT_MS = 5_000;

/**
 * Verify a Turnstile token with Cloudflare Siteverify.
 *
 * @param {string} token User-submitted token.
 * @returns {Promise<boolean>} Whether Cloudflare accepted the token.
 * @throws {Error} When the provider cannot be reached or returns an invalid response.
 */
export async function verifyTurnstileToken(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    const error = new Error('Turnstile server key is not configured');
    error.code = 'TURNSTILE_UNAVAILABLE';
    throw error;
  }

  let response;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error('Siteverify returned a non-success status');
    const result = await response.json();
    if (typeof result.success !== 'boolean') throw new Error('Siteverify response was invalid');
    const errorCodes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];
    if (errorCodes.some((code) => [
      'missing-input-secret',
      'invalid-input-secret',
      'bad-request',
      'internal-error',
    ].includes(code))) {
      throw new Error('Siteverify reported a configuration or provider error');
    }
    return result.success;
  } catch {
    const error = new Error('Turnstile verification service is unavailable');
    error.code = 'TURNSTILE_UNAVAILABLE';
    throw error;
  }
}
