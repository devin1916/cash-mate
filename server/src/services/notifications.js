import { query, queryOne } from '../config/db.js';

/**
 * Create a notification. Never throws (alerts must not break user flows).
 * `dedupeKey` makes creation idempotent via the unique (user_id, dedupe_key)
 * index from migration 002.
 */
export async function notify(userId, { type = 'system', title, message, data = null, dedupeKey = null }) {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, message, data, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [userId, type, title, message, data ? JSON.stringify(data) : null, dedupeKey]
    );
  } catch (error) {
     
    console.error('[notify] failed:', error.message);
  }
}

export async function getUnreadCount(userId) {
  try {
    const row = await queryOne(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return row?.cnt ?? 0;
  } catch {
    return 0;
  }
}
