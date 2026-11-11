import { Router } from 'express';
import { query } from 'express-validator';
import { ActivityLog } from '../models/ActivityLog.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/ApiError.js';
import { toLogDTO } from '../utils/serialize.js';
import { buildDateFilter, escapeRegex, parseDateRange, parsePagination } from '../utils/query.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission('logs:read'),
  validate([
    query('search').optional().isString().isLength({ max: 100 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ]),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, 20, 100);
    const { from, to } = parseDateRange(req.query);
    const filter = { ...buildDateFilter(from, to, 'createdAt') };

    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$or = [{ action: rx }, { actorName: rx }, { actorUsername: rx }, { entityLabel: rx }, { details: rx }];
    }

    const [logs, total, actionRows] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ActivityLog.countDocuments(filter),
      ActivityLog.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }]),
    ]);

    res.json({
      logs: logs.map(toLogDTO),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      actions: actionRows.map((row) => ({ action: row._id, count: row.count })),
    });
  })
);

export default router;
