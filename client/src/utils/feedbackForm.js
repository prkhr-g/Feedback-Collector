import { FEEDBACK_SUGGESTIONS } from '../data/feedbackSuggestions.js';

export const FEEDBACK_TYPES = [
  'General feedback',
  'Bug report',
  'Feature request',
  'Complaint',
  'Appreciation',
  'Other',
];

export const RATING_OPTIONS = [
  { value: 1, label: 'Very poor' },
  { value: 2, label: 'Poor' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Excellent' },
];

const NAME_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const MESSAGE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** Return field errors using the same limits as the public API. */
export function validateFeedbackForm(values, turnstileToken) {
  const errors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const message = values.message.trim();

  if (!name) errors.name = 'Enter your name.';
  else if (Array.from(name).length > 100) errors.name = 'Use 100 characters or fewer.';
  else if (NAME_CONTROL_CHARACTERS.test(name)) errors.name = 'Remove unsupported control characters.';

  if (!email) errors.email = 'Enter your email address.';
  else if (Array.from(email).length > 255 || !SIMPLE_EMAIL.test(email)) errors.email = 'Enter a valid email address.';

  if (!FEEDBACK_TYPES.includes(values.feedbackType)) errors.feedbackType = 'Choose a feedback type.';
  if (!Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5) {
    errors.rating = 'Choose a rating from 1 to 5.';
  }

  if (!message) errors.message = 'Write a short message before sending.';
  else if (Array.from(message).length > 1000) errors.message = 'Use 1,000 characters or fewer.';
  else if (MESSAGE_CONTROL_CHARACTERS.test(message)) errors.message = 'Remove unsupported control characters.';

  if (!turnstileToken) errors.turnstileToken = 'Complete the verification before sending.';
  return errors;
}

/** Return matching feedback statements for a type, rating, and current message. */
export function getFeedbackSuggestions(feedbackType, rating, currentMessage = '') {
  const suggestionsByRating = FEEDBACK_SUGGESTIONS[feedbackType];
  if (!suggestionsByRating) return [];

  const suggestions = Number.isInteger(rating) && rating >= 1 && rating <= 5
    ? suggestionsByRating[rating]
    : Object.values(suggestionsByRating).flat();
  const search = currentMessage.trim().toLocaleLowerCase();
  if (!search) return suggestions;
  return suggestions.filter((suggestion) => suggestion.toLocaleLowerCase().includes(search));
}

/** Map textarea keys to suggestion navigation actions. */
export function getSuggestionKeyAction(key, activeIndex, suggestionCount) {
  if (key === 'Escape') return { type: 'close' };
  if (suggestionCount < 1) return null;
  if (key === 'ArrowDown') {
    return { type: 'move', index: activeIndex < 0 ? 0 : (activeIndex + 1) % suggestionCount };
  }
  if (key === 'ArrowUp') {
    return { type: 'move', index: activeIndex < 0 ? suggestionCount - 1 : (activeIndex - 1 + suggestionCount) % suggestionCount };
  }
  if (key === 'Enter' && activeIndex >= 0 && activeIndex < suggestionCount) {
    return { type: 'select', index: activeIndex };
  }
  return null;
}
