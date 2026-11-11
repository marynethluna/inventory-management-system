import { Router } from 'express';
import mongoose from 'mongoose';
import { body, param, query } from 'express-validator';
import { Item } from '../models/Item.js';
import { BorrowRecord } from '../models/BorrowRecord.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { nextSequence } from '../models/Counter.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest, conflict, notFound } from '../utils/ApiError.js';
import { toBorrowDTO, toTransactionDTO } from '../utils/serialize.js';
import { logActivity } from '../utils/activity.js';
import { buildDateFilter, escapeRegex, isValidDate, parseDateRange, parsePagination } from '../utils/query.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission('borrows:read'),
  validate([
    query('status').optional().isString().isIn(['Borrowed', 'Returned', 'Overdue', 'All']),
    query('search').optional().isString().isLength({ max: 100 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ]),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, 12, 100);
    const { from, to } = parseDateRange(req.query);

    const match = { ...buildDateFilter(from, to, 'dateBorrowed') };
    if (req.query.status === 'Borrowed') match.status = 'Borrowed';
    if (req.query.status === 'Returned') match.status = 'Returned';
    if (req.query.status === 'Overdue') {
      match.status = 'Borrowed';
      match.expectedReturnDate = { $lt: new Date() };
    }

    const search = req.query.search ? new RegExp(escapeRegex(req.query.search), 'i') : null;

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'item' } },
      { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'recordedBy', foreignField: '_id', as: 'recordedBy' } },
      { $unwind: { path: '$recordedBy', preserveNullAndEmptyArrays: true } },
      ...(search
        ? [
            {
              $match: {
                $or: [
                  { reference: search },
                  { borrowerName: search },
                  { borrowerIdNumber: search },
                  { 'item.name': search },
                  { 'item.itemCode': search },
                ],
              },
            },
          ]
        : []),
      { $sort: { dateBorrowed: -1, createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
          summary: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                quantity: { $sum: '$quantity' },
              },
            },
          ],
        },
      },
    ];

    const [resultRows, overdueCount] = await Promise.all([
      BorrowRecord.aggregate(pipeline),
      BorrowRecord.countDocuments({ status: 'Borrowed', expectedReturnDate: { $lt: new Date() } }),
    ]);
    const result = resultRows[0] || {};
    const total = result.total?.[0]?.count || 0;
    const summary = { Borrowed: 0, Returned: 0 };
    (result.summary || []).forEach((row) => {
      summary[row._id] = { count: row.count, quantity: row.quantity };
    });

    res.json({
      borrows: (result.data || []).map(toBorrowDTO),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      summary,
      overdueCount,
    });
  })
);

router.post(
  '/',
  requirePermission('borrows:create'),
  validate([
    body('borrowerName').isString().trim().isLength({ min: 2, max: 100 }).withMessage("Enter the borrower's full name."),
    body('borrowerIdNumber').isString().trim().isLength({ min: 2, max: 40 }).withMessage("Enter the borrower's ID or reference number."),
    body('itemId').isMongoId().withMessage('Select a valid inventory item.'),
    body('quantity').isInt({ min: 1, max: 1000000 }).withMessage('Quantity must be at least 1.'),
    body('dateBorrowed').optional().isISO8601().withMessage('Enter a valid borrowing date.'),
    body('expectedReturnDate').isISO8601().withMessage('Enter a valid expected return date.'),
    body('remarks').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
  ]),
  asyncHandler(async (req, res) => {
    const { borrowerName, borrowerIdNumber, itemId, quantity, remarks = '' } = req.body;
    const quantityNumber = Number(quantity);
    const dateBorrowed = req.body.dateBorrowed && isValidDate(req.body.dateBorrowed) ? new Date(req.body.dateBorrowed) : new Date();
    const expectedReturnDate = new Date(req.body.expectedReturnDate);
    if (expectedReturnDate < dateBorrowed) {
      throw badRequest('The expected return date cannot be earlier than the borrowing date.');
    }

    let record;
    let itemSnapshot;
    let newBalance;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const item = await Item.findById(itemId).session(session);
        if (!item) throw notFound('Inventory item not found.');
        if (!item.isActive) throw badRequest('This item is archived and cannot be borrowed.');
        itemSnapshot = { id: item._id.toString(), name: item.name, unit: item.unit };

        const updated = await Item.findOneAndUpdate(
          { _id: item._id, isActive: true, quantity: { $gte: quantityNumber } },
          { $inc: { quantity: -quantityNumber }, $set: { updatedBy: req.user._id } },
          { new: true, runValidators: true, session }
        );
        if (!updated) {
          throw conflict(`Cannot borrow ${quantityNumber} ${item.unit} of ${item.name}. Only ${item.quantity} available.`);
        }
        newBalance = updated.quantity;

        const reference = await nextSequence('borrow', 'BRW-', 4, session);
        [record] = await BorrowRecord.create([{
          reference,
          borrowerName,
          borrowerIdNumber,
          item: item._id,
          quantity: quantityNumber,
          dateBorrowed,
          expectedReturnDate,
          status: 'Borrowed',
          remarks,
          recordedBy: req.user._id,
        }], { session });

        const txnReference = await nextSequence('transaction', 'TXN-', 5, session);
        await StockTransaction.create([{
          reference: txnReference,
          type: 'Borrowed',
          item: item._id,
          quantity: quantityNumber,
          balanceAfter: updated.quantity,
          date: dateBorrowed,
          reason: `Borrowed by ${borrowerName}`,
          remarks: `Borrow reference ${reference}. Expected return ${expectedReturnDate.toISOString().slice(0, 10)}.`,
          recordedBy: req.user._id,
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    await logActivity({
      req,
      actor: req.user,
      action: 'Recorded borrowed item',
      entityType: 'Borrow',
      entityId: record._id.toString(),
      entityLabel: `${record.reference} · ${itemSnapshot.name}`,
      details: `${borrowerName} (${borrowerIdNumber}) borrowed ${quantityNumber} ${itemSnapshot.unit}. Expected return ${expectedReturnDate.toISOString().slice(0, 10)}.`,
    });

    res.status(201).json({
      message: `Borrowing recorded for ${borrowerName}. ${itemSnapshot.name} now has ${newBalance} ${itemSnapshot.unit} available.`,
      borrow: toBorrowDTO(record),
    });
  })
);

router.post(
  '/:id/return',
  requirePermission('borrows:update'),
  validate([param('id').isMongoId()]),
  asyncHandler(async (req, res) => {
    const now = new Date();
    let record;
    let transaction;
    let itemSnapshot;
    let updatedQuantity;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const original = await BorrowRecord.findById(req.params.id).session(session);
        if (!original) throw notFound('Borrowing record not found.');
        if (original.status !== 'Borrowed') {
          throw conflict('This item has already been returned or is being returned by another staff member.');
        }

        record = await BorrowRecord.findOneAndUpdate(
          { _id: original._id, status: 'Borrowed' },
          { $set: { status: 'Returned', actualReturnDate: now, returnedBy: req.user._id } },
          { new: true, runValidators: true, session }
        );
        if (!record) throw conflict('This item has already been returned or is being returned by another staff member.');

        const item = await Item.findById(record.item).session(session);
        if (!item) throw notFound('The borrowed item no longer exists in the inventory.');
        itemSnapshot = { id: item._id.toString(), name: item.name, unit: item.unit };

        const updated = await Item.findOneAndUpdate(
          { _id: item._id },
          { $inc: { quantity: record.quantity }, $set: { updatedBy: req.user._id } },
          { new: true, runValidators: true, session }
        );
        if (!updated) throw notFound('The borrowed item no longer exists in the inventory.');
        updatedQuantity = updated.quantity;

        const reference = await nextSequence('transaction', 'TXN-', 5, session);
        [transaction] = await StockTransaction.create([{
          reference,
          type: 'Returned',
          item: item._id,
          quantity: record.quantity,
          balanceAfter: updated.quantity,
          date: now,
          reason: `Returned by ${record.borrowerName}`,
          remarks: `Borrow reference ${record.reference}.`,
          recordedBy: req.user._id,
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    await logActivity({
      req,
      actor: req.user,
      action: 'Recorded returned item',
      entityType: 'Borrow',
      entityId: record._id.toString(),
      entityLabel: `${record.reference} · ${itemSnapshot.name}`,
      details: `${record.borrowerName} returned ${record.quantity} ${itemSnapshot.unit}. New balance: ${updatedQuantity}.`,
    });

    res.json({
      message: `Return recorded. ${itemSnapshot.name} now has ${updatedQuantity} ${itemSnapshot.unit} available.`,
      borrow: toBorrowDTO(record),
      transaction: toTransactionDTO(transaction),
    });
  })
);

export default router;
