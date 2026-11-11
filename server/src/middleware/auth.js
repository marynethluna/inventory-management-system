import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ApiError, asyncHandler, forbidden, unauthorized } from '../utils/ApiError.js';
import { can } from '../utils/permissions.js';

const COOKIE_NAME = 'ims_token';
const DEVELOPMENT_SECRET = 'local-only-school-inventory-secret-change-before-deploying';
const configuredSecret = String(process.env.JWT_SECRET || '').trim();
const secretIsPlaceholder = /^(replace|change|example|your-|dev-only|local-only)/i.test(configuredSecret);
export const JWT_SECRET = process.env.NODE_ENV === 'production'
  ? (configuredSecret.length >= 32 && !secretIsPlaceholder ? configuredSecret : '')
  : configuredSecret || DEVELOPMENT_SECRET;
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '7d';

function ttlMilliseconds(value) {
  const match = String(value).match(/^(\d+)([smhd])$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return amount * ({ s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttlMilliseconds(TOKEN_TTL),
  };
}

export function signToken(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured in production.');
  return jwt.sign(
    { sub: user._id.toString(), sv: Number(user.sessionVersion || 0) },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL, issuer: 'school-inventory', audience: 'inventory-management' }
  );
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

export function clearAuthCookie(res) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(COOKIE_NAME, options);
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  // The session JWT is intentionally cookie-only; browser storage and bearer
  // tokens are not accepted so JavaScript cannot read or persist credentials.
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw unauthorized('Please log in to access this resource.');
  if (!JWT_SECRET) throw new ApiError(500, 'Authentication is not configured.');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'school-inventory',
      audience: 'inventory-management',
    });
  } catch {
    throw unauthorized('Your session has expired. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('This account no longer exists.');
  if (!user.isActive) throw unauthorized('This account has been deactivated. Please contact an administrator.');
  if (Number(payload.sv) !== Number(user.sessionVersion || 0)) {
    throw unauthorized('This session is no longer valid. Please log in again.');
  }

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
