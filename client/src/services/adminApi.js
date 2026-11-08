export class AdminApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

/** Call the same-origin admin API; the browser sends its HttpOnly session cookie. */
export async function adminApi(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new AdminApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminApiError(result.message || 'The request could not be completed.', response.status);
  }
  return result;
}

export function createFeedbackQuery({ filters, page, limit }) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort: filters.sort });
  for (const key of ['keyword', 'startDate', 'endDate', 'feedbackType', 'rating']) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return params.toString();
}

/** Build export filters without carrying list pagination into the download. */
export function createExportQuery(filters) {
  const params = new URLSearchParams({ sort: filters.sort });
  for (const key of ['keyword', 'startDate', 'endDate', 'feedbackType', 'rating']) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return params.toString();
}

function getDownloadDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}${month}${day}`;
}

/** Download a protected export file from the same-origin API. */
export async function downloadFeedbackExport(filters, format = 'csv') {
  let response;
  try {
    response = await fetch(`/api/admin/feedback/export?format=${format}&${createExportQuery(filters)}`, {
      credentials: 'same-origin',
    });
  } catch {
    throw new AdminApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new AdminApiError(result.message || 'The export could not be created.', response.status);
  }

  const expectedExtension = format === 'xlsx' ? 'xlsx' : 'csv';
  const filename = `feedback-export-${getDownloadDate()}.${expectedExtension}`;
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return filename;
}

export const downloadFeedbackCsv = (filters) => downloadFeedbackExport(filters, 'csv');
export const downloadFeedbackXlsx = (filters) => downloadFeedbackExport(filters, 'xlsx');

export function formatFeedbackDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC';
}
