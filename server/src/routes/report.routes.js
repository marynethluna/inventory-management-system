import { Router } from 'express';
import { query } from 'express-validator';
import { Item } from '../models/Item.js';
import { Category } from '../models/Category.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { BorrowRecord } from '../models/BorrowRecord.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest } from '../utils/ApiError.js';
import { toBorrowDTO, toItemDTO, toTransactionDTO } from '../utils/serialize.js';
import { buildDateFilter, escapeRegex, parseDateRange } from '../utils/query.js';

const router = Router();
router.use(authenticate);

const REPORT_TYPES = ['inventory', 'available', 'low', 'out', 'stock-in', 'stock-out', 'borrows', 'transactions'];

const ITEM_COLUMNS = [
  { key: 'itemCode', label: 'Item ID' },
  { key: 'name', label: 'Item Name' },
  { key: 'category', label: 'Category' },
  { key: 'quantity', label: 'Quantity', align: 'right' },
  { key: 'unit', label: 'Unit' },
  { key: 'minimumStock', label: 'Min. Level', align: 'right' },
  { key: 'status', label: 'Status' },
  { key: 'location', label: 'Location' },
  { key: 'condition', label: 'Condition' },
  { key: 'dateAdded', label: 'Date Added' },
];

const TXN_COLUMNS = [
  { key: 'reference', label: 'Reference' },
  { key: 'date', label: 'Date' },
  { key: 'type', label: 'Type' },
  { key: 'itemCode', label: 'Item ID' },
  { key: 'itemName', label: 'Item Name' },
  { key: 'quantity', label: 'Qty', align: 'right' },
  { key: 'balanceAfter', label: 'Balance', align: 'right' },
  { key: 'supplier', label: 'Supplier / Source' },
  { key: 'reason', label: 'Reason' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'recordedBy', label: 'Recorded By' },
];

const BORROW_COLUMNS = [
  { key: 'reference', label: 'Reference' },
  { key: 'borrowerName', label: 'Borrower' },
  { key: 'borrowerIdNumber', label: 'ID Number' },
  { key: 'itemCode', label: 'Item ID' },
  { key: 'itemName', label: 'Item' },
  { key: 'quantity', label: 'Qty', align: 'right' },
  { key: 'dateBorrowed', label: 'Date Borrowed' },
  { key: 'expectedReturnDate', label: 'Expected Return' },
  { key: 'actualReturnDate', label: 'Actual Return' },
  { key: 'displayStatus', label: 'Status' },
  { key: 'remarks', label: 'Remarks' },
];

router.get(
  '/',
  requirePermission('reports:read'),
  validate([
    query('type').optional().isString().isIn(REPORT_TYPES),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('category').optional().isString().isLength({ max: 80 }),
    query('search').optional().isString().isLength({ max: 100 }),
  ]),
  asyncHandler(async (req, res) => {
    const type = req.query.type || 'inventory';
    const { from, to } = parseDateRange(req.query);
    const search = req.query.search ? new RegExp(escapeRegex(req.query.search), 'i') : null;

    let categoryId = null;
    let categoryName = '';
    if (req.query.category) {
      const category = await Category.findOne({ name: new RegExp(`^${escapeRegex(req.query.category)}$`, 'i') });
      if (!category) throw badRequest('The selected category does not exist.');
      categoryId = category._id;
      categoryName = category.name;
    }

    const base = { generatedAt: new Date().toISOString(), type, filters: { from, to, category: categoryName, search: req.query.search || '' } };

    if (['inventory', 'available', 'low', 'out'].includes(type)) {
      const match = { isActive: true, ...buildDateFilter(from, to, 'createdAt') };
      if (categoryId) match.category = categoryId;
      if (type === 'available') match.quantity = { $gt: 0 };
      if (type === 'low') match.$expr = { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$minimumStock'] }] };
      if (type === 'out') match.quantity = 0;

      const rows = await Item.find(match)
        .populate('category', 'name')
        .sort({ name: 1 })
        .lean();

      const items = rows.map((row) => toItemDTO({ ...row, category: row.category || null }));
      const filtered = search
        ? items.filter((item) =>
            [item.name, item.itemCode, item.category, item.location, item.description].some((value) =>
              String(value || '').toLowerCase().includes(String(req.query.search).toLowerCase())
            )
          )
        : items;

      const summary = {
        totalItems: filtered.length,
        totalQuantity: filtered.reduce((sum, item) => sum + item.quantity, 0),
        lowStock: filtered.filter((item) => item.status === 'Low Stock').length,
        outOfStock: filtered.filter((item) => item.status === 'Out of Stock').length,
      };

      return res.json({ ...base, columns: ITEM_COLUMNS, rows: filtered, summary });
    }

    if (['stock-in', 'stock-out', 'transactions'].includes(type)) {
      const match = { ...buildDateFilter(from, to) };
      if (type === 'stock-in') match.type = 'Stock In';
      if (type === 'stock-out') match.type = 'Stock Out';

      const rows = await StockTransaction.find(match)
        .populate('item', 'name itemCode unit category')
        .populate('recordedBy', 'name username')
        .sort({ date: -1 })
        .lean();

      let transactions = rows.map(toTransactionDTO);
      if (categoryId) {
        const itemIds = await Item.find({ category: categoryId }).select('_id').lean();
        const allowed = new Set(itemIds.map((item) => item._id.toString()));
        transactions = transactions.filter((txn) => allowed.has(txn.itemId));
      }
      if (search) {
        transactions = transactions.filter((txn) =>
          [txn.reference, txn.itemName, txn.itemCode, txn.supplier, txn.reason, txn.remarks, txn.recordedBy?.name]
            .some((value) => String(value || '').toLowerCase().includes(String(req.query.search).toLowerCase()))
        );
      }

      const summary = {
        totalTransactions: transactions.length,
        totalQuantity: transactions.reduce((sum, txn) => sum + txn.quantity, 0),
        stockIn: transactions.filter((txn) => txn.type === 'Stock In').reduce((sum, txn) => sum + txn.quantity, 0),
        stockOut: transactions.filter((txn) => txn.type === 'Stock Out').reduce((sum, txn) => sum + txn.quantity, 0),
      };

      return res.json({ ...base, columns: TXN_COLUMNS, rows: transactions, summary });
    }

    // Borrowing report
    const match = { ...buildDateFilter(from, to, 'dateBorrowed') };
    const rows = await BorrowRecord.find(match)
      .populate('item', 'name itemCode unit category')
      .populate('recordedBy', 'name username')
      .sort({ dateBorrowed: -1 })
      .lean();

    let borrows = rows.map(toBorrowDTO);
    if (categoryId) {
      const itemIds = await Item.find({ category: categoryId }).select('_id').lean();
      const allowed = new Set(itemIds.map((item) => item._id.toString()));
      borrows = borrows.filter((borrow) => allowed.has(borrow.itemId));
    }
    if (search) {
      borrows = borrows.filter((borrow) =>
        [borrow.reference, borrow.borrowerName, borrow.borrowerIdNumber, borrow.itemName, borrow.itemCode]
          .some((value) => String(value || '').toLowerCase().includes(String(req.query.search).toLowerCase()))
      );
    }

    const summary = {
      totalRecords: borrows.length,
      totalQuantity: borrows.reduce((sum, borrow) => sum + borrow.quantity, 0),
      active: borrows.filter((borrow) => borrow.displayStatus === 'Borrowed').length,
      overdue: borrows.filter((borrow) => borrow.displayStatus === 'Overdue').length,
      returned: borrows.filter((borrow) => borrow.displayStatus === 'Returned').length,
    };

    res.json({ ...base, columns: BORROW_COLUMNS, rows: borrows, summary });
  })
);

export default router;
