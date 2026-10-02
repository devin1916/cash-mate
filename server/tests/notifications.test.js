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

const NOTIF_ROW = {
  id: 30,
  user_id: 1,
  type: 'budget_warning',
  title: 'Budget alert: Food 50% used',
  message: 'Your Food budget has reached 50% of the limit.',
  data: '{"budgetId":"4","threshold":50}',
  is_read: 0,
  created_at: '2026-01-15 10:00:00',
};

describe('Notifications API', () => {
  beforeEach(() => {
    reset();
    on('FROM users WHERE id = ?', USER);
    on('COUNT(*) AS total FROM notifications', { total: 2 });
    on('COUNT(*) AS cnt FROM notifications', { cnt: 1 });
    on('SELECT * FROM notifications WHERE', [NOTIF_ROW]);
    on('UPDATE notifications SET is_read = 1 WHERE id', { affectedRows: 1 });
    on('DELETE FROM notifications WHERE id', { affectedRows: 1 });
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await request(app).patch('/api/notifications/read-all')).status).toBe(401);
    expect((await request(app).delete('/api/notifications')).status).toBe(401);
  });

  it('lists notifications with unread meta and parsed data payload', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ total: 2, unread: 1 });
    expect(res.body.data.notifications[0].isRead).toBe(false);
    expect(res.body.data.notifications[0].data.threshold).toBe(50);
    expect(res.body.data.notifications[0].type).toBe('budget_warning');
  });

  it('supports unreadOnly filtering', async () => {
    await request(app).get('/api/notifications?unreadOnly=true').set('Authorization', auth());
    const call = calls.find((c) => c.sql.includes('SELECT * FROM notifications'));
    expect(call.sql).toContain('is_read = 0');
    expect(call.params[0]).toBe(1);
  });

  it('returns the unread count for the bell badge', async () => {
    const res = await request(app).get('/api/notifications/unread-count').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
  });

  it('marks one notification read (scoped to the user)', async () => {
    const res = await request(app).patch('/api/notifications/30/read').set('Authorization', auth());
    expect(res.status).toBe(200);
    const call = calls.find((c) => c.sql.includes('UPDATE notifications SET is_read = 1 WHERE id'));
    expect(call.params).toEqual(['30', 1]);
  });

  it("404s when marking another user's notification", async () => {
    on('UPDATE notifications SET is_read = 1 WHERE id', { affectedRows: 0 });
    const res = await request(app).patch('/api/notifications/30/read').set('Authorization', auth());
    expect(res.status).toBe(404);
  });

  it('marks all read', async () => {
    const res = await request(app).patch('/api/notifications/read-all').set('Authorization', auth());
    expect(res.status).toBe(200);
    const call = calls.find((c) => c.sql.includes('is_read = 1 WHERE user_id = ?'));
    expect(call.params).toEqual([1]);
  });

  it('deletes one and clears all', async () => {
    const one = await request(app).delete('/api/notifications/30').set('Authorization', auth());
    expect(one.status).toBe(200);

    const all = await request(app).delete('/api/notifications').set('Authorization', auth());
    expect(all.status).toBe(200);
    const clear = calls.find((c) => c.sql === 'DELETE FROM notifications WHERE user_id = ?');
    expect(clear.params).toEqual([1]);
  });
});

describe('Settings API (budget alert thresholds)', () => {
  beforeEach(() => {
    reset();
    on('FROM users WHERE id = ?', USER);
  });

  it('returns default thresholds when none are configured', async () => {
    const res = await request(app).get('/api/settings').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.settings.budgetAlertThresholds).toEqual([50, 75, 90, 100]);
  });

  it('stores sorted unique thresholds', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', auth())
      .send({ budgetAlertThresholds: [100, 25, 50, 50] });
    expect(res.status).toBe(200);
    expect(res.body.data.settings.budgetAlertThresholds).toEqual([25, 50, 100]);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO user_settings'));
    expect(insert.params).toEqual([1, '25,50,100']);
    expect(insert.sql).toContain("'budget_alert_thresholds'");
  });

  it('rejects thresholds outside 1-100', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', auth())
      .send({ budgetAlertThresholds: [0, 500] });
    expect(res.status).toBe(400);
  });
});

describe('Budget alert generation on expense creation', () => {
  beforeEach(() => {
    reset();
    on('FROM users WHERE id = ?', USER);
    on('FROM categories WHERE id = ?', { id: 5, user_id: null, name: 'Food', type: 'expense', color: '#ef4444', icon: 'utensils', is_system: 1 });
    on('INSERT INTO transactions', { insertId: 77 });
    on('JOIN payment_methods pm', {
      id: 77,
      user_id: 1,
      type: 'expense',
      amount: 6000,
      category_id: 5,
      payment_method_id: null,
      recurring_id: null,
      description: 'Groceries',
      notes: null,
      date: '2026-01-15',
      status: 'completed',
      receipt_url: null,
      created_at: 'x',
      updated_at: 'x',
      category_name: 'Food',
      category_color: '#ef4444',
      payment_method_name: null,
    });
    // Budget for the period: limit 10000, user thresholds narrowed to [50]
    on('FROM budgets b', [{ id: 4, user_id: 1, category_id: 5, amount: 10000, month: 1, year: 2026, category_name: 'Food' }]);
    on('budget_alert_thresholds', { setting_value: '50' });
    on('AS spent FROM transactions', { spent: 6000 }); // overall (no category) - registered first
    on('category_id = ? AND date BETWEEN', { spent: 6000 }); // category-scoped - newest, wins
    on('AVG(amount)', { cnt: 10, avg_amount: 500 });
  });

  it('creates a deduplicated budget warning when a threshold is crossed', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', auth())
      .send({ type: 'expense', amount: 6000, categoryId: 5, description: 'Groceries', date: '2026-01-15' });
    expect(res.status).toBe(201);

    const notif = calls.find((c) => c.sql.includes('INSERT INTO notifications'));
    expect(notif).toBeTruthy();
    expect(notif.params[1]).toBe('budget_warning');
    expect(notif.params[5]).toBe('budget:4:50:2026-01'); // idempotent dedupe key
  });

  it('also evaluates unusual spending with its own dedupe key', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', auth())
      .send({ type: 'expense', amount: 6000, categoryId: 5, description: 'Big spend', date: '2026-01-15' });
    const notifs = calls.filter((c) => c.sql.includes('INSERT INTO notifications'));
    // 6000 >= max(500*3) -> unusual spending alongside the budget warning
    expect(notifs.some((n) => n.params[1] === 'unusual_spending')).toBe(true);
    expect(notifs.some((n) => String(n.params[5]).startsWith('unusual:5:2026-01-15'))).toBe(true);
  });
});
