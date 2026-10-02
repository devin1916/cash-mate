import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/config/db.js', async () => {
  const { dbMock } = await import('./helpers/dbMock.js');
  return dbMock;
});

import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { reset, on, calls } from './helpers/dbMock.js';

const app = createApp();

const USER = { id: 1, name: 'Test User', email: 'test@example.com', phone: null, avatar_url: null, role: 'user', status: 'active', currency: 'LKR', email_verified_at: null, created_at: '2026-01-01 00:00:00' };

const TX_ROW = {
  id: 7,
  user_id: 1,
  type: 'expense',
  amount: 2500,
  category_id: 5,
  payment_method_id: 1,
  recurring_id: null,
  description: 'Lunch at cafe',
  notes: null,
  date: '2026-01-15',
  status: 'completed',
  receipt_url: null,
  created_at: '2026-01-15 12:00:00',
  updated_at: '2026-01-15 12:00:00',
  category_name: 'Food',
  category_color: '#ef4444',
  payment_method_name: 'Cash',
};

const EXPENSE_CAT = { id: 5, user_id: null, name: 'Food', type: 'expense', color: '#ef4444', icon: 'utensils', is_system: 1 };
const INCOME_CAT = { id: 13, user_id: null, name: 'Salary', type: 'income', color: '#22c55e', icon: 'banknote', is_system: 1 };

const auth = () => `Bearer ${signAccessToken({ id: 1, role: 'user', name: 'Test User' })}`;

describe('Transactions API', () => {
  beforeEach(() => {
    reset();
    on('FROM users WHERE id = ?', USER);
    on('FROM categories WHERE id = ?', EXPENSE_CAT);
    on('FROM payment_methods WHERE id = ?', { id: 1, user_id: null, name: 'Cash', is_system: 1 });
    on('FROM transactions WHERE id = ?', TX_ROW); // ownership lookups (update/delete)
    on('WHERE t.id = ?', TX_ROW); // joined select (create/get/update responses)
    on('INSERT INTO transactions', { insertId: 7 });
  });

  describe('Authorization', () => {
    it('requires authentication for all transaction routes', async () => {
      expect((await request(app).get('/api/transactions')).status).toBe(401);
      expect((await request(app).post('/api/transactions').send({})).status).toBe(401);
      expect((await request(app).patch('/api/transactions/7').send({})).status).toBe(401);
      expect((await request(app).delete('/api/transactions/7')).status).toBe(401);
    });

    it('rejects access to another user\'s transaction with 404 (row is user-scoped)', async () => {
      // DB returns nothing because the row belongs to user 2 while JWT says user 1
      on('WHERE t.id = ?', null);
      const res = await request(app).get('/api/transactions/7').set('Authorization', auth());
      expect(res.status).toBe(404);

      const call = calls.find((c) => c.sql.includes('WHERE t.id = ?'));
      expect(call.sql).toContain('t.user_id = ?');
      expect(call.params).toEqual(['7', 1]); // id + authenticated user id
      expect(call.params).not.toContain(2);
    });

    it('scopes list queries by the token user, never the request body', async () => {
      on('COUNT(*) AS total', { total: 0 });
      on('SELECT t.*', []);
      const res = await request(app).get('/api/transactions').set('Authorization', auth());
      expect(res.status).toBe(200);
      for (const call of calls.filter((c) => c.sql.includes('t.user_id = ?'))) {
        expect(call.params[0]).toBe(1);
      }
    });

    it('cannot delete another user\'s transaction', async () => {
      on('FROM transactions WHERE id = ?', null);
      const res = await request(app).delete('/api/transactions/7').set('Authorization', auth());
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/transactions (expense & income creation)', () => {
    it('creates an expense', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', auth())
        .send({ type: 'expense', amount: 2500, categoryId: 5, description: 'Lunch', date: '2026-01-15', paymentMethodId: 1 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.category).toBe('Food');
      expect(res.body.data.transaction.amount).toBe(2500);

      const insert = calls.find((c) => c.sql.includes('INSERT INTO transactions'));
      expect(insert.params[0]).toBe(1); // user_id from JWT
      expect(insert.params[1]).toBe('expense');
    });

    it('creates an income with an income category', async () => {
      on('FROM categories WHERE id = ?', INCOME_CAT);
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', auth())
        .send({ type: 'income', amount: 150000, categoryId: 13, description: 'Salary', date: '2026-01-01' });
      expect(res.status).toBe(201);
      const insert = calls.find((c) => c.sql.includes('INSERT INTO transactions'));
      expect(insert.params[1]).toBe('income');
    });

    it('rejects amount of zero or below', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', auth())
        .send({ type: 'expense', amount: 0, categoryId: 5, description: 'Bad', date: '2026-01-15' });
      expect(res.status).toBe(400);
      expect(res.body.errors.amount).toBeTruthy();
    });

    it('rejects missing category', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', auth())
        .send({ type: 'expense', amount: 100, description: 'No cat', date: '2026-01-15' });
      expect(res.status).toBe(400);
      expect(res.body.errors.categoryId).toBeTruthy();
    });

    it('rejects impossible dates (2026-02-30)', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', auth())
        .send({ type: 'expense', amount: 100, categoryId: 5, description: 'Bad date', date: '2026-02-30' });
      expect(res.status).toBe(400);
      expect(res.body.errors.date).toBeTruthy();
    });

    it('rejects category / transaction type mismatch', async () => {
      on('FROM categories WHERE id = ?', INCOME_CAT); // income cat on expense tx
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', auth())
        .send({ type: 'expense', amount: 100, categoryId: 13, description: 'Mismatch', date: '2026-01-15' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('does not match');
    });

    it('rejects a payment method owned by another user', async () => {
      on('FROM payment_methods WHERE id = ?', null);
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', auth())
        .send({ type: 'expense', amount: 100, categoryId: 5, description: 'X', date: '2026-01-15', paymentMethodId: 99 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/transactions (list)', () => {
    it('returns page metadata and honours pagination', async () => {
      on('COUNT(*) AS total', { total: 42 });
      on('SELECT t.*', [TX_ROW]);
      const res = await request(app)
        .get('/api/transactions?page=2&limit=5')
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({ page: 2, limit: 5, total: 42, totalPages: 9 });
      const rowsCall = calls.find((c) => c.sql.includes('SELECT t.*'));
      expect(rowsCall.params.slice(-2)).toEqual([5, 5]); // limit, offset
    });

    it('applies search, type and date filters server-side', async () => {
      on('COUNT(*) AS total', { total: 1 });
      on('SELECT t.*', [TX_ROW]);
      await request(app)
        .get('/api/transactions?search=lunch&type=expense&from=2026-01-01&to=2026-01-31&sort=amount&order=asc')
        .set('Authorization', auth());

      const rowsCall = calls.find((c) => c.sql.includes('SELECT t.*'));
      expect(rowsCall.sql).toContain('t.description LIKE ?');
      expect(rowsCall.sql).toContain('t.type = ?');
      expect(rowsCall.sql).toContain('t.date >= ?');
      expect(rowsCall.sql).toContain('t.date <= ?');
      expect(rowsCall.sql).toContain('ORDER BY t.amount ASC');
      expect(rowsCall.params).toContain('%lunch%');
    });

    it('rejects invalid pagination values', async () => {
      const res = await request(app).get('/api/transactions?limit=9999').set('Authorization', auth());
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/transactions/:id', () => {
    it('updates an owned transaction', async () => {
      const res = await request(app)
        .patch('/api/transactions/7')
        .set('Authorization', auth())
        .send({ amount: 3000 });

      expect(res.status).toBe(200);
      const update = calls.find((c) => c.sql.startsWith('UPDATE transactions SET'));
      expect(update.params).toEqual([3000, 7, 1]); // value, id, user_id scope
    });

    it('rejects updating another user\'s transaction', async () => {
      on('FROM transactions WHERE id = ?', null);
      const res = await request(app)
        .patch('/api/transactions/7')
        .set('Authorization', auth())
        .send({ amount: 3000 });
      expect(res.status).toBe(404);
    });

    it('rejects invalid amounts', async () => {
      const res = await request(app)
        .patch('/api/transactions/7')
        .set('Authorization', auth())
        .send({ amount: -5 });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/transactions/:id', () => {
    it('deletes an owned transaction and writes an audit log', async () => {
      const res = await request(app).delete('/api/transactions/7').set('Authorization', auth());
      expect(res.status).toBe(200);
      const del = calls.find((c) => c.sql.startsWith('DELETE FROM transactions'));
      expect(del.params).toEqual([7, 1]);
      expect(calls.some((c) => c.sql.includes('INSERT INTO audit_logs'))).toBe(true);
    });
  });
});
