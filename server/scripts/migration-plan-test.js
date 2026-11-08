import assert from 'node:assert/strict';
import { planRows, sameAdmin, sameFeedback, sameTimestamp } from '../src/utils/dataMigration.js';

const sourceFeedback = {
  id: 8, name: 'Example', email: 'example@example.invalid', feedback_type: 'Other',
  rating: 3, message: 'Example message', created_at: '2024-07-08 09:10:11',
};
const targetFeedback = {
  ...sourceFeedback, id: '8', created_at: new Date('2024-07-08T09:10:11.000Z'),
};
assert.equal(sameTimestamp(sourceFeedback.created_at, targetFeedback.created_at), true);
assert.equal(sameFeedback(sourceFeedback, targetFeedback), true);
assert.deepEqual(planRows([sourceFeedback], [targetFeedback], sameFeedback), {
  missing: [], identical: 1, conflicts: 0,
});

const duplicateEmailFeedback = { ...sourceFeedback, id: 9 };
assert.deepEqual(planRows([duplicateEmailFeedback], [targetFeedback], sameFeedback), {
  missing: [duplicateEmailFeedback], identical: 0, conflicts: 0,
});
assert.equal(planRows([sourceFeedback], [{ ...targetFeedback, message: 'different' }], sameFeedback).conflicts, 1);

const sourceAdmin = {
  id: 2, email: 'admin@example.invalid', password_hash: 'opaque-hash',
  created_at: '2024-07-08 09:10:11',
};
const targetAdmin = { ...sourceAdmin, id: '2', created_at: new Date('2024-07-08T09:10:11.000Z') };
assert.equal(sameAdmin(sourceAdmin, targetAdmin), true);
assert.equal(planRows([sourceAdmin], [targetAdmin], sameAdmin, { emailUnique: true }).identical, 1);
assert.equal(
  planRows([sourceAdmin], [{ ...targetAdmin, id: '3' }], sameAdmin, { emailUnique: true }).conflicts,
  1,
);

console.log('PASS: MySQL DATETIME to PostgreSQL TIMESTAMPTZ comparisons preserve the same UTC instant');
console.log('PASS: migration plans skip identical rows, allow repeated feedback emails, and stop on ID/email conflicts');
