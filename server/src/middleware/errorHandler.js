import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

/** 404 for unknown routes, keeping the standard error envelope. */
export function notFoundHandler(_req, res) {
  return sendError(res, 404, 'Endpoint not found');
}

/**
 * Global error handler.
 * - AppError: expected, message is safe for clients.
 * - Everything else: logged server-side, generic message to the client
 *   (never expose SQL, stack traces or credentials).
 */
export function errorHandler(error, _req, res, _next) {
  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.message, error.errors);
  }

  // Malformed JSON body
  if (error?.type === 'entity.parse.failed') {
    return sendError(res, 400, 'Invalid request body');
  }

  // Multer upload errors (size / unexpected field)
  if (error?.name === 'MulterError') {
    const msg = error.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 2 MB)' : 'Invalid file upload';
    return sendError(res, 400, msg);
  }

  // MySQL duplicate key
  if (error?.code === 'ER_DUP_ENTRY') {
    return sendError(res, 409, 'That record already exists');
  }

  logger.error('unhandled error', { message: error?.message, stack: error?.stack });
  return sendError(res, 500, 'Something went wrong, please try again later');
}
