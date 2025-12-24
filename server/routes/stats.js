import express from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { submissions } from '../../shared/schema.js';

const router = express.Router();

const asRows = (result) => {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.rows)) return result.rows;
  return [];
};

router.get('/hourly-activity', async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM ${submissions.createdAt}) AS hour,
        COUNT(*)::int AS count
      FROM ${submissions}
      WHERE ${submissions.createdAt} >= NOW() - INTERVAL '24 HOURS'
      GROUP BY hour
      ORDER BY hour;
    `);

    const rows = asRows(result).map((row) => ({
      hour: Number(row.hour),
      count: Number(row.count),
    }));

    const rowMap = new Map(rows.map((row) => [row.hour, row.count]));
    const payload = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: rowMap.get(hour) ?? 0,
    }));

    res.json(payload);
  } catch (error) {
    console.error('Hourly activity error:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch hourly activity' });
  }
});

router.get('/daily-top-categories', async (req, res) => {
  try {
    const allowedRanges = [7, 15, 30];
    const requestedRange = Number(req.query.days);
    const days = allowedRanges.includes(requestedRange) ? requestedRange : 30;

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const result = await db.execute(sql`
      SELECT day, category, count FROM (
        SELECT 
          DATE(${submissions.createdAt}) AS day,
          ${submissions.serviceType} AS category,
          COUNT(*) AS count,
          ROW_NUMBER() OVER (PARTITION BY DATE(${submissions.createdAt}) ORDER BY COUNT(*) DESC) AS rn
        FROM ${submissions}
        WHERE ${submissions.createdAt} >= ${startDate}
        GROUP BY DATE(${submissions.createdAt}), ${submissions.serviceType}
      ) t
      WHERE rn = 1
      ORDER BY day ASC;
    `);

    const payload = asRows(result).map((row) => ({
      day: row.day,
      category: row.category,
      count: Number(row.count),
    }));

    res.json(payload);
  } catch (error) {
    console.error('Daily top categories error:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch daily top categories' });
  }
});

export default router;
