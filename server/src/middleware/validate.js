import { validationResult } from 'express-validator';
import { badRequest } from '../utils/errors.js';

/**
 * Rejects a request when any express-validator rule failed,
 * returning field-level messages for the UI.
 */
export function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = {};
  for (const err of result.array()) {
    const field = err.path || err.param || 'field';
    if (!errors[field]) errors[field] = err.msg;
  }
  return next(badRequest('Please correct the highlighted fields', errors));
}
