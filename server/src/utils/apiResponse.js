/**
 * Consistent API response helpers.
 *
 * Success: { "success": true,  "message": "...", "data": {}, "meta": {} }
 * Error:   { "success": false, "message": "...", "errors": {} }
 */

export function sendSuccess(res, message, data = null, { status = 200, meta } = {}) {
  const body = { success: true, message };
  if (data !== null && data !== undefined) body.data = data;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function sendError(res, status, message, errors = undefined) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}
