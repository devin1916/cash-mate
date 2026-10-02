import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env.js';

/** Sign a short-lived access token. */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, name: user.name },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpires }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

/**
 * Refresh tokens are opaque random strings stored hashed (SHA-256) in the
 * database, so a database leak cannot be used to hijack sessions.
 */
export function generateRefreshToken() {
  const raw = crypto.randomBytes(48).toString('base64url');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function refreshExpiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + env.jwt.refreshExpiresDays);
  return d;
}
