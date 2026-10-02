import { query, queryOne } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { assertCategory } from './category.controller.js';

/**
 * Budgets: monthly limits, optionally scoped to one expense category.
 * `spent` is computed server-side for the requested period.
 */

const periodBounds = (year, month) => {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)); // last day of month
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
};

const mapBudget = (row, spent, income, expenses) => ({
  id: String(row.id),
  categoryId: row.category_id ? String(row.category_id) : null,
  category: row.category_name || null,
  categoryColor: row.category_color || null,
  amount: Number(row.amount),
  spent: Number(spent),
  remaining: Number(row.amount) - Number(spent),
  percentUsed: Number(row.amount) > 0 ? Math.round((Number(spent) / Number(row.amount)) * 1000) / 10 : 0,
  month: row.month,
  year: row.year,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  periodIncome: income !== undefined ? Number(income) : undefined,
  periodExpenses: expenses !== undefined ? Number(expenses) : undefined,
});

// GET /api/budgets?month=&year=
export async function listBudgets(req, res, next) {
  try {
    const now = new Date();
    const month = Math.min(12, Math.max(1, parseInt(req.query.month, 10) || now.getMonth() + 1));
    const year = Math.min(2100, Math.max(2000, parseInt(req.query.year, 10) || now.getFullYear()));
    const { start, end } = periodBounds(year, month);

    const rows = await query(
      `SELECT b.*, c.name AS category_name, c.color AS category_color
         FROM budgets b
         LEFT JOIN categories c ON c.id = b.category_id
        WHERE b.user_id = ? AND b.month = ? AND b.year = ?
        ORDER BY c.name IS NULL DESC, c.name`,
      [req.user.id, month, year]
    );

    // One pass over the month's expenses, grouped by category
    const expenseRows = await query(
      `SELECT COALESCE(category_id, 0) AS cat, COALESCE(SUM(amount), 0) AS total
         FROM transactions
        WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
        GROUP BY category_id`,
      [req.user.id, start, end]
    );
    const totalsRow = await queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expenses
       FROM transactions
      WHERE user_id = ? AND date BETWEEN ? AND ?`,
      [req.user.id, start, end]
    );

    const spentByCategory = {};
    let totalSpent = 0;
    for (const r of expenseRows) {
      spentByCategory[String(r.cat)] = Number(r.total);
      totalSpent += Number(r.total);
    }

    const budgets = rows.map((row) => {
      const spent = row.category_id ? (spentByCategory[String(row.category_id)] || 0) : totalSpent;
      return mapBudget(row, spent, totalsRow.income, totalsRow.expenses);
    });

    return sendSuccess(res, 'Budgets retrieved', { budgets }, {
      meta: { month, year, totalBudget: budgets.reduce((s, b) => s + b.amount, 0), totalSpent },
    });
  } catch (error) {
    return next(error);
  }
}

async function findDuplicate(userId, categoryId, month, year, excludeId = null) {
  const nullScope = categoryId === null || categoryId === undefined;
  const sql = `SELECT id FROM budgets WHERE user_id = ? AND month = ? AND year = ? AND ${
    nullScope ? 'category_id IS NULL' : 'category_id = ?'
  }`;
  const params = nullScope ? [userId, month, year] : [userId, month, year, categoryId];
  const rows = await query(sql, params);
  return rows.find((r) => String(r.id) !== String(excludeId)) || null;
}

// POST /api/budgets
export async function createBudget(req, res, next) {
  try {
    const { amount, month, year, categoryId } = req.body;
    const catId = categoryId ?? null;

    if (catId !== null) {
      const cat = await assertCategory(req.user.id, catId, 'expense');
      if (!cat) throw badRequest('Invalid category');
    }

    const dup = await findDuplicate(req.user.id, catId, month, year);
    if (dup) throw conflict('A budget for this category and period already exists');

    const result = await query(
      'INSERT INTO budgets (user_id, category_id, amount, month, year) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, catId, amount, month, year]
    );
    const row = await queryOne(
      `SELECT b.*, c.name AS category_name, c.color AS category_color
         FROM budgets b LEFT JOIN categories c ON c.id = b.category_id WHERE b.id = ?`,
      [result.insertId]
    );
    return sendSuccess(res, 'Budget created', { budget: mapBudget(row, 0) }, { status: 201 });
  } catch (error) {
    return next(error);
  }
}

// PUT /api/budgets/:id
export async function updateBudget(req, res, next) {
  try {
    const existing = await queryOne('SELECT * FROM budgets WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Budget not found');

    const amount = req.body.amount ?? existing.amount;
    const month = req.body.month ?? existing.month;
    const year = req.body.year ?? existing.year;
    const catId = req.body.categoryId !== undefined ? req.body.categoryId : existing.category_id;

    if (catId !== null && catId !== undefined) {
      await assertCategory(req.user.id, catId, 'expense');
    }

    const dup = await findDuplicate(req.user.id, catId ?? null, month, year, existing.id);
    if (dup) throw conflict('A budget for this category and period already exists');

    await query('UPDATE budgets SET amount = ?, month = ?, year = ?, category_id = ? WHERE id = ? AND user_id = ?', [
      amount,
      month,
      year,
      catId ?? null,
      existing.id,
      req.user.id,
    ]);
    const row = await queryOne(
      `SELECT b.*, c.name AS category_name, c.color AS category_color
         FROM budgets b LEFT JOIN categories c ON c.id = b.category_id WHERE b.id = ?`,
      [existing.id]
    );
    return sendSuccess(res, 'Budget updated', { budget: mapBudget(row, 0) });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/budgets/:id
export async function deleteBudget(req, res, next) {
  try {
    const existing = await queryOne('SELECT id FROM budgets WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Budget not found');
    await query('DELETE FROM budgets WHERE id = ? AND user_id = ?', [existing.id, req.user.id]);
    return sendSuccess(res, 'Budget deleted');
  } catch (error) {
    return next(error);
  }
}
