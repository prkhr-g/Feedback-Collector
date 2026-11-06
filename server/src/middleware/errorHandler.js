/**
 * Convert parser and service errors into safe API responses.
 *
 * @param {Error & { status?: number, type?: string, code?: string }} error Error from middleware or a service.
 * @param {import('express').Request} _request Incoming request.
 * @param {import('express').Response} response Outgoing response.
 * @param {import('express').NextFunction} next Express continuation.
 * @returns {void}
 */
export function errorHandler(error, _request, response, next) {
  if (response.headersSent) return next(error);

  if (error.type === 'entity.too.large') {
    return response.status(413).json({ success: false, message: 'Request body is too large.' });
  }

  if (error instanceof SyntaxError && error.status === 400) {
    return response.status(400).json({ success: false, message: 'Request body must be valid JSON.' });
  }

  if (error.code === 'TURNSTILE_UNAVAILABLE') {
    return response.status(503).json({
      success: false,
      message: 'CAPTCHA verification is temporarily unavailable. Please try again.',
    });
  }

  if (error.code && /^(?:08|53|57P\d|ECONN|EACCES|EHOSTUNREACH|ETIMEDOUT|ENOTFOUND)/u.test(error.code)) {
    return response.status(503).json({
      success: false,
      message: 'The request could not be completed right now. Please try again.',
    });
  }

  return response.status(500).json({
    success: false,
    message: 'An unexpected error occurred.',
  });
}
