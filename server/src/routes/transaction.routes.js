import { Router } from 'express';
import mongoose from 'mongoose';
import { body, query } from 'express-validator';
import { Item } from '../models/Item.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { nextSequence } from '../models/Counter.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../utils/ApiError.js';
import { toTransactionDTO } from '../utils/serialize.js';
import { logActivity } from '../utils/activity.js';
import { buildDateFilter, escapeRegex, isValidDate, parseDateRange, parsePagination } from '../utils/query.js';

const router = Router();
router.use(authenticate);
const TRANSACTION_TYPES = ['Stock In', 'Stock Out', 'Borrowed', 'Returned', 'Adjustment'];

router.get(
  '/',
  requirePermission('transactions:read'),
  validate([
    query('type').optional().isString().isIn(TRANSACTION_TYPES),
    query('search').optional().isString().isLength({ max: 100 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, 12, 100);
    const { from, to } = parseDateRange(req.query);
    const dateMatch = buildDateFilter(from, to);
    const type = req.query.type || '';
    const search = req.query.search ? new RegExp(escapeRegex(req.query.search), 'i') : null;
    const lookupAndSearch = [
      { $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'item' } },
      { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'recordedBy', foreignField: '_id', as: 'recordedBy' } },
      { $unwind: { path: '$recordedBy', preserveNullAndEmptyArrays: true } },
      ...(search
        ? [{
            $match: {
              $or: [
                { reference: search },
                { 'item.name': search },
                { 'item.itemCode': search },
                { supplier: search },
                { reason: search },
                { 'recordedBy.name': search },
              ],
            },
          }]
        : []),
    ];

    const dataPipeline = [
      { $match: dateMatch },
      ...lookupAndSearch,
      ...(type ? [{ $match: { type } }] : []),
      { $sort: { date: -1, createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];
    const summaryPipeline = [
      { $match: dateMatch },
      ...lookupAndSearch,
      { $group: { _id: '$type', quantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
    ];

    const [[result], summaryRows] = await Promise.all([
      StockTransaction.aggregate(dataPipeline),
      StockTransaction.aggregate(summaryPipeline),
    ]);
    const total = result?.total?.[0]?.count || 0;
    const summary = {};
    summaryRows.forEach((row) => {
      summary[row._id] = { quantity: row.quantity, count: row.count };
    });

    res.json({
      transactions: (result?.data || []).map(toTransactionDTO),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      summary,
    });
  })
);

router.post(
  '/',
  requirePermission('transactions:create'),
  validate([
    body('type').isString().isIn(['Stock In', 'Stock Out', 'Adjustment']).withMessage('Select a valid transaction type.'),
    body('itemId').isMongoId().withMessage('Select a valid inventory item.'),
    body('quantity')
      .isInt({ min: 0, max: 1000000 })
      .withMessage('Quantity must be a whole number from 0 to 1,000,000.')
      .custom((value, { req }) => req.body.type === 'Adjustment' || Number(value) >= 1)
      .withMessage('Stock in and stock out quantities must be at least 1.'),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Enter a valid transaction date.')
      .custom((value) => new Date(value).getTime() <= Date.now() + 60_000)
      .withMessage('Transaction date cannot be in the future.'),
    body('supplier').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
    body('reason').optional({ values: 'falsy' }).isString().trim().isLength({ max: 160 }),
    body('remarks').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
  ]),
  asyncHandler(async (req, res) => {
    const type = req.body.type;
    const itemId = req.body.itemId;
    const quantity = Number(req.body.quantity);
    const supplier = String(req.body.supplier || '').trim();
    const reason = String(req.body.reason || '').trim();
    const remarks = String(req.body.remarks || '').trim();
    const date = req.body.date && isValidDate(req.body.date) ? new Date(req.body.date) : new Date();

    if (type === 'Stock Out' && !reason) throw badRequest('Please provide a reason for releasing the stock.');
    if (type === 'Adjustment') {
      if (req.user.role !== 'Administrator') throw forbidden('Only administrators can adjust stock quantities.');
      if (!reason) throw badRequest('Please provide a reason for the stock adjustment.');
    }

    let updated;
    let transaction;
    let itemSnapshot;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const item = await Item.findById(itemId).session(session);
        if (!item) throw notFound('Inventory item not found.');
        if (!item.isActive) throw badRequest('This item is archived and cannot receive new transactions.');
        itemSnapshot = {
          id: item._id.toString(),
          itemCode: item.itemCode,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        };

        if (type === 'Stock In') {
          updated = await Item.findOneAndUpdate(
            { _id: item._id, isActive: true },
            { $inc: { quantity }, $set: { updatedBy: req.user._id } },
            { new: true, runValidators: true, session }
          );
          if (!updated) throw badRequest('This item is archived and cannot receive new transactions.');
        } else if (type === 'Stock Out') {
          updated = await Item.findOneAndUpdate(
            { _id: item._id, isActive: true, quantity: { $gte: quantity } },
            { $inc: { quantity: -quantity }, $set: { updatedBy: req.user._id } },
            { new: true, runValidators: true, session }
          );
          if (!updated) {
            throw conflict(`Insufficient stock for ${item.name}. Available quantity: ${item.quantity} ${item.unit}.`);
          }
        } else {
          if (quantity === item.quantity) throw badRequest('The counted quantity matches the current stock. No adjustment is needed.');
          updated = await Item.findOneAndUpdate(
            { _id: item._id, isActive: true, quantity: item.quantity },
            { $set: { quantity, updatedBy: req.user._id } },
            { new: true, runValidators: true, session }
          );
          if (!updated) throw conflict('Stock changed while this adjustment was being recorded. Refresh the item and try again.');
        }

        const reference = await nextSequence('transaction', 'TXN-', 5, session);
        const delta = Math.abs(updated.quantity - item.quantity);
        [transaction] = await StockTransaction.create([{
          reference,
          type,
          item: item._id,
          quantity: type === 'Adjustment' ? delta : quantity,
          balanceAfter: updated.quantity,
          date,
          supplier: type === 'Stock In' ? supplier : '',
          reason: type === 'Stock In' ? '' : reason,
          remarks: type === 'Adjustment' ? `Counted quantity set to ${quantity} (was ${item.quantity}). ${remarks}`.trim() : remarks,
          recordedBy: req.user._id,
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    await logActivity({
      req,
      actor: req.user,
      action: `Recorded ${type.toLowerCase()}`,
      entityType: 'Item',
      entityId: itemSnapshot.id,
      entityLabel: `${itemSnapshot.itemCode} · ${itemSnapshot.name}`,
      details: `${type} of ${transaction.quantity} ${itemSnapshot.unit}. New balance: ${updated.quantity}. ${reason || supplier || remarks}`.trim(),
    });

    res.status(201).json({
      message:
        type === 'Stock In'
          ? `Stock in recorded. ${itemSnapshot.name} now has ${updated.quantity} ${updated.unit}.`
          : type === 'Stock Out'
            ? `Stock out recorded. ${itemSnapshot.name} now has ${updated.quantity} ${updated.unit}.`
            : `Stock adjusted. ${itemSnapshot.name} now has ${updated.quantity} ${updated.unit}.`,
      transaction: toTransactionDTO(transaction),
      item: { id: updated._id.toString(), name: updated.name, quantity: updated.quantity, unit: updated.unit },
    });
  })
);

export default router;
