import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  let status = error.statusCode || 500;
  let message = error.message || 'Unexpected server error.';
  let details = error.details;

  if (error instanceof mongoose.Error.ValidationError) {
    status = 422;
    message = 'Validation failed.';
    details = Object.values(error.errors).map((entry) => ({ field: entry.path, message: entry.message }));
  } else if (error instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${error.path}.`;
  } else if (error.code === 11000) {
    status = 409;
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    message = `A record with that ${field} already exists.`;
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    status = 401;
    message = 'Your session has expired. Please log in again.';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed request body.';
  }

  if (status >= 500) {
    console.error('[server error]', error);
  }

  res.status(status).json({
    message,
    ...(details ? { details } : {}),
    ...(status >= 500 ? { hint: 'Please try again. Contact the administrator if the problem persists.' } : {}),
  });
}
