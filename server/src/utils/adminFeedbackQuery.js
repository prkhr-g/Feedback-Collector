const FEEDBACK_TYPES = new Set([
  'General feedback', 'Bug report', 'Feature request', 'Complaint', 'Appreciation', 'Other',
]);
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

function singleString(value) {
  return typeof value === 'string' ? value : undefined;
}

function validUtcDate(value) {
  const match = DATE_PATTERN.exec(value || '');
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

/** Validate and normalize list filters without incorporating user strings in SQL. */
export function parseAdminFeedbackQuery(query) {
  const errors = {};
  const keywordInput = singleString(query.keyword);
  const keyword = keywordInput?.trim() ?? '';
  if (query.keyword !== undefined && keywordInput === undefined) errors.keyword = 'Keyword must be a single string.';
  else if (keyword.length > 100) errors.keyword = 'Keyword must be 100 characters or fewer.';
  else if (/[\u0000-\u001f\u007f-\u009f]/u.test(keyword)) errors.keyword = 'Keyword contains unsupported control characters.';

  const startDate = singleString(query.startDate);
  const endDate = singleString(query.endDate);
  if (query.startDate !== undefined && (startDate === undefined || !validUtcDate(startDate))) {
    errors.startDate = 'Start date must be a valid YYYY-MM-DD date.';
  }
  if (query.endDate !== undefined && (endDate === undefined || !validUtcDate(endDate))) {
    errors.endDate = 'End date must be a valid YYYY-MM-DD date.';
  }
  if (validUtcDate(startDate) && validUtcDate(endDate) && startDate > endDate) {
    errors.dateRange = 'Start date must be on or before end date.';
  }
  if (endDate === '9999-12-31') errors.endDate = 'End date is outside the supported MySQL date range.';

  const feedbackType = singleString(query.feedbackType);
  if (query.feedbackType !== undefined && (feedbackType === undefined || !FEEDBACK_TYPES.has(feedbackType))) {
    errors.feedbackType = 'Choose a supported feedback type.';
  }

  let rating;
  if (query.rating !== undefined) {
    const value = singleString(query.rating);
    if (value === undefined || !/^[1-5]$/u.test(value)) errors.rating = 'Rating must be an integer from 1 to 5.';
    else rating = Number(value);
  }

  let page = 1;
  if (query.page !== undefined) {
    const value = singleString(query.page);
    if (value === undefined || !/^\d{1,7}$/u.test(value) || Number(value) < 1) errors.page = 'Page must be a positive integer.';
    else page = Number(value);
  }

  let limit = 10;
  if (query.limit !== undefined) {
    const value = singleString(query.limit);
    if (value === undefined || !/^(?:10|20|50)$/u.test(value)) errors.limit = 'Limit must be 10, 20, or 50.';
    else limit = Number(value);
  }

  const sortInput = singleString(query.sort);
  const sort = sortInput ?? 'newest';
  if (query.sort !== undefined && (sortInput === undefined || !['newest', 'oldest'].includes(sort))) {
    errors.sort = 'Sort must be newest or oldest.';
  }

  if (Object.keys(errors).length) return { errors };
  return { value: { keyword, startDate, endDate, feedbackType, rating, page, limit, sort } };
}

/** Return the exclusive next-day UTC boundary for an inclusive end date. */
export function nextUtcDate(date) {
  if (!date) return undefined;
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + 86400000).toISOString().slice(0, 10);
}
