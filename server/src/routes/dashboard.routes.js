import { Router } from 'express';
import { Item } from '../models/Item.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { BorrowRecord } from '../models/BorrowRecord.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../utils/ApiError.js';
import { toBorrowDTO, toItemDTO, toTransactionDTO } from '../utils/serialize.js';
import { addDays, startOfDay } from '../utils/query.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission('dashboard:read'),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const startOfWindow = addDays(startOfDay(now), -6);

    const [itemStatsRows, categoryRows, movementRows, recentTransactions, lowStockItems] = await Promise.all([
      Item.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalAvailableStocks: { $sum: '$quantity' },
            lowStockItems: {
              $sum: { $cond: [{ $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$minimumStock'] }] }, 1, 0] },
            },
            outOfStockItems: { $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] } },
          },
        },
      ]),
      Item.aggregate([
        { $match: { isActive: true } },
        { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        {
          $group: {
            _id: '$category.name',
            products: { $sum: 1 },
            quantity: { $sum: '$quantity' },
          },
        },
        { $sort: { quantity: -1, _id: 1 } },
      ]),
      StockTransaction.aggregate([
        { $match: { date: { $gte: startOfWindow }, type: { $in: ['Stock In', 'Stock Out'] } } },
        {
          $group: {
            _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, type: '$type' },
            quantity: { $sum: '$quantity' },
          },
        },
      ]),
      StockTransaction.find()
        .sort({ date: -1, createdAt: -1 })
        .limit(8)
        .populate('item', 'name itemCode unit')
        .populate('recordedBy', 'name username'),
      Item.find({ isActive: true, $expr: { $lte: ['$quantity', '$minimumStock'] } })
        .populate('category', 'name')
        .sort({ quantity: 1, minimumStock: -1, name: 1 })
        .limit(10),
    ]);

    const stats = itemStatsRows[0] || { totalProducts: 0, totalAvailableStocks: 0, lowStockItems: 0, outOfStockItems: 0 };
    const movementMap = new Map();
    movementRows.forEach((row) => {
      const day = row._id.date;
      const current = movementMap.get(day) || { date: day, stockIn: 0, stockOut: 0 };
      if (row._id.type === 'Stock In') current.stockIn = row.quantity;
      if (row._id.type === 'Stock Out') current.stockOut = row.quantity;
      movementMap.set(day, current);
    });
    const movement = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(startOfWindow, index).toISOString().slice(0, 10);
      return movementMap.get(date) || { date, stockIn: 0, stockOut: 0 };
    });

    const categoryTotal = categoryRows.reduce((sum, row) => sum + row.quantity, 0) || 1;
    const categories = categoryRows.map((row) => ({
      name: row._id,
      products: row.products,
      quantity: row.quantity,
      percent: Math.round((row.quantity / categoryTotal) * 100),
    }));

    res.json({
      generatedAt: now.toISOString(),
      stats,
      categories,
      movement,
      recentTransactions: recentTransactions.map(toTransactionDTO),
      lowStockItems: lowStockItems.map(toItemDTO),
    });
  })
);

router.get(
  '/notifications',
  requirePermission('dashboard:read'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const canViewBorrows = ['Administrator', 'Inventory Staff'].includes(req.user.role);
    const [lowStock, outOfStock, overdueBorrows] = await Promise.all([
      Item.find({ isActive: true, quantity: { $gt: 0 }, $expr: { $lte: ['$quantity', '$minimumStock'] } })
        .populate('category', 'name')
        .sort({ quantity: 1 })
        .limit(6),
      Item.find({ isActive: true, quantity: 0 }).populate('category', 'name').limit(6),
      canViewBorrows
        ? BorrowRecord.find({ status: 'Borrowed', expectedReturnDate: { $lt: now } })
            .populate('item', 'name unit')
            .sort({ expectedReturnDate: 1 })
            .limit(5)
        : Promise.resolve([]),
    ]);

    res.json({
      lowStock: lowStock.map(toItemDTO),
      outOfStock: outOfStock.map(toItemDTO),
      overdueBorrows: overdueBorrows.map((record) => ({
        id: record._id.toString(),
        reference: record.reference,
        borrowerName: record.borrowerName,
        itemName: record.item?.name || 'Item',
        quantity: record.quantity,
        expectedReturnDate: record.expectedReturnDate,
      })),
      total: lowStock.length + outOfStock.length + overdueBorrows.length,
    });
  })
);

export default router;
