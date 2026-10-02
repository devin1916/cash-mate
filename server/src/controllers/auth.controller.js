import { query, queryOne, withTransaction } from '../config/db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
} from '../utils/jwt.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { badRequest, unauthorized, conflict, notFound } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';
import { sendPasswordResetEmail } from '../utils/email.js';
import env from '../config/env.js';
import crypto from 'crypto';

const REFRESH_COOKIE = 'refresh_token';

export function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone || null,
    avatar: row.avatar_url || null,
    role: row.role,
    currency: row.currency,
    emailVerified: Boolean(row.email_verified_at),
    createdAt: row.created_at,
  };
}

/** Issue access token + rotating refresh cookie. */
async function issueSession(res, user, req) {
  const { raw, hash } = generateRefreshToken();
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.id, hash, refreshExpiryDate()]
  );
  res.cookie(REFRESH_COOKIE, raw, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000,
  });
  return signAccessToken(user);
}

async function revokeRefresh(rawToken) {
  if (!rawToken) return;
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL', [
    hashToken(rawToken),
  ]);
}

async function revokeAllRefresh(userId) {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
}

const userSelect =
  'SELECT id, name, email, phone, avatar_url, role, status, currency, email_verified_at, created_at FROM users WHERE id = ?';

// ---------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------
export async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;

    const existing = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing) throw conflict('An account with this email already exists');

    const passwordHash = await hashPassword(password);
    const inserted = await query(
      `INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)`,
      [name, email, passwordHash, phone || null]
    );
    const userId = inserted.insertId;
    const user = await queryOne(userSelect, [userId]);

    const accessToken = await issueSession(res, user, req);
    await logAudit({ userId, action: 'register', req });

    return sendSuccess(res, 'Account created successfully', { user: sanitizeUser(user), accessToken }, { status: 201 });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await queryOne(
      'SELECT id, name, email, phone, avatar_url, role, status, currency, email_verified_at, created_at, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    // Generic message: never reveal whether the email exists
    const valid = user && (await verifyPassword(password, user.password_hash));
    if (!valid) {
      await logAudit({ userId: user ? user.id : null, action: 'login_failed', req, details: { email } });
      throw unauthorized('Invalid email or password');
    }
    if (user.status !== 'active') {
      throw unauthorized('This account has been deactivated. Contact support.');
    }

    const accessToken = await issueSession(res, user, req);
    await logAudit({ userId: user.id, action: 'login', req });

    return sendSuccess(res, 'Signed in successfully', { user: sanitizeUser(user), accessToken });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/refresh  (reads httpOnly cookie)
// ---------------------------------------------------------------------
export async function refresh(req, res, next) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw unauthorized('Session expired, please sign in again');

    const tokenRow = await queryOne(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ? LIMIT 1`,
      [hashToken(raw)]
    );
    if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) < new Date()) {
      throw unauthorized('Session expired, please sign in again');
    }

    const user = await queryOne(userSelect, [tokenRow.user_id]);
    if (!user || user.status !== 'active') throw unauthorized('Session expired, please sign in again');

    // Rotate: revoke the used token, issue a fresh one
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [tokenRow.id]);
    const accessToken = await issueSession(res, user, req);

    return sendSuccess(res, 'Session refreshed', { user: sanitizeUser(user), accessToken });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------
export async function logout(req, res, next) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    await revokeRefresh(raw);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    if (req.user) await logAudit({ userId: req.user.id, action: 'logout', req });
    return sendSuccess(res, 'Signed out');
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await queryOne('SELECT id, name, email FROM users WHERE email = ? LIMIT 1', [email]);

    // Always answer the same way so the endpoint cannot enumerate accounts
    if (user) {
      const raw = crypto.randomBytes(32).toString('base64url');
      await query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 60 MINUTE))',
        [user.id, hashToken(raw)]
      );
      const resetUrl = `${env.appUrl}/reset-password?token=${raw}`;
      await sendPasswordResetEmail(user.email, resetUrl);
      await logAudit({ userId: user.id, action: 'password_reset_requested', req });

      // Dev convenience only: expose the token when not running in production
      if (!env.isProduction) {
        return sendSuccess(res, 'If that email is registered, a reset link has been sent', {
          devResetToken: raw,
        });
      }
    }
    return sendSuccess(res, 'If that email is registered, a reset link has been sent');
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------
export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const tokenRow = await queryOne(
      'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1',
      [hashToken(token)]
    );
    if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
      throw badRequest('This reset link is invalid or has expired. Request a new one.');
    }

    const passwordHash = await hashPassword(password);
    await withTransaction(async (conn) => {
      await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, tokenRow.user_id]);
      await conn.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [tokenRow.id]);
      await conn.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [
        tokenRow.user_id,
      ]);
    });
    await logAudit({ userId: tokenRow.user_id, action: 'password_reset', req });

    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return sendSuccess(res, 'Password updated. Please sign in with your new password.');
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/change-password  (authenticated)
// ---------------------------------------------------------------------
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const row = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!(await verifyPassword(currentPassword, row.password_hash))) {
      throw unauthorized('Current password is incorrect');
    }

    const passwordHash = await hashPassword(newPassword);
    await withTransaction(async (conn) => {
      await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
      // Revoke every session, then keep this device signed in with a fresh one
      await conn.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [
        req.user.id,
      ]);
    });
    await logAudit({ userId: req.user.id, action: 'password_change', req });

    const accessToken = await issueSession(res, req.user, req);
    return sendSuccess(res, 'Password changed successfully', { accessToken });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------
export async function me(req, res) {
  return sendSuccess(res, 'Current session', { user: sanitizeUser(req.user) });
}

// ---------------------------------------------------------------------
// POST /api/auth/verify-email
// ---------------------------------------------------------------------
export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;
    const tokenRow = await queryOne(
      'SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ? LIMIT 1',
      [hashToken(token)]
    );
    if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
      throw notFound('This verification link is invalid or has expired');
    }
    await query('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [tokenRow.user_id]);
    await query('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?', [tokenRow.id]);
    return sendSuccess(res, 'Email verified');
  } catch (error) {
    return next(error);
  }
}
