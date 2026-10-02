/**
 * Application error type with an HTTP status and a message that is safe
 * to show to the client. Unexpected errors are wrapped by the global
 * error handler and never leak internals.
 */
export class AppError extends Error {
  constructor(statusCode, message, errors = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.expected = true;
  }
}

export const badRequest = (message = 'Invalid request', errors) => new AppError(400, message, errors);
export const unauthorized = (message = 'Authentication required') => new AppError(401, message);
export const forbidden = (message = 'You do not have permission to perform this action') => new AppError(403, message);
export const notFound = (message = 'Resource not found') => new AppError(404, message);
export const conflict = (message = 'Resource already exists') => new AppError(409, message);
export const tooMany = (message = 'Too many requests, please try again later') => new AppError(429, message);
export const serverError = (message = 'Something went wrong, please try again later') => new AppError(500, message);
