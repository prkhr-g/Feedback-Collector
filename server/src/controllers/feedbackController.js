import { verifyTurnstileToken } from '../services/captchaService.js';
import { createFeedback } from '../services/feedbackService.js';

/**
 * Verify CAPTCHA and create the public feedback record.
 *
 * @param {import('express').Request} request Validated request.
 * @param {import('express').Response} response Outgoing response.
 * @param {import('express').NextFunction} next Express error continuation.
 * @returns {Promise<void>}
 */
export async function submitFeedback(request, response, next) {
  try {
    const { turnstileToken, ...feedback } = request.validatedFeedback;
    const verified = await verifyTurnstileToken(turnstileToken);

    if (!verified) {
      response.status(400).json({
        success: false,
        message: 'CAPTCHA verification failed. Please complete it again.',
      });
      return;
    }

    const id = await createFeedback(feedback);
    response.status(201).json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
}
