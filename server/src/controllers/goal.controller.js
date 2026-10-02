import { query, queryOne, withTransaction } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { notFound, badRequest } from '../utils/errors.js';
import { notify } from '../services/notifications.js';

/**
 * Savings goals with contributions.
 * Progress, remaining amount and required monthly saving are computed
 * server-side; milestone notifications (50/75/90/100%) are deduplicated.
 */

const MILESTONES = [50, 75, 90, 100];

function monthsBetween(from, to) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

function mapGoal(row) {
  const target = Number(row.target_amount);
  const current = Number(row.current_amount);
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0;
  const remaining = Math.max(0, target - current);

  let requiredMonthly = null;
  let daysLeft = null;
  if (row.target_date) {
    const today = new Date();
    const targetDate = new Date(`${String(row.target_date).slice(0, 10)}T00:00:00`);
    daysLeft = Math.max(0, Math.ceil((targetDate - today) / 86400000));
    const months = Math.max(1, monthsBetween(today, targetDate));
    requiredMonthly = remaining > 0 ? Math.round((remaining / months) * 100) / 100 : 0;
  }

  return {
    id: String(row.id),
    name: row.name,
    targetAmount: target,
    currentAmount: current,
    targetDate: row.target_date ? String(row.target_date).slice(0, 10) : null,
    description: row.description || null,
    status: row.status,
    percentUsed: percent,
    remaining,
    requiredMonthly,
    daysLeft,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/goals
export async function listGoals(req, res, next) {
  try {
    const rows = await query(
      `SELECT * FROM savings_goals WHERE user_id = ?
        ORDER BY FIELD(status, 'active', 'completed', 'archived'), created_at DESC`,
      [req.user.id]
    );
    return sendSuccess(res, 'Savings goals retrieved', { goals: rows.map(mapGoal) });
  } catch (error) {
    return next(error);
  }
}

// POST /api/goals
export async function createGoal(req, res, next) {
  try {
    const { name, targetAmount, targetDate, description } = req.body;
    const result = await query(
      'INSERT INTO savings_goals (user_id, name, target_amount, target_date, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, name, targetAmount, targetDate || null, description || null]
    );
    const row = await queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [
      result.insertId,
      req.user.id,
    ]);
    return sendSuccess(res, 'Savings goal created', { goal: mapGoal(row) }, { status: 201 });
  } catch (error) {
    return next(error);
  }
}

// GET /api/goals/:id
export async function getGoal(req, res, next) {
  try {
    const row = await queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!row) throw notFound('Savings goal not found');
    return sendSuccess(res, 'Savings goal retrieved', { goal: mapGoal(row) });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/goals/:id
export async function updateGoal(req, res, next) {
  try {
    const existing = await queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Savings goal not found');

    const fields = {
      name: req.body.name,
      target_amount: req.body.targetAmount,
      target_date: req.body.targetDate,
      description: req.body.description,
      status: req.body.status,
    };
    const updates = [];
    const params = [];
    for (const [col, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${col} = ?`);
        params.push(value === '' ? null : value);
      }
    }
    if (updates.length === 0) throw badRequest('No changes provided');

    params.push(existing.id, req.user.id);
    await query(`UPDATE savings_goals SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);

    const row = await queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [
      existing.id,
      req.user.id,
    ]);
    return sendSuccess(res, 'Savings goal updated', { goal: mapGoal(row) });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/goals/:id
export async function deleteGoal(req, res, next) {
  try {
    const existing = await queryOne('SELECT id FROM savings_goals WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Savings goal not found');
    await query('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [existing.id, req.user.id]);
    return sendSuccess(res, 'Savings goal deleted');
  } catch (error) {
    return next(error);
  }
}

// POST /api/goals/:id/contributions
export async function addContribution(req, res, next) {
  try {
    const { amount, date, note } = req.body;
    const goal = await queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!goal) throw notFound('Savings goal not found');

    await withTransaction(async (conn) => {
      await conn.query(
        'INSERT INTO goal_contributions (goal_id, user_id, amount, contribution_date, note) VALUES (?, ?, ?, ?, ?)',
        [goal.id, req.user.id, amount, date || new Date().toISOString().slice(0, 10), note || null]
      );
      await conn.query('UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?', [
        amount,
        goal.id,
        req.user.id,
      ]);
    });

    const row = await queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [
      goal.id,
      req.user.id,
    ]);
    const mapped = mapGoal(row);

    // Milestone notifications
    const before = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
    for (const milestone of MILESTONES) {
      if (before < milestone && mapped.percentUsed >= milestone) {
        await notify(req.user.id, {
          type: 'goal_progress',
          title:
            milestone >= 100
              ? `Goal completed: ${goal.name}`
              : `Goal milestone: ${goal.name} ${milestone}% saved`,
          message:
            milestone >= 100
              ? `Congratulations - you reached your ${goal.name} target!`
              : `You have saved ${mapped.percentUsed}% of your ${goal.name} goal.`,
          data: { goalId: String(goal.id), milestone },
          dedupeKey: `goal:${goal.id}:${milestone}`,
        });
      }
    }

    return sendSuccess(res, 'Contribution added', { goal: mapped }, { status: 201 });
  } catch (error) {
    return next(error);
  }
}

// GET /api/goals/:id/contributions
export async function listContributions(req, res, next) {
  try {
    const goal = await queryOne('SELECT id FROM savings_goals WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!goal) throw notFound('Savings goal not found');
    const rows = await query(
      'SELECT * FROM goal_contributions WHERE goal_id = ? AND user_id = ? ORDER BY contribution_date DESC, id DESC',
      [goal.id, req.user.id]
    );
    return sendSuccess(res, 'Contributions retrieved', {
      contributions: rows.map((r) => ({
        id: String(r.id),
        amount: Number(r.amount),
        date: String(r.contribution_date).slice(0, 10),
        note: r.note || null,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/goals/:id/contributions/:cid
export async function deleteContribution(req, res, next) {
  try {
    const goal = await queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!goal) throw notFound('Savings goal not found');

    const contribution = await queryOne(
      'SELECT * FROM goal_contributions WHERE id = ? AND goal_id = ? AND user_id = ?',
      [req.params.cid, goal.id, req.user.id]
    );
    if (!contribution) throw notFound('Contribution not found');

    await withTransaction(async (conn) => {
      await conn.query('DELETE FROM goal_contributions WHERE id = ? AND user_id = ?', [
        contribution.id,
        req.user.id,
      ]);
      await conn.query(
        'UPDATE savings_goals SET current_amount = GREATEST(0, current_amount - ?) WHERE id = ? AND user_id = ?',
        [contribution.amount, goal.id, req.user.id]
      );
    });

    const row = await queryOne('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [
      goal.id,
      req.user.id,
    ]);
    return sendSuccess(res, 'Contribution removed', { goal: mapGoal(row) });
  } catch (error) {
    return next(error);
  }
}
