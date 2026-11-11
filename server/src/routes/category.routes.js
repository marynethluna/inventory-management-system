import { Router } from 'express';
import { body, param } from 'express-validator';
import { Category } from '../models/Category.js';
import { Item } from '../models/Item.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, conflict, notFound } from '../utils/ApiError.js';
import { toCategoryDTO } from '../utils/serialize.js';
import { logActivity } from '../utils/activity.js';

const router = Router();
router.use(authenticate);

async function categoriesWithStats() {
  const rows = await Category.aggregate([
    { $sort: { name: 1 } },
    {
      $lookup: {
        from: 'items',
        localField: '_id',
        foreignField: 'category',
        as: 'items',
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        createdAt: 1,
        itemCount: { $size: '$items' },
        totalQuantity: { $sum: '$items.quantity' },
      },
    },
  ]);
  return rows.map((row) => toCategoryDTO(row, row));
}

router.get(
  '/',
  requirePermission('categories:read'),
  asyncHandler(async (_req, res) => {
    const categories = await categoriesWithStats();
    res.json({ categories });
  })
);

router.post(
  '/',
  requirePermission('categories:manage'),
  validate([
    body('name').isString().trim().isLength({ min: 2, max: 60 }).withMessage('Category name must be 2–60 characters.'),
    body('description').optional({ values: 'falsy' }).isString().isLength({ max: 240 }),
  ]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name).trim();
    const existing = await Category.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (existing) throw conflict('A category with that name already exists.');

    const category = await Category.create({
      name,
      description: req.body.description || '',
      createdBy: req.user._id,
    });

    await logActivity({
      req,
      actor: req.user,
      action: 'Created category',
      entityType: 'Category',
      entityId: category._id.toString(),
      entityLabel: category.name,
    });

    res.status(201).json({ message: 'Category created.', category: toCategoryDTO(category, { itemCount: 0, totalQuantity: 0 }) });
  })
);

router.patch(
  '/:id',
  requirePermission('categories:manage'),
  validate([
    param('id').isMongoId(),
    body('name').optional().isString().trim().isLength({ min: 2, max: 60 }),
    body('description').optional({ values: 'falsy' }).isString().isLength({ max: 240 }),
  ]),
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) throw notFound('Category not found.');

    if (req.body.name && req.body.name.toLowerCase() !== category.name.toLowerCase()) {
      const duplicate = await Category.findOne({ _id: { $ne: category._id }, name: new RegExp(`^${req.body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (duplicate) throw conflict('A category with that name already exists.');
      category.name = req.body.name;
    }
    if (req.body.description !== undefined) category.description = req.body.description;
    await category.save();

    await logActivity({
      req,
      actor: req.user,
      action: 'Updated category',
      entityType: 'Category',
      entityId: category._id.toString(),
      entityLabel: category.name,
    });

    res.json({ message: 'Category updated.', category: toCategoryDTO(category) });
  })
);

router.delete(
  '/:id',
  requirePermission('categories:manage'),
  validate([param('id').isMongoId()]),
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) throw notFound('Category not found.');

    const itemCount = await Item.countDocuments({ category: category._id });
    if (itemCount > 0) {
      throw conflict(
        `This category still has ${itemCount} inventory item${itemCount === 1 ? '' : 's'}. Reassign or archive them before deleting the category.`
      );
    }

    await category.deleteOne();
    await logActivity({
      req,
      actor: req.user,
      action: 'Deleted category',
      entityType: 'Category',
      entityId: category._id.toString(),
      entityLabel: category.name,
    });

    res.json({ message: 'Category deleted.' });
  })
);

export default router;
