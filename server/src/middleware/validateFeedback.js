import { validateFeedbackPayload } from '../utils/feedbackValidation.js';

/**
 * Validate and attach normalized public feedback fields.
 *
 * @param {import('express').Request} request Incoming request.
 * @param {import('express').Response} response Outgoing response.
 * @param {import('express').NextFunction} next Express continuation.
 * @returns {void}
 */
export function validateFeedback(request, response, next) {
  const { value, errors } = validateFeedbackPayload(request.body);
  if (errors) {
    response.status(400).json({
      success: false,
      message: 'Please correct the feedback fields and try again.',
      errors,
    });
    return;
  }

  request.validatedFeedback = value;
  next();
}
