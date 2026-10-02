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

const auth = () => `Bearer ${signAccessToken({ id: 1, role: 'user', name: 'Test User' })}`;

const FOOD_BUDGET = {
  id: 4,
  user_id: 1,
  category_id: 5,
  amount: 30000,
  month: 1,
  year: 2026,
  category_name: 'Food',
  category_color: '#ef4444',
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
};

describe('Budgets API', () => {
  beforeEach(() => {
    reset();
    on('FROM users WHERE id = ?', USER);
    on('FROM categories WHERE id = ?', { id: 5, user_id: null, name: 'Food', type: 'expense', color: '#ef4444', icon: 'utensils', is_system: 1 });
  });

  describe('GET /api/budgets (calculations)', () => {
    it('computes spent, remaining and percent used per budget', async () => {
      on('FROM budgets b', [FOOD_BUDGET]);
      on('GROUP BY category_id', [{ cat: 5, total: 22500 }]);
      on("CASE WHEN type = 'income'", { income: 150000, expenses: 22500 });

      const res = await request(app).get('/api/budgets?month=1&year=2026').set('Authorization', auth());

      expect(res.status).toBe(200);
      const budget = res.body.data.budgets[0];
      expect(budget.category).toBe('Food');
      expect(budget.amount).toBe(30000);
      expect(budget.spent).toBe(22500);
      expect(budget.remaining).toBe(7500);
      expect(budget.percentUsed).toBe(75);
      expect(res.body.meta.totalBudget).toBe(30000);
      expect(res.body.meta.totalSpent).toBe(22500);
    });

    it('uses whole-period spending for overall budgets (no category)', async () => {
      on('FROM budgets b', [{ ...FOOD_BUDGET, id: 9, category_id: null, category_name: null }]);
      on('GROUP BY category_id', [
        { cat: 5, total: 15000 },
        { cat: 3, total: 25000 },
      ]);
      on("CASE WHEN type = 'income'", { income: 150000, expenses: 40000 });

      const res = await request(app).get('/api/budgets?month=1&year=2026').set('Authorization', auth());
      const budget = res.body.data.budgets[0];
      expect(budget.category).toBeNull();
      expect(budget.spent).toBe(40000); // all expenses, not just one category
    });

    it('scopes budget queries to the authenticated user', async () => {
      on('FROM budgets b', []);
      on('GROUP BY category_id', []);
      on("CASE WHEN type = 'income'", { income: 0, expenses: 0 });
      await request(app).get('/api/budgets').set('Authorization', auth());
      const call = calls.find((c) => c.sql.includes('FROM budgets b'));
      expect(call.params[0]).toBe(1);
    });

    it('requires authentication', async () => {
      expect((await request(app).get('/api/budgets')).status).toBe(401);
    });
  });

  describe('POST /api/budgets', () => {
    it('creates a category budget', async () => {
      on('SELECT id FROM budgets WHERE', []);
      on('INSERT INTO budgets', { insertId: 4 });
      on('WHERE b.id = ?', FOOD_BUDGET);

      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', auth())
        .send({ categoryId: 5, amount: 30000, month: 1, year: 2026 });

      expect(res.status).toBe(201);
      expect(res.body.data.budget.amount).toBe(30000);
      const insert = calls.find((c) => c.sql.includes('INSERT INTO budgets'));
      expect(insert.params[0]).toBe(1);
      expect(insert.params).toEqual([1, 5, 30000, 1, 2026]);
    });

    it('rejects a duplicate budget for the same category and period', async () => {
      on('SELECT id FROM budgets WHERE', [{ id: 4 }]);
      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', auth())
        .send({ categoryId: 5, amount: 30000, month: 1, year: 2026 });
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });

    it('rejects zero/negative amounts', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', auth())
        .send({ categoryId: 5, amount: 0, month: 1, year: 2026 });
      expect(res.status).toBe(400);
      expect(res.body.errors.amount).toBeTruthy();
    });

    it('rejects invalid months and years', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set('Authorization', auth())
        .send({ categoryId: 5, amount: 1000, month: 13, year: 2026 });
      expect(res.status).toBe(400);
      expect(res.body.errors.month).toBeTruthy();
    });
  });

  describe('PUT /api/budgets/:id', () => {
    it('updates an owned budget', async () => {
      on('SELECT * FROM budgets WHERE', FOOD_BUDGET);
      on('SELECT id FROM budgets WHERE', []);
      on('WHERE b.id = ?', FOOD_BUDGET);

      const res = await request(app)
        .put('/api/budgets/4')
        .set('Authorization', auth())
        .send({ amount: 35000 });

      expect(res.status).toBe(200);
      const update = calls.find((c) => c.sql.startsWith('UPDATE budgets SET'));
      expect(update.params[update.params.length - 2]).toEqual(4); // id
      expect(update.params[update.params.length - 1]).toBe(1); // user scope
    });

    it('rejects updates to another user\'s budget', async () => {
      on('SELECT * FROM budgets WHERE', null);
      const res = await request(app)
        .put('/api/budgets/4')
        .set('Authorization', auth())
        .send({ amount: 35000 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/budgets/:id', () => {
    it('deletes an owned budget', async () => {
      on('SELECT id FROM budgets WHERE', { id: 4 });
      const res = await request(app).delete('/api/budgets/4').set('Authorization', auth());
      expect(res.status).toBe(200);
    });

    it('404s for another user\'s budget', async () => {
      on('SELECT id FROM budgets WHERE', null);
      const res = await request(app).delete('/api/budgets/4').set('Authorization', auth());
      expect(res.status).toBe(404);
    });
  });
});
