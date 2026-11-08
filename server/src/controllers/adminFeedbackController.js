import { nextUtcDate, parseAdminFeedbackQuery } from '../utils/adminFeedbackQuery.js';
import {
  deleteAdminFeedback, exportAdminFeedback, getAdminFeedbackById, listAdminFeedback,
  parseFeedbackId,
} from '../services/adminFeedbackService.js';
import { serializeFeedbackCsv } from '../utils/csv.js';
import { serializeFeedbackXlsx } from '../utils/xlsx.js';

export async function listFeedback(request, response, next) {
  try {
    const parsed = parseAdminFeedbackQuery(request.query);
    if (parsed.errors) {
      return response.status(400).json({ success: false, message: 'Invalid feedback filters.', errors: parsed.errors });
    }
    const filters = { ...parsed.value, endDateExclusive: nextUtcDate(parsed.value.endDate) };
    const result = await listAdminFeedback(filters);
    return response.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function exportFeedback(request, response, next) {
  try {
    const query = { ...request.query };
    const format = query.format || 'csv';
    if (!['csv', 'xlsx'].includes(format)) {
      return response.status(400).json({ success: false, message: 'Export format must be csv or xlsx.' });
    }
    delete query.page;
    delete query.limit;
    delete query.format;
    const parsed = parseAdminFeedbackQuery(query);
    if (parsed.errors) {
      return response.status(400).json({ success: false, message: 'Invalid export filters.', errors: parsed.errors });
    }
    const filters = { ...parsed.value, endDateExclusive: nextUtcDate(parsed.value.endDate) };
    const { rows } = await exportAdminFeedback(filters);

    const fileDate = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    if (format === 'xlsx') {
      response.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="feedback-export-${fileDate}.xlsx"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      return response.status(200).send(await serializeFeedbackXlsx(rows));
    }

    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="feedback-export-${fileDate}.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return response.status(200).send(serializeFeedbackCsv(rows));
  } catch (error) {
    next(error);
  }
}

export async function getFeedback(request, response, next) {
  try {
    const id = parseFeedbackId(request.params.id);
    if (id === null) return response.status(400).json({ success: false, message: 'Feedback ID must be a positive integer.' });
    const feedback = await getAdminFeedbackById(id);
    if (!feedback) return response.status(404).json({ success: false, message: 'Feedback not found.' });
    return response.json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
}

export async function deleteFeedback(request, response, next) {
  try {
    const id = parseFeedbackId(request.params.id);
    if (id === null) return response.status(400).json({ success: false, message: 'Feedback ID must be a positive integer.' });
    const deleted = await deleteAdminFeedback(id);
    if (!deleted) return response.status(404).json({ success: false, message: 'Feedback not found.' });
    return response.json({ success: true, message: 'Feedback deleted.' });
  } catch (error) {
    next(error);
  }
}
