export class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const badRequest = (message, details) => new ApiError(400, message, details);
export const unauthorized = (message = 'Authentication required.') => new ApiError(401, message);
export const forbidden = (message = 'You do not have permission to perform this action.') => new ApiError(403, message);
export const notFound = (message = 'Resource not found.') => new ApiError(404, message);
export const conflict = (message) => new ApiError(409, message);
