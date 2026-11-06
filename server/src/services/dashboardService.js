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
  const result = await getDatabasePool().query(
    `SELECT COUNT(*) AS "totalFeedback",
       COUNT(*) FILTER (WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz) AS "todayFeedback",
       COUNT(*) FILTER (WHERE created_at >= $3::timestamptz AND created_at < $2::timestamptz) AS "thisWeekFeedback"
     FROM feedback`,
    [`${range.todayStart}T00:00:00.000Z`, `${range.tomorrowStart}T00:00:00.000Z`, `${range.weekStart}T00:00:00.000Z`],
  );
  return {
    totalFeedback: Number(result.rows[0].totalFeedback),
    todayFeedback: Number(result.rows[0].todayFeedback),
    thisWeekFeedback: Number(result.rows[0].thisWeekFeedback),
  };
}

/** Return fixed-size UTC daily volume, rating, and feedback-type distributions. */
export async function getDashboardCharts(now = new Date()) {
  const range = getDashboardBoundaries(now);
  const typePlaceholders = FEEDBACK_TYPES.map((_, index) => `$${index + 1}`).join(', ');
  const [volumeResult, ratingResult, typeResult] = await Promise.all([
    getDatabasePool().query(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*) AS count
       FROM feedback WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
       GROUP BY day ORDER BY day ASC`,
      [`${range.chartStart}T00:00:00.000Z`, `${range.chartEnd}T00:00:00.000Z`],
    ),
    getDatabasePool().query(
      `SELECT rating, COUNT(*) AS count FROM feedback
       WHERE rating BETWEEN 1 AND 5 GROUP BY rating ORDER BY rating ASC`,
    ),
    getDatabasePool().query(
      `SELECT feedback_type AS "feedbackType", COUNT(*) AS count FROM feedback
       WHERE feedback_type IN (${typePlaceholders})
       GROUP BY feedback_type ORDER BY feedback_type ASC`,
      FEEDBACK_TYPES,
    ),
  ]);

  const volumeByDay = new Map(volumeResult.rows.map((row) => [
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

  const ratingCounts = new Map(ratingResult.rows.map((row) => [Number(row.rating), Number(row.count)]));
  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ratingCounts.get(rating) ?? 0,
  }));
  const typeCounts = new Map(typeResult.rows.map((row) => [row.feedbackType, Number(row.count)]));
  const feedbackTypeDistribution = FEEDBACK_TYPES.map((feedbackType) => ({
    feedbackType,
    count: typeCounts.get(feedbackType) ?? 0,
  }));

  return { feedbackVolume, ratingDistribution, feedbackTypeDistribution };
}
