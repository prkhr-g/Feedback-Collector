export class FeedbackApiError extends Error {
  constructor(message, status = 0, errors = {}) {
    super(message);
    this.name = 'FeedbackApiError';
    this.status = status;
    this.errors = errors;
  }
}

/** Submit one normalized public feedback payload to the backend. */
export async function submitFeedback(payload) {
  let response;
  try {
    response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new FeedbackApiError('We could not reach the server. Check your connection and try again.');
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    throw new FeedbackApiError(
      result.message || 'Your feedback could not be sent. Please try again.',
      response.status,
      result.errors && typeof result.errors === 'object' ? result.errors : {},
    );
  }

  return result;
}
