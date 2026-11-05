import { getDatabasePool } from '../config/database.js';

const DAY_MS = 86400000;
const FEEDBACK_TYPES = [
  'General feedback', 'Bug report', 'Feature request', 'Complaint', 'Appreciation', 'Other',
];

function utcMidnight(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function sqlDate(date) {
  return date.toISOString().slice(0, 10);
}

function mondayUtc(date) {
  const day = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - day * DAY_MS);
}

/** Return UTC calendar boundaries for dashboard aggregates and chart rows. */
export function getDashboardBoundaries(now = new Date()) {
  const todayStart = utcMidnight(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const weekStart = mondayUtc(todayStart);
  const chartStart = new Date(todayStart.getTime() - 29 * DAY_MS);
  return {
    todayStart: sqlDate(todayStart),
    tomorrowStart: sqlDate(tomorrowStart),
    weekStart: sqlDate(weekStart),
    chartStart: sqlDate(chartStart),
    chartEnd: sqlDate(tomorrowStart),
  };
}

/** Count all records, UTC-today records, and current UTC Monday-to-Sunday records. */
export async function getDashboardStats(now = new Date()) {
  const range = getDashboardBoundaries(now);
  const [rows] = await getDatabasePool().execute(
    `SELECT COUNT(*) AS totalFeedback,
       COALESCE(SUM(created_at >= ? AND created_at < ?), 0) AS todayFeedback,
       COALESCE(SUM(created_at >= ? AND created_at < ?), 0) AS thisWeekFeedback
     FROM feedback`,
    [range.todayStart, range.tomorrowStart, range.weekStart, range.tomorrowStart],
  );
  return {
    totalFeedback: Number(rows[0].totalFeedback),
    todayFeedback: Number(rows[0].todayFeedback),
    thisWeekFeedback: Number(rows[0].thisWeekFeedback),
  };
}

/** Return fixed-size UTC daily volume, rating, and feedback-type distributions. */
export async function getDashboardCharts(now = new Date()) {
  const range = getDashboardBoundaries(now);
  const typePlaceholders = FEEDBACK_TYPES.map(() => '?').join(', ');
  const [volumeRows, ratingRows, typeRows] = await Promise.all([
    getDatabasePool().execute(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count
       FROM feedback WHERE created_at >= ? AND created_at < ?
       GROUP BY DATE(created_at) ORDER BY day ASC`,
      [`${range.chartStart} 00:00:00`, `${range.chartEnd} 00:00:00`],
    ),
    getDatabasePool().execute(
      `SELECT rating, COUNT(*) AS count FROM feedback
       WHERE rating BETWEEN 1 AND 5 GROUP BY rating ORDER BY rating ASC`,
    ),
    getDatabasePool().execute(
      `SELECT feedback_type AS feedbackType, COUNT(*) AS count FROM feedback
       WHERE feedback_type IN (${typePlaceholders})
       GROUP BY feedback_type ORDER BY feedback_type ASC`,
      FEEDBACK_TYPES,
    ),
  ]);

  const volumeByDay = new Map(volumeRows[0].map((row) => [
    typeof row.day === 'string' ? row.day.slice(0, 10) : sqlDate(row.day),
    Number(row.count),
  ]));
  const feedbackVolume = [];
  const chartStart = new Date(`${range.chartStart}T00:00:00.000Z`);
  for (let offset = 0; offset < 30; offset += 1) {
    const day = new Date(chartStart.getTime() + offset * DAY_MS);
    const date = sqlDate(day);
    feedbackVolume.push({ date, count: volumeByDay.get(date) ?? 0 });
  }

  const ratingCounts = new Map(ratingRows[0].map((row) => [Number(row.rating), Number(row.count)]));
  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ratingCounts.get(rating) ?? 0,
  }));
  const typeCounts = new Map(typeRows[0].map((row) => [row.feedbackType, Number(row.count)]));
  const feedbackTypeDistribution = FEEDBACK_TYPES.map((feedbackType) => ({
    feedbackType,
    count: typeCounts.get(feedbackType) ?? 0,
  }));

  return { feedbackVolume, ratingDistribution, feedbackTypeDistribution };
}
