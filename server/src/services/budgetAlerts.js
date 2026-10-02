import { query, queryOne } from '../config/db.js';
import { notify } from './notifications.js';

/**
 * Budget alert evaluation.
 * Runs after every expense is created; notifies the user when a budget for
 * that period crosses one of their configured thresholds (default
 * 50 / 75 / 90 / 100) exactly once per budget+threshold+month.
 */

const DEFAULT_THRESHOLDS = [50, 75, 90, 100];

export async function getAlertThresholds(userId) {
  try {
    const row = await queryOne(
      "SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = 'budget_alert_thresholds'",
      [userId]
    );
    if (!row) return [...DEFAULT_THRESHOLDS];
    const list = String(row.setting_value)
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0 && n <= 100);
    return list.length > 0 ? [...new Set(list)].sort((a, b) => a - b) : [...DEFAULT_THRESHOLDS];
  } catch {
    return [...DEFAULT_THRESHOLDS];
  }
}

export async function setAlertThresholds(userId, thresholds) {
  const value = [...new Set(thresholds)].sort((a, b) => a - b).join(',');
  await query(
    `INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES (?, 'budget_alert_thresholds', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [userId, value]
  );
  return [...new Set(thresholds)].sort((a, b) => a - b);
}

function periodBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end };
}

/** Total expenses for a period, optionally scoped to one category. */
export async function computePeriodSpent(userId, categoryId, start, end) {
  const row = categoryId
    ? await queryOne(
        `SELECT COALESCE(SUM(amount), 0) AS spent FROM transactions
          WHERE user_id = ? AND type = 'expense' AND category_id = ? AND date BETWEEN ? AND ?`,
        [userId, categoryId, start, end]
      )
    : await queryOne(
        `SELECT COALESCE(SUM(amount), 0) AS spent FROM transactions
          WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?`,
        [userId, start, end]
      );
  return Number(row?.spent ?? 0);
}

/**
 * Evaluate budgets affected by a new expense and emit threshold alerts.
 * Errors are swallowed - alerting must never fail the transaction itself.
 */
export async function checkBudgetAlerts({ userId, categoryId, month, year }) {
  try {
    const budgets = await query(
      `SELECT b.*, c.name AS category_name
         FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
        WHERE b.user_id = ? AND b.month = ? AND b.year = ?
          AND (b.category_id = ? OR b.category_id IS NULL)`,
      [userId, month, year, categoryId]
    );
    if (budgets.length === 0) return;

    const thresholds = await getAlertThresholds(userId);
    const { start, end } = periodBounds(year, month);

    for (const budget of budgets) {
      const spent = await computePeriodSpent(userId, budget.category_id, start, end);
      const limit = Number(budget.amount);
      if (limit <= 0) continue;
      const pct = (spent / limit) * 100;

      const crossed = thresholds.filter((t) => pct >= t);
      if (crossed.length === 0) continue;

      const highest = Math.max(...crossed);
      const label = budget.category_name || 'Overall';
      const exceeded = highest >= 100;
      const type = exceeded ? 'budget_exceeded' : 'budget_warning';
      const period = `${year}-${String(month).padStart(2, '0')}`;
      const dedupeKey = `budget:${budget.id}:${highest}:${period}`;

      await notify(userId, {
        type,
        title: exceeded ? `Budget exceeded: ${label}` : `Budget alert: ${label} ${highest}% used`,
        message: exceeded
          ? `You have spent more than your ${label} budget for ${year}-${String(month).padStart(2, '0')}.`
          : `Your ${label} budget has reached ${highest}% of the limit.`,
        data: { budgetId: String(budget.id), threshold: highest, month, year, spent, limit },
        dedupeKey,
      });
    }
  } catch (error) {
     
    console.error('[budgetAlerts] failed:', error.message);
  }
}

/**
 * Simple anomaly check: an expense far above the user's own90-day average
 * for that category produces one unusual_spending notification per day.
 */
export async function checkUnusualSpending({ userId, categoryId, amount, date }) {
  try {
    const row = await queryOne(
      `SELECT COUNT(*) AS cnt, AVG(amount) AS avg_amount
         FROM transactions
        WHERE user_id = ? AND type = 'expense' AND category_id = ?
          AND date < ? AND date >= DATE_SUB(?, INTERVAL 90 DAY)`,
      [userId, categoryId, date, date]
    );
    if (!row || row.cnt < 5) return; // not enough history to judge
    const avg = Number(row.avg_amount);
    if (avg > 0 && amount >= Math.max(avg * 3, 1)) {
      const day = String(date).slice(0, 10);
      await notify(userId, {
        type: 'unusual_spending',
        title: 'Unusual spending detected',
        message: `A ${Number(amount).toFixed(2)} expense is well above your recent average for this category.`,
        data: { categoryId: String(categoryId), amount, average: Math.round(avg * 100) / 100 },
        dedupeKey: `unusual:${categoryId}:${day}`,
      });
    }
  } catch (error) {
     
    console.error('[unusualSpending] failed:', error.message);
  }
}
