import { verifyAccessToken } from '../utils/jwt.js';
import { unauthorized, forbidden } from '../utils/errors.js';
import { queryOne } from '../config/db.js';

/**
 * JWT authentication middleware.
 * Verifies the bearer access token and loads the current user, so that
 * every downstream handler works from a trusted, database-backed user
 * record (status/role cannot be forged after account deactivation).
 */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized('Authentication required');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized('Session expired, please sign in again');
    }

    const user = await queryOne(
      'SELECT id, name, email, phone, avatar_url, role, status, currency, email_verified_at, created_at FROM users WHERE id = ?',
      [payload.sub]
    );
    if (!user) throw unauthorized('Session expired, please sign in again');
    if (user.status !== 'active') throw forbidden('This account has been deactivated');

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** Admin-only guard. Must be mounted after requireAuth. */
export function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(forbidden('Administrator access required'));
  }
  return next();
}

/** Optional auth: attaches req.user when a valid token is present. */
export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        req.user = await queryOne('SELECT * FROM users WHERE id = ?', [payload.sub]);
      } catch {
        req.user = null;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}
