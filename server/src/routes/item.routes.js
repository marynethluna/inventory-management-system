import { Router } from 'express';
import mongoose from 'mongoose';
import { body, param, query } from 'express-validator';
import { Item, CONDITIONS } from '../models/Item.js';
import { Category } from '../models/Category.js';
import { BorrowRecord } from '../models/BorrowRecord.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { nextSequence } from '../models/Counter.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../utils/ApiError.js';
import { toItemDTO, toTransactionDTO } from '../utils/serialize.js';
import { logActivity } from '../utils/activity.js';
import { getSystemSettings } from '../models/SystemSetting.js';
import { escapeRegex, parsePagination } from '../utils/query.js';

const router = Router();
router.use(authenticate);

const statusExpression = (status) => ({
  $eq: [
    {
      $cond: [
        { $eq: ['$quantity', 0] },
        'Out of Stock',
        { $cond: [{ $lte: ['$quantity', '$minimumStock'] }, 'Low Stock', 'In Stock'] },
      ],
    },
    status,
  ],
});

const SORTS = {
  name: 'name',
  category: 'category.name',
  quantity: 'quantity',
  minimumStock: 'minimumStock',
  dateAdded: 'createdAt',
  lastUpdated: 'updatedAt',
};

router.get(
  '/',
  requirePermission('inventory:read'),
  validate([
    query('search').optional().isString().isLength({ max: 100 }),
    query('category').optional().isString().isLength({ max: 80 }),
    query('status').optional().isString().isIn(['In Stock', 'Low Stock', 'Out of Stock']),
    query('condition').optional().isString().isIn(CONDITIONS),
    query('sort').optional().isString().isIn(Object.keys(SORTS)),
    query('order').optional().isString().isIn(['asc', 'desc']),
    query('includeArchived').optional().isString().isIn(['true', 'false']),
  ]),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, 12, 100);
    const includeArchived = req.query.includeArchived === 'true' && req.user.role === 'Administrator';

    const match = {};
    if (!includeArchived) match.isActive = true;
    if (req.query.category) {
      const category = await Category.findOne({ name: new RegExp(`^${escapeRegex(req.query.category)}$`, 'i') });
      if (!category) {
        return res.json({ items: [], total: 0, page, pages: 1, summary: { totalItems: 0, totalQuantity: 0, lowStock: 0, outOfStock: 0 }, statusCounts: { 'In Stock': 0, 'Low Stock': 0, 'Out of Stock': 0 } });
      }
      match.category = category._id;
    }
    if (req.query.condition) match.condition = req.query.condition;
    if (req.query.status) match.$expr = statusExpression(req.query.status);

    const search = req.query.search ? new RegExp(escapeRegex(req.query.search), 'i') : null;
    const sortField = SORTS[req.query.sort] || 'name';
    const sortOrder = req.query.order === 'desc' ? -1 : 1;

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' } },
      { $unwind: '$category' },
      ...(search
        ? [
            {
              $match: {
                $or: [
                  { name: search },
                  { itemCode: search },
                  { description: search },
                  { location: search },
                  { 'category.name': search },
                ],
              },
            },
          ]
        : []),
      { $sort: { [sortField]: sortOrder, name: 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
          summary: [
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
          ],
        },
      },
    ];

    const countMatch = { ...match };
    delete countMatch.$expr;
    const countPipeline = [
      { $match: countMatch },
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' } },
      { $unwind: '$category' },
      ...(search ? [{ $match: { $or: [{ name: search }, { itemCode: search }, { description: search }, { location: search }, { 'category.name': search }] } }] : []),
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
    ];

    const [resultRows, statusRows] = await Promise.all([Item.aggregate(pipeline), Item.aggregate(countPipeline)]);
    const result = resultRows[0] || {};
    const total = result.total?.[0]?.count || 0;
    const summary = result.summary?.[0] || { totalItems: 0, totalQuantity: 0, lowStock: 0, outOfStock: 0 };
    const statusCounts = { 'In Stock': 0, 'Low Stock': 0, 'Out of Stock': 0 };
    (statusRows || []).forEach((row) => { statusCounts[row._id] = row.count; });

    res.json({
      items: (result.data || []).map(toItemDTO),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      summary,
      statusCounts,
    });
  })
);

router.get(
  '/:id',
  requirePermission('inventory:read'),
  validate([param('id').isMongoId()]),
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id).populate('category', 'name');
    if (!item) throw notFound('Inventory item not found.');
    res.json({ item: toItemDTO(item) });
  })
);

router.post(
  '/',
  requirePermission('inventory:create'),
  validate([
    body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Item name must be 2–120 characters.'),
    body('categoryId').isMongoId().withMessage('Select a valid category.'),
    body('description').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
    body('quantity').isInt({ min: 0, max: 1000000 }).withMessage('Quantity must be a whole number of 0 or more.'),
    body('unit').isString().trim().isLength({ min: 1, max: 20 }).withMessage('Unit of measurement is required.'),
    body('minimumStock').optional().isInt({ min: 0, max: 1000000 }).withMessage('Minimum stock level must be 0 or more.'),
    body('location').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
    body('condition').optional().isString().isIn(CONDITIONS),
  ]),
  asyncHandler(async (req, res) => {
    const { name, categoryId, description = '', quantity, unit, location = '', condition = 'Good' } = req.body;
    const settings = await getSystemSettings();
    const normalizedUnit = String(unit || '').trim();
    const minimumStock = req.body.minimumStock === undefined ? settings.defaultMinimumStock : Number(req.body.minimumStock);
    if (!settings.units.includes(normalizedUnit)) throw badRequest('Select a valid unit of measurement from the configured units.');

    const initialQuantity = Number(quantity);
    let category;
    let item;
    let initialTransaction = null;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        category = await Category.findById(categoryId).session(session);
        if (!category) throw badRequest('The selected category does not exist.');

        const duplicate = await Item.findOne({
          name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
          category: categoryId,
          isActive: true,
        }).session(session);
        if (duplicate) throw conflict(`"${name}" already exists in ${category.name}.`);

        const itemCode = await nextSequence('itemCode', 'INV-', 4, session);
        item = await new Item({
          itemCode,
          name,
          category: categoryId,
          description,
          quantity: initialQuantity,
          unit: normalizedUnit,
          minimumStock,
          location,
          condition,
          createdBy: req.user._id,
          updatedBy: req.user._id,
        }).save({ session });

        if (initialQuantity > 0) {
          const reference = await nextSequence('transaction', 'TXN-', 5, session);
          [initialTransaction] = await StockTransaction.create([{
            reference,
            type: 'Stock In',
            item: item._id,
            quantity: initialQuantity,
            balanceAfter: initialQuantity,
            date: new Date(),
            supplier: 'Initial stock',
            remarks: 'Opening balance recorded when the item was added.',
            recordedBy: req.user._id,
          }], { session });
        }
      });
    } finally {
      await session.endSession();
    }

    await logActivity({
      req,
      actor: req.user,
      action: 'Added inventory item',
      entityType: 'Item',
      entityId: item._id.toString(),
      entityLabel: `${item.itemCode} · ${item.name}`,
      details: `Initial quantity ${initialQuantity} ${normalizedUnit} in ${category.name}`,
    });

    res.status(201).json({
      message: `"${item.name}" was added to the inventory.`,
      item: toItemDTO(item),
      initialTransaction: initialTransaction ? toTransactionDTO(initialTransaction) : null,
    });
  })
);

router.patch(
  '/:id',
  requirePermission('inventory:update'),
  validate([
    param('id').isMongoId(),
    body('name').optional().isString().trim().isLength({ min: 2, max: 120 }),
    body('categoryId').optional().isMongoId(),
    body('description').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
    body('unit').optional().isString().trim().isLength({ min: 1, max: 20 }),
    body('minimumStock').optional().isInt({ min: 0, max: 1000000 }),
    body('location').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
    body('condition').optional().isString().isIn(CONDITIONS),
  ]),
  asyncHandler(async (req, res) => {
    if (Object.prototype.hasOwnProperty.call(req.body, 'quantity')) {
      throw badRequest('Quantity cannot be edited directly. Use Stock In, Stock Out or an adjustment so the change is recorded.');
    }

    const item = await Item.findById(req.params.id);
    if (!item) throw notFound('Inventory item not found.');

    if (req.body.categoryId) {
      const category = await Category.findById(req.body.categoryId);
      if (!category) throw badRequest('The selected category does not exist.');
      item.category = category._id;
    }
    if (req.body.name !== undefined) {
      const duplicate = await Item.findOne({
        _id: { $ne: item._id },
        name: new RegExp(`^${req.body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        category: item.category,
        isActive: true,
      });
      if (duplicate) throw conflict('Another item with that name already exists in this category.');
      item.name = req.body.name;
    }
    if (req.body.description !== undefined) item.description = req.body.description;
    if (req.body.unit !== undefined) {
      const settings = await getSystemSettings();
      const unit = String(req.body.unit).trim();
      if (!settings.units.includes(unit)) throw badRequest('Select a valid unit of measurement from the configured units.');
      item.unit = unit;
    }
    if (req.body.minimumStock !== undefined) item.minimumStock = req.body.minimumStock;
    if (req.body.location !== undefined) item.location = req.body.location;
    if (req.body.condition !== undefined) item.condition = req.body.condition;
    item.updatedBy = req.user._id;
    await item.save();

    await logActivity({
      req,
      actor: req.user,
      action: 'Updated inventory item',
      entityType: 'Item',
      entityId: item._id.toString(),
      entityLabel: `${item.itemCode} · ${item.name}`,
      details: 'Item details were updated',
    });

    res.json({ message: 'Item updated.', item: toItemDTO(item) });
  })
);

router.delete(
  '/:id',
  requirePermission('inventory:archive'),
  validate([param('id').isMongoId()]),
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item) throw notFound('Inventory item not found.');

    const activeBorrows = await BorrowRecord.countDocuments({ item: item._id, status: 'Borrowed' });
    if (activeBorrows > 0) {
      throw conflict('This item is currently borrowed. Record its return before archiving it.');
    }

    item.isActive = false;
    item.updatedBy = req.user._id;
    await item.save();

    await logActivity({
      req,
      actor: req.user,
      action: 'Archived inventory item',
      entityType: 'Item',
      entityId: item._id.toString(),
      entityLabel: `${item.itemCode} · ${item.name}`,
      details: 'Item removed from the active inventory list',
    });

    res.json({ message: `"${item.name}" was archived. Its history is preserved.` });
  })
);

router.patch(
  '/:id/restore',
  requirePermission('inventory:archive'),
  validate([param('id').isMongoId()]),
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item) throw notFound('Inventory item not found.');
    if (item.isActive) throw badRequest('This item is already active.');
    item.isActive = true;
    item.updatedBy = req.user._id;
    await item.save();
    await logActivity({
      req,
      actor: req.user,
      action: 'Restored inventory item',
      entityType: 'Item',
      entityId: item._id.toString(),
      entityLabel: `${item.itemCode} · ${item.name}`,
    });
    res.json({ message: `"${item.name}" was restored to the inventory.`, item: toItemDTO(item) });
  })
);

router.get(
  '/meta/units',
  requirePermission('inventory:read'),
  asyncHandler(async (_req, res) => {
    const settings = await getSystemSettings();
    res.json({ units: settings.units, conditions: CONDITIONS });
  })
);

export default router;
