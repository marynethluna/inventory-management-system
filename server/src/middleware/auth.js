import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ApiError, asyncHandler, forbidden, unauthorized } from '../utils/ApiError.js';
import { can } from '../utils/permissions.js';

const COOKIE_NAME = 'ims_token';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me-school-inventory-2026';
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, username: user.username }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
    issuer: 'school-inventory',
  });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const token = req.cookies?.[COOKIE_NAME] || bearer;

  if (!token) throw unauthorized('Please log in to access this resource.');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { issuer: 'school-inventory' });
  } catch {
    throw new ApiError(401, 'Your session has expired. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'This account no longer exists.');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated. Please contact an administrator.');

  req.user = user;
  req.token = token;
  next();
});

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!can(req.user.role, permission)) {
      return next(forbidden(`Your role (${req.user.role}) cannot perform this action.`));
    }
    next();
  };
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`This area is restricted to: ${roles.join(', ')}.`));
    }
    next();
  };
}

export { COOKIE_NAME };
