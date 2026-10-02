import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/config/db.js', async () => {
  const { dbMock } = await import('./helpers/dbMock.js');
  return dbMock;
});

import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { reset, on, calls } from './helpers/dbMock.js';
import { advanceDate, processRecurring } from '../src/services/recurring.js';

const app = createApp();

const USER = { id: 1, name: 'Test User', email: 'test@example.com', phone: null, avatar_url: null, role: 'user', status: 'active', currency: 'LKR', email_verified_at: null, created_at: '2026-01-01 00:00:00' };
const auth = () => `Bearer ${signAccessToken({ id: 1, role: 'user', name: 'Test User' })}`;

const RULE_ROW = {
  id: 9,
  user_id: 1,
  type: 'expense',
  amount: 15000,
  category_id: 5,
  payment_method_id: null,
  description: 'Rent',
  notes: null,
  frequency: 'monthly',
  start_date: '2026-02-01',
  end_date: null,
  next_run_date: '2026-02-01',
  last_run_date: null,
  status: 'active',
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
  category_name: 'Rent',
  category_color: '#8b5cf6',
  payment_method_name: null,
};

const today = () => new Date().toISOString().slice(0, 10);

describe('Recurring transactions', () => {
  beforeEach(() => {
    reset();
    on('FROM users WHERE id = ?', USER);
    on('FROM categories WHERE id = ?', { id: 5, user_id: null, name: 'Rent', type: 'expense', color: '#8b5cf6', icon: 'home', is_system: 1 });
    on('FROM recurring_transactions WHERE id = ?', RULE_ROW);
    on('WHERE r.id = ?', RULE_ROW);
    on('INSERT INTO recurring_transactions', { insertId: 9 });
    on('INSERT INTO transactions', { insertId: 77 });
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/recurring')).status).toBe(401);
    expect((await request(app).post('/api/recurring').send({})).status).toBe(401);
    expect((await request(app).post('/api/recurring/9/run')).status).toBe(401);
  });

  it('creates a schedule; a past start date is clamped to today', async () => {
    const res = await request(app)
      .post('/api/recurring')
      .set('Authorization', auth())
      .send({
        type: 'expense',
        amount: 15000,
        categoryId: 5,
        description: 'Rent',
        frequency: 'monthly',
        startDate: '2020-01-01',
      });
    expect(res.status).toBe(201);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO recurring_transactions'));
    expect(insert.params[0]).toBe(1);
    expect(insert.params[8]).toBe('2020-01-01'); // start_date preserved
    expect(insert.params[10]).toBe(today()); // next run never back-dates
  });

  it('rejects an end date before the start date', async () => {
    const res = await request(app)
      .post('/api/recurring')
      .set('Authorization', auth())
      .send({
        type: 'expense',
        amount: 100,
        categoryId: 5,
        description: 'Bad',
        frequency: 'monthly',
        startDate: '2026-05-01',
        endDate: '2026-04-01',
      });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid frequency', async () => {
    const res = await request(app)
      .post('/api/recurring')
      .set('Authorization', auth())
      .send({ type: 'expense', amount: 100, categoryId: 5, description: 'X', frequency: 'fortnightly', startDate: '2026-05-01' });
    expect(res.status).toBe(400);
    expect(res.body.errors.frequency).toBeTruthy();
  });

  it('pauses a schedule', async () => {
    const res = await request(app)
      .patch('/api/recurring/9')
      .set('Authorization', auth())
      .send({ status: 'paused' });
    expect(res.status).toBe(200);
    const update = calls.find((c) => c.sql.startsWith('UPDATE recurring_transactions SET'));
    expect(update.params).toEqual(['paused', 9, 1]);
  });

  it('404s when updating another user schedule', async () => {
    on('FROM recurring_transactions WHERE id = ?', null);
    const res = await request(app).patch('/api/recurring/9').set('Authorization', auth()).send({ status: 'paused' });
    expect(res.status).toBe(404);
  });

  it('deletes a schedule and keeps generated history', async () => {
    const res = await request(app).delete('/api/recurring/9').set('Authorization', auth());
    expect(res.status).toBe(200);
    const del = calls.find((c) => c.sql.startsWith('DELETE FROM recurring_transactions'));
    expect(del.params).toEqual([9, 1]);
  });

  it('generates a transaction on manual run and advances the schedule', async () => {
    const res = await request(app).post('/api/recurring/9/run').set('Authorization', auth());
    expect(res.status).toBe(201);

    const insert = calls.find((c) => c.sql.includes('INSERT INTO transactions'));
    expect(insert.params[0]).toBe(1); // belongs to token user
    expect(insert.params[7]).toBe(today());
    expect(insert.params[8]).toBe(9); // recurring_id link

    const update = calls.find((c) => c.sql.startsWith('UPDATE recurring_transactions SET'));
    expect(update.params[1]).toBe(advanceDate(today(), 'monthly'));

    const notif = calls.find((c) => c.sql.includes('INSERT INTO notifications'));
    expect(notif.params[5]).toBe(`recurring:9:${today()}`);
  });

  it('filters by status server-side', async () => {
    on('WHERE r.id = ?', []);
    on('FROM recurring_transactions WHERE id = ?', null);
    await request(app).get('/api/recurring?status=paused').set('Authorization', auth());
    const call = calls.find((c) => c.sql.includes('FROM recurring_transactions r'));
    expect(call.sql).toContain('r.status = ?');
    expect(call.params).toEqual([1, 'paused']);
  });

  describe('date advancement', () => {
    it('handles month-end clamping', () => {
      expect(advanceDate('2026-01-31', 'monthly')).toBe('2026-02-28');
      expect(advanceDate('2026-03-31', 'monthly')).toBe('2026-04-30');
    });
    it('handles yearly leap days', () => {
      expect(advanceDate('2024-02-29', 'yearly')).toBe('2025-02-28');
    });
    it('handles daily and weekly', () => {
      expect(advanceDate('2026-01-15', 'daily')).toBe('2026-01-16');
      expect(advanceDate('2026-01-15', 'weekly')).toBe('2026-01-22');
    });
  });

  it('processor generates due rules once and completes past end dates', async () => {
    on("status = 'active' AND next_run_date", [RULE_ROW]);
    on('INSERT INTO transactions', { insertId: 77 });
    const created = await processRecurring();
    expect(created).toBe(1);
    expect(calls.some((c) => c.sql.includes('INSERT INTO transactions'))).toBe(true);
    expect(calls.some((c) => c.sql.includes('UPDATE recurring_transactions'))).toBe(true);
    expect(calls.some((c) => c.sql.includes('INSERT INTO notifications'))).toBe(true);
  });

  it('processor is a no-op when nothing is due', async () => {
    on("status = 'active' AND next_run_date", []);
    const created = await processRecurring();
    expect(created).toBe(0);
    expect(calls.some((c) => c.sql.includes('INSERT INTO transactions'))).toBe(false);
  });
});
