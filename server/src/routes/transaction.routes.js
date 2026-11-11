import { Router } from 'express';
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

router.get(
  '/',
  requirePermission('transactions:read'),
  validate([
    query('type').optional().isString().isIn(['Stock In', 'Stock Out', 'Borrowed', 'Returned', 'Adjustment']),
    query('search').optional().isString().isLength({ max: 100 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ]),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, 12, 100);
    const { from, to } = parseDateRange(req.query);

    const match = { ...buildDateFilter(from, to) };
    if (req.query.type) match.type = req.query.type;

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'item' } },
      { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'recordedBy', foreignField: '_id', as: 'recordedBy' } },
      { $unwind: { path: '$recordedBy', preserveNullAndEmptyArrays: true } },
      ...(req.query.search
        ? [
            {
              $match: {
                $or: [
                  { reference: new RegExp(escapeRegex(req.query.search), 'i') },
                  { 'item.name': new RegExp(escapeRegex(req.query.search), 'i') },
                  { 'item.itemCode': new RegExp(escapeRegex(req.query.search), 'i') },
                  { supplier: new RegExp(escapeRegex(req.query.search), 'i') },
                  { reason: new RegExp(escapeRegex(req.query.search), 'i') },
                  { 'recordedBy.name': new RegExp(escapeRegex(req.query.search), 'i') },
                ],
              },
            },
          ]
        : []),
      { $sort: { date: -1, createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
          summary: [
            {
              $group: {
                _id: '$type',
                quantity: { $sum: '$quantity' },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ];

    const [result] = await StockTransaction.aggregate(pipeline);
    const total = result?.total?.[0]?.count || 0;
    const summary = {};
    (result?.summary || []).forEach((row) => {
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
    body('quantity').isInt({ min: 0, max: 1000000 }).withMessage('Quantity must be a whole number.'),
    body('date').optional().isISO8601().withMessage('Enter a valid transaction date.'),
    body('supplier').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
    body('reason').optional({ values: 'falsy' }).isString().isLength({ max: 160 }),
    body('remarks').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
  ]),
  asyncHandler(async (req, res) => {
    const { type, itemId, quantity, supplier = '', reason = '', remarks = '' } = req.body;
    const date = req.body.date && isValidDate(req.body.date) ? new Date(req.body.date) : new Date();

    const item = await Item.findById(itemId);
    if (!item) throw notFound('Inventory item not found.');
    if (!item.isActive) throw badRequest('This item is archived and cannot receive new transactions.');

    if (type === 'Stock Out' && !reason) {
      throw badRequest('Please provide a reason for releasing the stock.');
    }
    if (type === 'Adjustment') {
      if (req.user.role !== 'Administrator') throw forbidden('Only administrators can adjust stock quantities.');
      if (!reason) throw badRequest('Please provide a reason for the stock adjustment.');
    }
    if (type !== 'Adjustment' && quantity < 1) {
      throw badRequest('Quantity must be at least 1.');
    }

    let updated = null;
    let transaction = null;

    try {
      if (type === 'Stock In') {
        updated = await Item.findOneAndUpdate(
          { _id: item._id, isActive: true },
          { $inc: { quantity }, $set: { updatedBy: req.user._id } },
          { new: true, runValidators: true }
        );
        if (!updated) throw badRequest('This item is archived and cannot receive new transactions.');
      } else if (type === 'Stock Out') {
        updated = await Item.findOneAndUpdate(
          { _id: item._id, isActive: true, quantity: { $gte: quantity } },
          { $inc: { quantity: -quantity }, $set: { updatedBy: req.user._id } },
          { new: true, runValidators: true }
        );
        if (!updated) {
          const current = await Item.findById(item._id);
          throw conflict(
            `Insufficient stock for ${item.name}. Available quantity: ${current?.quantity ?? 0} ${item.unit}.`
          );
        }
      } else {
        // Adjustment: set the counted quantity to an absolute value (admin only).
        if (quantity === item.quantity) throw badRequest('The counted quantity matches the current stock. No adjustment needed.');
        if (quantity < 0) throw badRequest('Counted quantity cannot be negative.');
        updated = await Item.findOneAndUpdate(
          { _id: item._id, isActive: true, quantity: { $gte: quantity } },
          { $set: { quantity, updatedBy: req.user._id } },
          { new: true, runValidators: true }
        );
        if (!updated) {
          throw conflict(`Cannot set the quantity to ${quantity} because it is lower than the current stock of ${item.quantity}. Use Stock Out instead.`);
        }
      }

      const reference = await nextSequence('transaction', 'TXN-', 5);
      const delta = Math.abs(updated.quantity - item.quantity);
      transaction = await StockTransaction.create({
        reference,
        type,
        item: item._id,
        quantity: type === 'Adjustment' ? delta : quantity,
        balanceAfter: updated.quantity,
        date,
        supplier: type === 'Stock In' ? supplier : '',
        reason: type === 'Stock In' ? '' : reason,
        remarks:
          type === 'Adjustment'
            ? `Counted quantity set to ${quantity} (was ${item.quantity}). ${remarks || reason}`
            : remarks,
        recordedBy: req.user._id,
      });
    } catch (error) {
      // Compensate the atomic stock change if the audit record could not be written.
      if (updated) {
        try {
          const revert = type === 'Stock In' ? -quantity : type === 'Stock Out' ? quantity : item.quantity;
          await Item.updateOne({ _id: item._id }, { $set: { quantity: revert } });
        } catch (revertError) {
          console.error('[stock compensation failed]', revertError);
        }
      }
      throw error;
    }

    await logActivity({
      req,
      actor: req.user,
      action: `Recorded ${type.toLowerCase()}`,
      entityType: 'Item',
      entityId: item._id.toString(),
      entityLabel: `${item.itemCode} · ${item.name}`,
      details: `${type} of ${transaction.quantity} ${item.unit}. New balance: ${updated.quantity}. ${reason || supplier || remarks}`.trim(),
    });

    res.status(201).json({
      message:
        type === 'Stock In'
          ? `Stock in recorded. ${item.name} now has ${updated.quantity} ${item.unit}.`
          : type === 'Stock Out'
            ? `Stock out recorded. ${item.name} now has ${updated.quantity} ${item.unit}.`
            : `Stock adjusted. ${item.name} now has ${updated.quantity} ${item.unit}.`,
      transaction: toTransactionDTO(transaction),
      item: { id: updated._id.toString(), name: updated.name, quantity: updated.quantity, unit: updated.unit },
    });
  })
);

export default router;
