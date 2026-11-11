import { Router } from 'express';
import { Item } from '../models/Item.js';
import { Category } from '../models/Category.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { BorrowRecord } from '../models/BorrowRecord.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../utils/ApiError.js';
import { toBorrowDTO, toItemDTO, toLogDTO, toTransactionDTO } from '../utils/serialize.js';
import { addDays, startOfDay } from '../utils/query.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission('dashboard:read'),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const startOfToday = startOfDay(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWindow = addDays(startOfToday, -6);

    const [
      itemStatsRows,
      categoryRows,
      statusRows,
      movementRows,
      recentTransactions,
      recentActivities,
      lowStockItems,
      borrowStats,
      overdueCount,
      activeBorrows,
      monthStats,
    ] = await Promise.all([
      Item.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            lowStock: {
              $sum: { $cond: [{ $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$minimumStock'] }] }, 1, 0] },
            },
            outOfStock: { $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] } },
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
            items: { $sum: 1 },
            quantity: { $sum: '$quantity' },
            lowStock: {
              $sum: { $cond: [{ $lte: ['$quantity', '$minimumStock'] }, 1, 0] },
            },
          },
        },
        { $sort: { quantity: -1 } },
      ]),
      Item.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$quantity', 0] },
                'Out of Stock',
                { $cond: [{ $lte: ['$quantity', '$minimumStock'] }, 'Low Stock', 'In Stock'] },
              ],
            },
            count: { $sum: 1 },
          },
        },
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
        .limit(6)
        .populate('item', 'name itemCode unit')
        .populate('recordedBy', 'name username'),
      ActivityLog.find().sort({ createdAt: -1 }).limit(6),
      Item.find({ isActive: true, $expr: { $lte: ['$quantity', '$minimumStock'] } })
        .populate('category', 'name')
        .sort({ quantity: 1 })
        .limit(8),
      BorrowRecord.aggregate([
        { $match: { status: 'Borrowed' } },
        { $group: { _id: null, records: { $sum: 1 }, quantity: { $sum: '$quantity' } } },
      ]),
      BorrowRecord.countDocuments({ status: 'Borrowed', expectedReturnDate: { $lt: now } }),
      BorrowRecord.find({ status: 'Borrowed' })
        .sort({ expectedReturnDate: 1 })
        .limit(5)
        .populate('item', 'name itemCode unit'),
      StockTransaction.aggregate([
        {
          $match: {
            date: { $gte: startOfMonth },
            type: { $in: ['Stock In', 'Stock Out', 'Borrowed', 'Returned'] },
          },
        },
        {
          $group: {
            _id: '$type',
            quantity: { $sum: '$quantity' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats = itemStatsRows[0] || { totalItems: 0, totalQuantity: 0, lowStock: 0, outOfStock: 0 };
    const statusMap = {};
    statusRows.forEach((row) => {
      statusMap[row._id] = row.count;
    });

    const movementMap = {};
    movementRows.forEach((row) => {
      const key = row._id.date;
      if (!movementMap[key]) movementMap[key] = { date: key, stockIn: 0, stockOut: 0 };
      if (row._id.type === 'Stock In') movementMap[key].stockIn = row.quantity;
      if (row._id.type === 'Stock Out') movementMap[key].stockOut = row.quantity;
    });
    const movement = [];
    for (let index = 0; index < 7; index += 1) {
      const day = addDays(startOfWindow, index);
      const key = day.toISOString().slice(0, 10);
      movement.push(
        movementMap[key] || {
          date: key,
          stockIn: 0,
          stockOut: 0,
        }
      );
    }

    const monthMap = {};
    monthStats.forEach((row) => {
      monthMap[row._id] = row;
    });

    const categoryTotal = categoryRows.reduce((sum, row) => sum + row.quantity, 0) || 1;
    const categories = categoryRows.map((row) => ({
      name: row._id,
      items: row.items,
      quantity: row.quantity,
      lowStock: row.lowStock,
      percent: Math.round((row.quantity / categoryTotal) * 100),
    }));

    const borrowedStats = borrowStats[0] || { records: 0, quantity: 0 };

    res.json({
      generatedAt: now.toISOString(),
      stats: {
        totalItems: stats.totalItems,
        totalAvailableStocks: stats.totalQuantity,
        lowStockItems: stats.lowStock,
        outOfStockItems: stats.outOfStock,
        inStockItems: statusMap['In Stock'] || 0,
        totalBorrowedItems: borrowedStats.quantity,
        activeBorrowRecords: borrowedStats.records,
        overdueBorrows: overdueCount,
        totalCategories: categories.length,
        stockInThisMonth: monthMap['Stock In']?.quantity || 0,
        stockOutThisMonth: monthMap['Stock Out']?.quantity || 0,
        borrowedThisMonth: monthMap['Borrowed']?.quantity || 0,
        returnedThisMonth: monthMap['Returned']?.quantity || 0,
        transactionsThisMonth: Object.values(monthMap).reduce((sum, row) => sum + row.count, 0),
      },
      categories,
      movement,
      recentTransactions: recentTransactions.map(toTransactionDTO),
      recentActivities: recentActivities.map(toLogDTO),
      lowStockItems: lowStockItems.map(toItemDTO),
      activeBorrows: activeBorrows.map((record) => ({
        ...toBorrowDTO(record),
        itemName: record.item?.name || 'Item',
      })),
    });
  })
);

router.get(
  '/notifications',
  requirePermission('dashboard:read'),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const [lowStock, outOfStock, overdueBorrows] = await Promise.all([
      Item.find({ isActive: true, quantity: { $gt: 0 }, $expr: { $lte: ['$quantity', '$minimumStock'] } })
        .populate('category', 'name')
        .sort({ quantity: 1 })
        .limit(6),
      Item.find({ isActive: true, quantity: 0 }).populate('category', 'name').limit(6),
      BorrowRecord.find({ status: 'Borrowed', expectedReturnDate: { $lt: now } })
        .populate('item', 'name unit')
        .sort({ expectedReturnDate: 1 })
        .limit(5),
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
