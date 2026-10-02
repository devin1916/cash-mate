import { query, queryOne, withTransaction } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { unauthorized, notFound, badRequest } from '../utils/errors.js';
import { verifyPassword } from '../utils/password.js';
import { logAudit } from '../utils/audit.js';
import { sanitizeUser } from './auth.controller.js';
import { fileUrl } from '../middleware/upload.js';

// ---------------------------------------------------------------------
// PUT /api/users/profile  - update name / phone / currency
// ---------------------------------------------------------------------
export async function updateProfile(req, res, next) {
  try {
    const { name, phone, currency } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone || null);
    }
    if (currency !== undefined) {
      updates.push('currency = ?');
      params.push(currency);
    }
    if (updates.length === 0) throw badRequest('No changes provided');

    params.push(req.user.id);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const user = await queryOne(
      'SELECT id, name, email, phone, avatar_url, role, status, currency, email_verified_at, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    await logAudit({ userId: req.user.id, action: 'profile_update', req });
    return sendSuccess(res, 'Profile updated', { user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/users/avatar  - profile picture upload
// ---------------------------------------------------------------------
export async function updateAvatar(req, res, next) {
  try {
    if (!req.file) throw badRequest('Please choose an image to upload');
    const url = fileUrl(req.file.filename);
    await query('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.user.id]);
    const user = await queryOne(
      'SELECT id, name, email, phone, avatar_url, role, status, currency, email_verified_at, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    return sendSuccess(res, 'Profile picture updated', { user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------
// DELETE /api/users/account  - full account deletion (cascades all data)
// ---------------------------------------------------------------------
export async function deleteAccount(req, res, next) {
  try {
    const { password } = req.body;
    const row = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!(await verifyPassword(password, row.password_hash))) {
      throw unauthorized('Password is incorrect');
    }

    // Deleting the user cascades to every financial record (no orphans).
    await withTransaction(async (conn) => {
      await conn.query('DELETE FROM users WHERE id = ?', [req.user.id]);
    });
    await logAudit({ userId: null, action: 'account_delete', req, details: { email: req.user.email } });
    res.clearCookie('refresh_token', { path: '/api/auth' });
    return sendSuccess(res, 'Your account and all associated data have been deleted');
  } catch (error) {
    return next(error);
  }
}
