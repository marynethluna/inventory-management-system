import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { User } from '../models/User.js';
import { authenticate, clearAuthCookie, setAuthCookie, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ApiError, asyncHandler, badRequest, conflict, unauthorized } from '../utils/ApiError.js';
import { toUserDTO } from '../utils/serialize.js';
import { logActivity } from '../utils/activity.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in a few minutes.' },
});
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many account requests. Please try again later.' },
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many password-reset requests. Please try again later.' },
});
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many reset attempts. Please request a new link and try again later.' },
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

function createUsernameBase(email) {
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/^[._-]+|[._-]+$/g, '');
  const base = local.length >= 3 ? local : `user-${local || 'account'}`;
  return base.slice(0, 24);
}

async function makeUniqueUsername(email) {
  const base = createUsernameBase(email);
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const addition = suffix === 0 ? '' : `-${suffix}`;
    const candidate = `${base.slice(0, 30 - addition.length)}${addition}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  throw conflict('Unable to assign a username. Please contact an administrator.');
}

async function logLogin(req, user) {
  await logActivity({
    req,
    actor: user,
    action: 'Logged in',
    entityType: 'User',
    entityId: user._id.toString(),
    entityLabel: user.username,
    details: `Signed in as ${user.role}`,
  });
}

router.post(
  '/login',
  loginLimiter,
  validate([
    body('identifier').isString().trim().notEmpty().withMessage('Enter your email or username.').isLength({ max: 120 }),
    body('password').isString().notEmpty().withMessage('Password is required.').isLength({ max: 72 }),
  ]),
  asyncHandler(async (req, res) => {
    const identifier = String(req.body.identifier || '').toLowerCase().trim();
    const password = req.body.password;
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    }).select('+passwordHash');

    if (!user || !(await user.comparePassword(password))) {
      await logActivity({
        req,
        actor: null,
        action: 'Failed login attempt',
        entityType: 'User',
        entityLabel: identifier.slice(0, 120),
        details: 'Authentication failed. No password was recorded.',
      });
      throw unauthorized('Incorrect email/username or password.');
    }
    if (!user.isActive) {
      await logActivity({
        req,
        actor: user,
        action: 'Rejected login for deactivated account',
        entityType: 'User',
        entityId: user._id.toString(),
        entityLabel: user.username,
        details: 'Authentication rejected because the account is inactive.',
      });
      throw new ApiError(403, 'This account has been deactivated. Please contact an administrator.');
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });
    setAuthCookie(res, signToken(user));
    await logLogin(req, user);

    res.json({ message: `Welcome back, ${user.name.split(' ')[0]}.`, user: toUserDTO(user) });
  })
);

router.post(
  '/signup',
  signupLimiter,
  validate([
    body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name.'),
    body('email').isString().trim().isEmail().withMessage('Enter a valid email address.').isLength({ max: 120 }),
    ...passwordRules,
    body('confirmPassword').isString().custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match.'),
  ]),
  asyncHandler(async (req, res) => {
    const name = req.body.name.trim();
    const email = req.body.email.trim().toLowerCase();
    const existing = await User.findOne({ email }).select('_id');
    if (existing) throw conflict('An account with this email already exists. Try signing in or resetting your password.');

    const username = await makeUniqueUsername(email);
    const user = await User.create({
      name,
      email,
      username,
      passwordHash: await User.hashPassword(req.body.password),
      // Public sign-up always creates the least-privileged role. Any client
      // supplied role, status, or permission fields are deliberately ignored.
      role: 'Viewer',
      isActive: true,
    });

    await logActivity({
      req,
      actor: user,
      action: 'Created account',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: 'Self-registered account created with Viewer access.',
    });
    await logLogin(req, user);
    setAuthCookie(res, signToken(user));

    res.status(201).json({ message: 'Account created with Viewer access.', user: toUserDTO(user) });
  })
);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate([body('email').isString().trim().isEmail().withMessage('Enter a valid email address.').isLength({ max: 120 })]),
  asyncHandler(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const user = await User.findOne({ email, isActive: true }).select('+resetPasswordTokenHash +resetPasswordExpiresAt');
    let developmentResetToken = '';

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      user.resetPasswordExpiresAt = new Date(Date.now() + 20 * 60 * 1000);
      await user.save({ validateBeforeSave: false });

      const clientUrl = (process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].replace(/\/$/, '');
      const resetUrl = `${clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await sendPasswordResetEmail(user, resetUrl);
        if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
          // Local previews have no mail transport; expose a one-time reset token
          // to the same browser so password recovery can be tested without SMTP.
          developmentResetToken = token;
        }
      } catch (error) {
        // Keep account existence and reset tokens out of the public response.
        console.error('[password reset delivery failed]', error.message);
      }
    }

    res.json({
      message: 'If an account with that email exists, a password reset link will be sent shortly.',
      ...(developmentResetToken ? { resetToken: developmentResetToken } : {}),
    });
  })
);

router.post(
  '/reset-password',
  resetPasswordLimiter,
  validate([
    body('token').isString().isLength({ min: 64, max: 64 }).withMessage('Reset link is invalid or has expired.'),
    ...passwordRules,
    body('confirmPassword').isString().custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match.'),
  ]),
  asyncHandler(async (req, res) => {
    const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const now = new Date();
    const passwordHash = await User.hashPassword(req.body.password);
    // Consume the token and change the password in one conditional update. A
    // second simultaneous reset cannot match the now-cleared token hash.
    const user = await User.findOneAndUpdate(
      {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: { $gt: now },
        isActive: true,
      },
      {
        $set: { passwordHash, passwordChangedAt: now },
        $inc: { sessionVersion: 1 },
        $unset: { resetPasswordTokenHash: 1, resetPasswordExpiresAt: 1 },
      },
      { new: true, runValidators: true }
    );

    if (!user) throw badRequest('Reset link is invalid or has expired. Request a new link and try again.');
    clearAuthCookie(res);

    await logActivity({
      req,
      actor: user,
      action: 'Reset password',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: 'Password reset through a one-time email link.',
    });

    res.json({ message: 'Password reset successfully. Please sign in with your new password.' });
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    // Incrementing the version revokes every outstanding JWT for this account.
    req.user.sessionVersion += 1;
    await req.user.save({ validateBeforeSave: false });
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
    if (req.body.name !== undefined) user.name = req.body.name.trim();
    if (req.body.email !== undefined) {
      const email = req.body.email.trim().toLowerCase();
      if (email) {
        const existing = await User.findOne({ email, _id: { $ne: user._id } }).select('_id');
        if (existing) throw conflict('That email address is already in use.');
      }
      user.email = email;
    }
    await user.save();
    await logActivity({
      req,
      actor: user,
      action: 'Updated own profile',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: 'Profile details changed.',
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
    user.sessionVersion += 1;
    await user.save();
    setAuthCookie(res, signToken(user));
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
