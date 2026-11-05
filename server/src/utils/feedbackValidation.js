const FEEDBACK_TYPES = new Set([
  'General feedback',
  'Bug report',
  'Feature request',
  'Complaint',
  'Appreciation',
  'Other',
]);

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const MESSAGE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function characterCount(value) {
  return Array.from(value).length;
}

/**
 * Validate and normalize a public feedback payload.
 *
 * @param {unknown} body Parsed request body.
 * @returns {{ value?: object, errors?: Record<string, string> }} Normalized fields or field errors.
 */
export function validateFeedbackPayload(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) errors.name = 'Name is required.';
  else if (characterCount(name) > 100) errors.name = 'Name must be 100 characters or fewer.';
  else if (CONTROL_CHARACTERS.test(name)) errors.name = 'Name contains unsupported control characters.';

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!email) errors.email = 'Email is required.';
  else if (characterCount(email) > 255 || !SIMPLE_EMAIL.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  const feedbackType = typeof input.feedbackType === 'string' ? input.feedbackType : '';
  if (!FEEDBACK_TYPES.has(feedbackType)) errors.feedbackType = 'Choose a supported feedback type.';

  const rating = input.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.rating = 'Rating must be an integer from 1 to 5.';
  }

  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!message) errors.message = 'Message is required.';
  else if (characterCount(message) > 1000) errors.message = 'Message must be 1,000 characters or fewer.';
  else if (MESSAGE_CONTROL_CHARACTERS.test(message)) {
    errors.message = 'Message contains unsupported control characters.';
  }

  const turnstileToken = typeof input.turnstileToken === 'string'
    ? input.turnstileToken.trim()
    : '';
  if (!turnstileToken) errors.turnstileToken = 'Complete the CAPTCHA verification.';
  else if (turnstileToken.length > 2048) errors.turnstileToken = 'CAPTCHA token is too long.';

  if (Object.keys(errors).length > 0) return { errors };

  return {
    value: { name, email, feedbackType, rating, message, turnstileToken },
  };
}
