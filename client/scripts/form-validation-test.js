import assert from 'node:assert/strict';
import {
  FEEDBACK_TYPES,
  getFeedbackSuggestions,
  getSuggestionKeyAction,
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

for (const type of FEEDBACK_TYPES) {
  for (const { value: rating } of RATING_OPTIONS) {
    const suggestions = getFeedbackSuggestions(type, rating);
    assert.equal(suggestions.length, 3, `${type} · rating ${rating} has exactly three suggestions`);
    assert.ok(suggestions.every((suggestion) => suggestion.trim().length > 20));
    assert.ok(suggestions.every((suggestion) => !suggestion.includes('?')), `${type} · rating ${rating} contains statements, not questions`);
  }
}
assert.ok(getFeedbackSuggestions('General feedback', 5).includes('The overall experience was excellent.'));
assert.ok(getFeedbackSuggestions('General feedback', 3).includes('The experience was satisfactory, but there is room for improvement.'));
assert.ok(getFeedbackSuggestions('Bug report', 1).includes('The application frequently crashes while performing basic tasks.'));
assert.ok(getFeedbackSuggestions('Bug report', 2).includes('Several features are not working as expected.'));
assert.ok(getFeedbackSuggestions('Feature request', 5).includes('I would love to see more features added in future updates.'));
assert.ok(getFeedbackSuggestions('Complaint', 1).includes('I am disappointed with the service and the way my issue was handled.'));
assert.ok(getFeedbackSuggestions('Appreciation', 5).includes("The service was excellent, and I really appreciate the team's efforts."));
assert.equal(getFeedbackSuggestions('Unknown', 3).length, 0);
console.log('PASS: all 30 feedback type/rating combinations have context-specific statement suggestions, including the requested examples');

assert.ok(getFeedbackSuggestions('General feedback', 5, 'EXCELLENT').every((suggestion) => suggestion.toLowerCase().includes('excellent')));
assert.equal(getFeedbackSuggestions('Bug report', 1, 'nothing matches this custom text').length, 0);
assert.equal(getFeedbackSuggestions('Complaint', 0).length, 15, 'no selected rating shows three suggestions for each rating of the selected type');
console.log('PASS: suggestion filtering is case-insensitive, custom input can have no matches, and empty input returns relevant defaults');

assert.deepEqual(getSuggestionKeyAction('ArrowDown', -1, 3), { type: 'move', index: 0 });
assert.deepEqual(getSuggestionKeyAction('ArrowDown', 2, 3), { type: 'move', index: 0 });
assert.deepEqual(getSuggestionKeyAction('ArrowUp', -1, 3), { type: 'move', index: 2 });
assert.deepEqual(getSuggestionKeyAction('ArrowUp', 0, 3), { type: 'move', index: 2 });
assert.deepEqual(getSuggestionKeyAction('Enter', 1, 3), { type: 'select', index: 1 });
assert.equal(getSuggestionKeyAction('Enter', -1, 3), null, 'Enter without a highlighted option remains available for multiline text');
assert.deepEqual(getSuggestionKeyAction('Escape', -1, 0), { type: 'close' });
console.log('PASS: Arrow Up/Down wrap through options, Enter selects only a highlighted option, and Escape closes');
