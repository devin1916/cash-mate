import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/config/db.js', async () => {
  const { dbMock } = await import('./helpers/dbMock.js');
  return dbMock;
});

import { createApp } from '../src/app.js';
import { hashPassword } from '../src/utils/password.js';
import { reset, on, calls } from './helpers/dbMock.js';

const app = createApp();

const USER_FIELDS = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  phone: null,
  avatar_url: null,
  role: 'user',
  status: 'active',
  currency: 'LKR',
  email_verified_at: null,
  created_at: '2026-01-01 00:00:00',
};

describe('Authentication', () => {
  let passwordHash;

  beforeAll(async () => {
    passwordHash = await hashPassword('Password1');
  });

  beforeEach(() => {
    reset();
    // Register dup-check sees no user; login sees the real account
    on('SELECT id FROM users WHERE email', []);
    on('password_hash FROM users WHERE email', { ...USER_FIELDS, password_hash: passwordHash });
    on('FROM users WHERE id = ?', { ...USER_FIELDS, password_hash: passwordHash });
    on('INSERT INTO users', { insertId: 1 });
    on('INSERT INTO refresh_tokens', { insertId: 10 });
  });

  describe('POST /api/auth/register', () => {
    it('creates an account and returns a consistent success envelope', async () => {
      on('FROM users WHERE id = ?', { ...USER_FIELDS, email: 'new@example.com' });
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'New User', email: 'new@example.com', password: 'Password1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Account created successfully');
      expect(res.body.data.user.email).toBe('new@example.com');
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.headers['set-cookie'].join(';')).toContain('refresh_token');
    });

    it('rejects duplicate emails with 409', async () => {
      on('SELECT id FROM users WHERE email', [{ id: 9 }]);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Dup', email: 'test@example.com', password: 'Password1' });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects weak passwords with field errors', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Weak', email: 'weak@example.com', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.password).toBeTruthy();
    });

    it('rejects invalid emails', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Nope', email: 'not-an-email', password: 'Password1' });
      expect(res.status).toBe(400);
      expect(res.body.errors.email).toBeTruthy();
    });

    it('hashes the password (never stores plaintext)', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Hash Check', email: 'hash@example.com', password: 'Password1' });
      const insert = calls.find((c) => c.sql.includes('INSERT INTO users'));
      expect(insert.params[2]).toMatch(/^\$2[aby]\$/); // bcrypt prefix
      expect(insert.params[2]).not.toContain('Password1');
    });
  });

  describe('POST /api/auth/login', () => {
    it('signs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('returns a generic message for wrong passwords (no user enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPass9' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('returns the same generic message for unknown emails', async () => {
      on('password_hash FROM users WHERE email', []);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'Password1' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('blocks deactivated accounts', async () => {
      on('password_hash FROM users WHERE email', { ...USER_FIELDS, password_hash: passwordHash, status: 'inactive' });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' });
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('deactivated');
    });
  });

  describe('Session lifecycle', () => {
    it('rejects requests without a token (401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects garbage tokens (401)', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage.token.here');
      expect(res.status).toBe(401);
    });

    it('accepts a valid access token', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' });
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe('1');
    });

    it('refreshes the session from the httpOnly cookie and rotates the token', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({ email: 'test@example.com', password: 'Password1' });

      let valid = true;
      on('FROM refresh_tokens WHERE token_hash', () => ({
        id: 5,
        user_id: 1,
        expires_at: '2099-01-01 00:00:00',
        revoked_at: valid ? null : '2026-01-01 00:00:00',
      }));

      const refreshed = await agent.post('/api/auth/refresh');
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.data.accessToken).toBeTruthy();

      // After logout the (rotated) cookie must be rejected
      await agent.post('/api/auth/logout');
      valid = false;
      const after = await agent.post('/api/auth/refresh');
      expect(after.status).toBe(401);
    });

    it('refresh fails without a cookie', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });
  });

  describe('Password reset flow', () => {
    it('forgot-password always answers the same way (no enumeration)', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If that email is registered');
    });

    it('forgot-password for unknown email answers identically', async () => {
      on('FROM users WHERE email', []);
      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If that email is registered');
      expect(res.body.data).toBeUndefined();
    });

    it('resets the password with a valid token and revokes sessions', async () => {
      on('FROM password_reset_tokens WHERE token_hash', {
        id: 3,
        user_id: 1,
        expires_at: '2099-01-01 00:00:00',
        used_at: null,
      });
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'a-valid-token-value', password: 'NewPass123' });
      expect(res.status).toBe(200);
      expect(calls.some((c) => c.sql.includes('UPDATE refresh_tokens SET revoked_at'))).toBe(true);
    });

    it('rejects expired/unknown reset tokens', async () => {
      on('FROM password_reset_tokens WHERE token_hash', null);
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'expired-token-value', password: 'NewPass123' });
      expect(res.status).toBe(400);
    });
  });

  describe('Change password (authenticated)', () => {
    it('requires auth', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({ currentPassword: 'Password1', newPassword: 'Password2' });
      expect(res.status).toBe(401);
    });

    it('changes the password with the correct current password', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' });
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .send({ currentPassword: 'Password1', newPassword: 'NewPass123' });
      expect(res.status).toBe(200);
      expect(calls.some((c) => c.sql.includes('UPDATE users SET password_hash'))).toBe(true);
    });

    it('rejects a wrong current password', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password1' });
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .send({ currentPassword: 'WrongPass9', newPassword: 'NewPass123' });
      expect(res.status).toBe(401);
    });
  });

  describe('API hygiene', () => {
    it('returns a standard error envelope for unknown endpoints', async () => {
      const res = await request(app).get('/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Endpoint not found' });
    });

    it('keeps protected API routes behind auth even when unknown', async () => {
      const res = await request(app).get('/api/does-not-exist');
      expect(res.status).toBe(401); // auth first - never reveals which endpoints exist
    });

    it('handles malformed JSON bodies with 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": broken');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('does not leak stack traces in error responses', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(JSON.stringify(res.body)).not.toContain('stack');
      expect(JSON.stringify(res.body)).not.toContain('SELECT');
    });
  });
});
