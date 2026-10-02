import { query, queryOne } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { notFound } from '../utils/errors.js';

/** Notification centre: list, unread count, mark read, delete. */

const mapNotification = (row) => ({
  id: String(row.id),
  type: row.type,
  title: row.title,
  message: row.message,
  data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : null,
  isRead: Boolean(row.is_read),
  createdAt: row.created_at,
});

// GET /api/notifications?page=&unreadOnly=
export async function listNotifications(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === 'true';

    const where = ['user_id = ?'];
    const params = [req.user.id];
    if (unreadOnly) where.push('is_read = 0');

    const countRow = await queryOne(
      `SELECT COUNT(*) AS total FROM notifications WHERE ${where.join(' AND ')}`,
      params
    );
    const unreadRow = await queryOne('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0', [
      req.user.id,
    ]);
    const rows = await query(
      `SELECT * FROM notifications WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return sendSuccess(res, 'Notifications retrieved', { notifications: rows.map(mapNotification) }, {
      meta: {
        page,
        limit,
        total: countRow.total,
        totalPages: Math.max(1, Math.ceil(countRow.total / limit)),
        unread: unreadRow.cnt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/notifications/unread-count
export async function unreadCount(req, res, next) {
  try {
    const row = await queryOne('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0', [
      req.user.id,
    ]);
    return sendSuccess(res, 'Unread count retrieved', { count: row.cnt });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/notifications/:id/read
export async function markRead(req, res, next) {
  try {
    const result = await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (result.affectedRows === 0) throw notFound('Notification not found');
    return sendSuccess(res, 'Notification marked as read');
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/notifications/read-all
export async function markAllRead(req, res, next) {
  try {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    return sendSuccess(res, 'All notifications marked as read');
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/notifications/:id
export async function deleteNotification(req, res, next) {
  try {
    const result = await query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (result.affectedRows === 0) throw notFound('Notification not found');
    return sendSuccess(res, 'Notification deleted');
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/notifications  - clear all for this user
export async function clearNotifications(req, res, next) {
  try {
    await query('DELETE FROM notifications WHERE user_id = ?', [req.user.id]);
    return sendSuccess(res, 'Notifications cleared');
  } catch (error) {
    return next(error);
  }
}
