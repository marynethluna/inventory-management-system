import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { User } from '../models/User.js';
import { authenticate, clearAuthCookie, setAuthCookie, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest, unauthorized } from '../utils/ApiError.js';
import { toUserDTO } from '../utils/serialize.js';
import { logActivity } from '../utils/activity.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in a few minutes.' },
});

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

router.post(
  '/login',
  loginLimiter,
  validate([
    body('username').isString().trim().notEmpty().withMessage('Username is required.').isLength({ max: 40 }),
    body('password').isString().notEmpty().withMessage('Password is required.').isLength({ max: 72 }),
  ]),
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || '').toLowerCase().trim();
    const { password } = req.body;

    const user = await User.findOne({ username }).select('+passwordHash');
    // Constant-ish response: never reveal whether the username exists.
    if (!user || !(await user.comparePassword(password))) {
      throw unauthorized('Incorrect username or password.');
    }
    if (!user.isActive) {
      throw new (await import('../utils/ApiError.js')).ApiError(
        403,
        'This account has been deactivated. Please contact an administrator.'
      );
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user);
    setAuthCookie(res, token);

    await logActivity({
      req,
      actor: user,
      action: 'Logged in',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: `Signed in as ${user.role}`,
    });

    res.json({ message: `Welcome back, ${user.name.split(' ')[0]}.`, token, user: toUserDTO(user) });
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await logActivity({
      req,
      actor: req.user,
      action: 'Logged out',
      entityType: 'User',
      entityId: req.user._id.toString(),
      entityLabel: req.user.username,
    });
    clearAuthCookie(res);
    res.json({ message: 'You have been logged out.' });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) throw unauthorized('Account not found.');
    res.json({ user: toUserDTO(user) });
  })
);

router.patch(
  '/profile',
  authenticate,
  validate([
    body('name').optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage('Enter a valid full name.'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Enter a valid email address.'),
  ]),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.email !== undefined) user.email = req.body.email;
    await user.save();
    await logActivity({
      req,
      actor: user,
      action: 'Updated own profile',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: 'Profile details changed',
    });
    res.json({ message: 'Profile updated.', user: toUserDTO(user) });
  })
);

router.post(
  '/change-password',
  authenticate,
  validate([
    body('currentPassword').isString().notEmpty().withMessage('Current password is required.'),
    ...passwordRules,
  ]),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+passwordHash');
    const { currentPassword, password: newPassword } = req.body;
    if (!(await user.comparePassword(currentPassword))) {
      throw badRequest('Your current password is incorrect.');
    }
    if (currentPassword === newPassword) {
      throw badRequest('Your new password must be different from the current one.');
    }
    user.passwordHash = await User.hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    await user.save();
    await logActivity({
      req,
      actor: user,
      action: 'Changed password',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
    });
    res.json({ message: 'Password updated successfully.' });
  })
);

export default router;
