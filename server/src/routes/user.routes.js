import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { User } from '../models/User.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../utils/ApiError.js';
import { toUserDTO } from '../utils/serialize.js';
import { logActivity } from '../utils/activity.js';
import { parsePagination, escapeRegex } from '../utils/query.js';
import { ROLES_LIST } from '../models/User.js';

const router = Router();
router.use(authenticate);

const passwordRules = [
  body('password')
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be between 8 and 72 characters.')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain at least one letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.'),
];

router.get(
  '/',
  requirePermission('users:read'),
  validate([
    query('search').optional().isString().isLength({ max: 80 }),
    query('role').optional().isString().isIn(ROLES_LIST),
    query('status').optional().isString().isIn(['Active', 'Inactive']),
  ]),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, 20);
    const filter = {};
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$or = [{ name: rx }, { username: rx }, { email: rx }];
    }
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status === 'Active') filter.isActive = true;
    if (req.query.status === 'Inactive') filter.isActive = false;

    const [users, total, roleCounts, totalAccounts, activeAccounts] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
    ]);

    const counts = { Administrator: 0, 'Inventory Staff': 0, Viewer: 0 };
    roleCounts.forEach((entry) => {
      counts[entry._id] = entry.count;
    });

    res.json({
      users: users.map(toUserDTO),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts,
      totalAccounts,
      activeAccounts,
    });
  })
);

router.post(
  '/',
  requirePermission('users:manage'),
  validate([
    body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Enter the user’s full name.'),
    body('username')
      .isString()
      .trim()
      .toLowerCase()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3–30 characters.')
      .matches(/^[a-z0-9._-]+$/)
      .withMessage('Username may only contain letters, numbers, dots, dashes and underscores.'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Enter a valid email address.'),
    body('role').isString().isIn(ROLES_LIST).withMessage('Select a valid role.'),
    ...passwordRules,
  ]),
  asyncHandler(async (req, res) => {
    const { name, username, role, password } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    const existingUsername = await User.findOne({ username }).select('_id');
    if (existingUsername) throw conflict('That username is already taken.');
    if (email) {
      const existingEmail = await User.findOne({ email }).select('_id');
      if (existingEmail) throw conflict('That email address is already in use.');
    }

    const user = await User.create({
      name,
      username,
      email,
      role,
      passwordHash: await User.hashPassword(password),
      createdBy: req.user._id,
    });

    await logActivity({
      req,
      actor: req.user,
      action: 'Created user account',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: `${user.name} assigned as ${user.role}`,
    });

    res.status(201).json({ message: 'User account created.', user: toUserDTO(user) });
  })
);

router.patch(
  '/:id',
  requirePermission('users:manage'),
  validate([
    param('id').isMongoId(),
    body('name').optional().isString().trim().isLength({ min: 2, max: 80 }),
    body('email').optional({ values: 'falsy' }).isEmail(),
    body('role').optional().isString().isIn(ROLES_LIST),
  ]),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw notFound('User account not found.');

    if (user._id.equals(req.user._id) && req.body.role && req.body.role !== 'Administrator') {
      throw badRequest('You cannot remove your own administrator access.');
    }

    const roleChanged = req.body.role !== undefined && req.body.role !== user.role;
    if (roleChanged && user.isActive && user.role === 'Administrator') {
      const activeAdmins = await User.countDocuments({ role: 'Administrator', isActive: true });
      if (activeAdmins <= 1) throw badRequest('At least one active administrator is required.');
    }

    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.email !== undefined) {
      const email = String(req.body.email || '').trim().toLowerCase();
      if (email) {
        const existingEmail = await User.findOne({ email, _id: { $ne: user._id } }).select('_id');
        if (existingEmail) throw conflict('That email address is already in use.');
      }
      user.email = email;
    }
    if (req.body.role !== undefined) user.role = req.body.role;
    if (roleChanged) user.sessionVersion += 1;
    await user.save();

    await logActivity({
      req,
      actor: req.user,
      action: roleChanged ? 'Changed account role' : 'Updated user account',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: roleChanged ? `Role changed to ${user.role}.` : `Name or email updated for ${user.name}.`,
    });

    res.json({ message: 'User account updated.', user: toUserDTO(user) });
  })
);

router.post(
  '/:id/toggle',
  requirePermission('users:manage'),
  validate([param('id').isMongoId()]),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw notFound('User account not found.');
    if (user._id.equals(req.user._id)) throw badRequest('You cannot deactivate your own account.');

    if (user.isActive && user.role === 'Administrator') {
      const activeAdmins = await User.countDocuments({ role: 'Administrator', isActive: true });
      if (activeAdmins <= 1) throw badRequest('At least one active administrator is required.');
    }

    user.isActive = !user.isActive;
    user.sessionVersion += 1;
    await user.save();

    await logActivity({
      req,
      actor: req.user,
      action: user.isActive ? 'Activated account' : 'Deactivated account',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: `${user.name} is now ${user.isActive ? 'active' : 'inactive'}`,
    });

    res.json({
      message: `Account ${user.isActive ? 'activated' : 'deactivated'}.`,
      user: toUserDTO(user),
    });
  })
);

router.post(
  '/:id/reset-password',
  requirePermission('users:manage'),
  validate([param('id').isMongoId(), ...passwordRules]),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw notFound('User account not found.');
    user.passwordHash = await User.hashPassword(req.body.password);
    user.passwordChangedAt = new Date();
    user.sessionVersion += 1;
    await user.save();

    await logActivity({
      req,
      actor: req.user,
      action: 'Reset user password',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: `Password reset for ${user.name}`,
    });

    res.json({ message: `Password reset for ${user.name}.` });
  })
);

router.get(
  '/roles/matrix',
  requirePermission('users:read'),
  asyncHandler(async (_req, res) => {
    res.json({
      roles: ROLES_LIST,
      message: 'Role permissions are enforced by the API. See server/src/utils/permissions.js.',
    });
  })
);

export default router;
