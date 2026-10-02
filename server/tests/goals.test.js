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

const GOAL_ROW = {
  id: 10,
  user_id: 1,
  name: 'New Laptop',
  target_amount: 100000,
  current_amount: 25000,
  target_date: '2026-12-31',
  description: 'Work laptop',
  status: 'active',
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
};

describe('Savings goals API', () => {
  beforeEach(() => {
    reset();
    on('FROM users WHERE id = ?', USER);
    on('FROM savings_goals WHERE user_id = ?', [GOAL_ROW]); // list
    on('FROM savings_goals WHERE id = ?', GOAL_ROW); // ownership (newest wins over list rule only for id queries)
    on('INSERT INTO savings_goals', { insertId: 10 });
    on('INSERT INTO goal_contributions', { insertId: 1 });
    on('FROM goal_contributions WHERE id = ?', {
      id: 1,
      goal_id: 10,
      user_id: 1,
      amount: 5000,
      contribution_date: '2026-01-10',
      note: null,
      created_at: '2026-01-10 00:00:00',
    });
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/goals')).status).toBe(401);
    expect((await request(app).post('/api/goals').send({})).status).toBe(401);
    expect((await request(app).delete('/api/goals/10')).status).toBe(401);
  });

  it('lists goals with computed progress and required monthly saving', async () => {
    const res = await request(app).get('/api/goals').set('Authorization', auth());
    expect(res.status).toBe(200);
    const goal = res.body.data.goals[0];
    expect(goal.targetAmount).toBe(100000);
    expect(goal.currentAmount).toBe(25000);
    expect(goal.percentUsed).toBe(25);
    expect(goal.remaining).toBe(75000);
    expect(goal.requiredMonthly).toBeGreaterThan(0);
    expect(goal.daysLeft).toBeGreaterThanOrEqual(0);
  });

  it('creates a goal', async () => {
    on('FROM savings_goals WHERE id = ?', GOAL_ROW);
    const res = await request(app)
      .post('/api/goals')
      .set('Authorization', auth())
      .send({ name: 'Vacation', targetAmount: 500000, targetDate: '2026-12-31' });
    expect(res.status).toBe(201);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO savings_goals'));
    expect(insert.params[0]).toBe(1); // user scoping
  });

  it('rejects invalid goals (zero target, empty name, bad date)', async () => {
    const zero = await request(app).post('/api/goals').set('Authorization', auth()).send({ name: 'X', targetAmount: 0 });
    expect(zero.status).toBe(400);
    expect(zero.body.errors.targetAmount).toBeTruthy();

    const noName = await request(app).post('/api/goals').set('Authorization', auth()).send({ name: '', targetAmount: 100 });
    expect(noName.status).toBe(400);

    const badDate = await request(app)
      .post('/api/goals')
      .set('Authorization', auth())
      .send({ name: 'X', targetAmount: 100, targetDate: '2026-02-30' });
    expect(badDate.status).toBe(400);
  });

  it("404s on another user's goal (isolation)", async () => {
    on('FROM savings_goals WHERE id = ?', null);
    const res = await request(app).get('/api/goals/10').set('Authorization', auth());
    expect(res.status).toBe(404);
    const call = calls.find((c) => c.sql.includes('FROM savings_goals WHERE id = ?'));
    expect(call.params).toEqual(['10', 1]);
  });

  it('updates an owned goal', async () => {
    const res = await request(app)
      .patch('/api/goals/10')
      .set('Authorization', auth())
      .send({ name: 'New Laptop Pro' });
    expect(res.status).toBe(200);
    const update = calls.find((c) => c.sql.startsWith('UPDATE savings_goals SET'));
    expect(update.params.slice(-2)).toEqual([10, 1]);
  });

  it('deletes an owned goal', async () => {
    const res = await request(app).delete('/api/goals/10').set('Authorization', auth());
    expect(res.status).toBe(200);
    const del = calls.find((c) => c.sql.startsWith('DELETE FROM savings_goals'));
    expect(del.params).toEqual([10, 1]);
  });

  it('adds a contribution and returns updated progress', async () => {
    on('FROM savings_goals WHERE id = ?', { ...GOAL_ROW, current_amount: 95000 });
    const res = await request(app)
      .post('/api/goals/10/contributions')
      .set('Authorization', auth())
      .send({ amount: 5000, date: '2026-01-15' });
    expect(res.status).toBe(201);
    expect(res.body.data.goal.currentAmount).toBe(95000);

    const contrib = calls.find((c) => c.sql.includes('INSERT INTO goal_contributions'));
    expect(contrib.params[1]).toBe(1); // user id stored on contribution
    const bump = calls.find((c) => c.sql.includes('current_amount = current_amount'));
    expect(bump.params.slice(-2)).toEqual([10, 1]);
  });

  it('emits a milestone notification exactly once when a goal completes', async () => {
    // Simulate the real DB: pre-fetch sees 95%, post-update sees 100%
    let fetchCount = 0;
    on('FROM savings_goals WHERE id = ?', () => {
      fetchCount += 1;
      return {
        ...GOAL_ROW,
        current_amount: fetchCount === 1 ? 95000 : 100000,
      };
    });
    await request(app)
      .post('/api/goals/10/contributions')
      .set('Authorization', auth())
      .send({ amount: 5000 });
    const notif = calls.find((c) => c.sql.includes('INSERT INTO notifications'));
    expect(notif).toBeTruthy();
    expect(notif.params[5]).toBe('goal:10:100'); // dedupe key
  });

  it('rejects zero contributions', async () => {
    const res = await request(app)
      .post('/api/goals/10/contributions')
      .set('Authorization', auth())
      .send({ amount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.errors.amount).toBeTruthy();
  });

  it('cannot contribute to another user goal', async () => {
    on('FROM savings_goals WHERE id = ?', null);
    const res = await request(app)
      .post('/api/goals/10/contributions')
      .set('Authorization', auth())
      .send({ amount: 100 });
    expect(res.status).toBe(404);
  });

  it('lists contributions for an owned goal', async () => {
    on('FROM goal_contributions WHERE goal_id', [
      { id: 1, amount: 5000, contribution_date: '2026-01-10', note: 'bonus', created_at: 'x' },
    ]);
    const res = await request(app).get('/api/goals/10/contributions').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.contributions[0].amount).toBe(5000);
  });

  it('removes a contribution and decrements the goal', async () => {
    const res = await request(app)
      .delete('/api/goals/10/contributions/1')
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    const dec = calls.find((c) => c.sql.includes('GREATEST(0, current_amount - ?)'));
    expect(dec.params).toEqual([5000, 10, 1]);
  });
});
