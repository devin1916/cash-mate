import { query } from '../config/db.js';

/**
 * Record an important account / financial action in the audit log.
 * Never throws: audit failures must not break the user request.
 *
 * IP address and user agent are stored only for security-relevant actions
 * (login, password change, account deletion) where they are legally
 * justified for fraud prevention.
 */
export async function logAudit({ userId = null, action, entityType = null, entityId = null, req = null, details = null }) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null) : null;
    const userAgent = req ? (req.headers['user-agent'] || null) : null;
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entityType,
        entityId === null ? null : String(entityId),
        ip ? String(ip).slice(0, 45) : null,
        userAgent ? String(userAgent).slice(0, 255) : null,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (error) {
     
    console.error('[audit] failed to write audit log:', error.message);
  }
}
