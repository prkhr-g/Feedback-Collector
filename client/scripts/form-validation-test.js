import assert from 'node:assert/strict';
import {
  FEEDBACK_TYPES,
  getSuggestedPrompt,
  RATING_OPTIONS,
  validateFeedbackForm,
} from '../src/utils/feedbackForm.js';

const validForm = {
  name: 'Zoë O’Connor',
  email: ' ADA@EXAMPLE.COM ',
  feedbackType: 'General feedback',
  rating: 5,
  message: '  A thoughtful message.\nWith a second line.  ',
};

assert.deepEqual(validateFeedbackForm(validForm, 'test-token'), {});
assert.deepEqual(FEEDBACK_TYPES, [
  'General feedback', 'Bug report', 'Feature request', 'Complaint', 'Appreciation', 'Other',
]);
assert.deepEqual(RATING_OPTIONS.map(({ value }) => value), [1, 2, 3, 4, 5]);
console.log('PASS: valid Unicode, normalized-ready, multiline feedback passes client validation');

const invalid = validateFeedbackForm({ ...validForm, name: '  ', email: 'bad', feedbackType: 'Unknown', rating: 6, message: 'x'.repeat(1001) }, '');
assert.deepEqual(Object.keys(invalid).sort(), ['email', 'feedbackType', 'message', 'name', 'rating', 'turnstileToken']);
assert.equal(validateFeedbackForm({ ...validForm, name: '😀'.repeat(100) }, 'token').name, undefined);
assert.ok(validateFeedbackForm({ ...validForm, name: 'Ada\nLovelace' }, 'token').name);
assert.ok(validateFeedbackForm({ ...validForm, message: 'hello\u0000world' }, 'token').message);
console.log('PASS: required fields, lengths, allowlists, rating bounds, and control characters match API rules');

assert.equal(getSuggestedPrompt('Bug report', 1), 'What went wrong, and what did you expect to happen?');
assert.equal(getSuggestedPrompt('Bug report', 5), 'What would you like us to know?');
assert.equal(getSuggestedPrompt('Feature request', 3), 'What would you like to be able to do?');
assert.equal(getSuggestedPrompt('Appreciation', 5), 'What worked particularly well for you?');
assert.equal(getSuggestedPrompt('General feedback', 0), 'What could we improve?');
console.log('PASS: starter prompts are deterministic for selected feedback type and rating');
