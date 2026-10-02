import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/config/db.js', async () => {
  const { dbMock } = await import('./helpers/dbMock.js');
  return dbMock;
});

import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { reset, on, calls } from './helpers/dbMock.js';
import { processBills } from '../src/services/bills.js';

const app = createApp();

const USER = { id: 1, name: 'Test User', email: 'test@example.com', phone: null, avatar_url: null, role: 'user', status: 'active', currency: 'LKR', email_verified_at: null, created_at: '2026-01-01 00:00:00' };
const auth = () => `Bearer ${signAccessToken({ id: 1, role: 'user', name: 'Test User' })}`;

const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};

const BILL_ROW = {
  id: 20,
  user_id: 1,
  name: 'Electricity',
  amount: 4500,
  due_date: addDays(3),
  frequency: 'monthly',
  category_id: 5,
  payment_method_id: null,
  reminder_days_before: 3,
  status: 'upcoming',
  paid_at: null,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
  category_name: 'Utilities',
  category_color: '#06b6d4',
  payment_method_name: null,
};

describe('Bills API', () => {
  beforeEach(() => {
    reset();
    on('FROM users WHERE id = ?', USER);
    on('FROM bills WHERE id = ?', BILL_ROW); // ownership
    on('WHERE b.id = ?', BILL_ROW); // joined select
    on('INSERT INTO bills', { insertId: 21 });
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/bills')).status).toBe(401);
    expect((await request(app).post('/api/bills').send({})).status).toBe(401);
    expect((await request(app).post('/api/bills/20/pay')).status).toBe(401);
  });

  it('lists bills with upcoming / overdue / due-soon meta', async () => {
    on('FROM bills b', [
      BILL_ROW, // due in 3 days -> dueSoon
      { ...BILL_ROW, id: 21, name: 'Internet', due_date: addDays(-2), status: 'overdue' },
      { ...BILL_ROW, id: 22, name: 'Phone', due_date: addDays(-30), status: 'paid' },
    ]);
    const res = await request(app).get('/api/bills').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.meta.openCount).toBe(2);
    expect(res.body.meta.overdueCount).toBe(1);
    expect(res.body.meta.dueSoon).toBe(1);
    expect(res.body.meta.openTotal).toBe(9000);
    expect(res.body.data.bills[0].daysUntilDue).toBe(3);
  });

  it('creates a bill', async () => {
    const res = await request(app)
      .post('/api/bills')
      .set('Authorization', auth())
      .send({ name: 'Water', amount: 1200, dueDate: addDays(5), frequency: 'monthly', reminderDaysBefore: 2 });
    expect(res.status).toBe(201);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO bills'));
    expect(insert.params[0]).toBe(1);
    expect(insert.params[7]).toBe(2);
  });

  it('validates bill input', async () => {
    const noName = await request(app).post('/api/bills').set('Authorization', auth()).send({ name: '', amount: 10, dueDate: addDays(1) });
    expect(noName.status).toBe(400);

    const zero = await request(app).post('/api/bills').set('Authorization', auth()).send({ name: 'X', amount: 0, dueDate: addDays(1) });
    expect(zero.status).toBe(400);
    expect(zero.body.errors.amount).toBeTruthy();

    const badReminder = await request(app)
      .post('/api/bills')
      .set('Authorization', auth())
      .send({ name: 'X', amount: 10, dueDate: addDays(1), reminderDaysBefore: 99 });
    expect(badReminder.status).toBe(400);
  });

  it('marks a bill paid and rolls a recurring bill to the next cycle', async () => {
    on('WHERE b.id = ?', { ...BILL_ROW, status: 'paid', paid_at: '2026-10-01 00:00:00' });
    const res = await request(app).post('/api/bills/20/pay').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.bill.status).toBe('paid');
    expect(res.body.data.nextBill).toBeTruthy();

    // Next due date is in the future (old due date + 1 month)
    expect(res.body.data.nextBill.dueDate >= addDays(0)).toBe(true);

    const paidUpdate = calls.find((c) => c.sql.includes("SET status = 'paid'"));
    expect(paidUpdate.params.slice(-2)).toEqual([20, 1]);
    const rollover = calls.filter((c) => c.sql.includes('INSERT INTO bills'));
    expect(rollover.length).toBe(1);
  });

  it('rejects paying an already-paid bill', async () => {
    on('FROM bills WHERE id = ?', { ...BILL_ROW, status: 'paid' });
    const res = await request(app).post('/api/bills/20/pay').set('Authorization', auth());
    expect(res.status).toBe(409);
  });

  it("404s when paying another user's bill", async () => {
    on('FROM bills WHERE id = ?', null);
    const res = await request(app).post('/api/bills/20/pay').set('Authorization', auth());
    expect(res.status).toBe(404);
    const call = calls.find((c) => c.sql.includes('FROM bills WHERE id = ?'));
    expect(call.params).toEqual(['20', 1]);
  });

  it('deletes an owned bill', async () => {
    const res = await request(app).delete('/api/bills/20').set('Authorization', auth());
    expect(res.status).toBe(200);
    const del = calls.find((c) => c.sql.startsWith('DELETE FROM bills'));
    expect(del.params).toEqual([20, 1]);
  });

  it('processor marks overdue bills and emits deduplicated reminders', async () => {
    on('UPDATE bills SET status', { affectedRows: 1 });
    on("status IN ('upcoming', 'overdue')", [BILL_ROW]);
    const result = await processBills();
    expect(result.overdue).toBe(1);
    expect(result.reminded).toBe(1);

    const notif = calls.find((c) => c.sql.includes('INSERT INTO notifications'));
    expect(notif).toBeTruthy();
    expect(notif.params[5]).toBe(`bill:20:${ymd(new Date(BILL_ROW.due_date))}`);
  });
});
