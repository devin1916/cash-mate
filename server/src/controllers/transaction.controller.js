import { query, queryOne } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { notFound, badRequest } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';
import { assertCategory, assertPaymentMethod } from './category.controller.js';
import { checkBudgetAlerts, checkUnusualSpending } from '../services/budgetAlerts.js';

/**
 * Unified transaction ledger (income + expense).
 * EVERY statement is scoped by user_id taken from the verified JWT -
 * a user can never read or touch another user's rows, even by guessing ids.
 */

const mapTransaction = (row) => ({
  id: String(row.id),
  type: row.type,
  amount: Number(row.amount),
  categoryId: String(row.category_id),
  category: row.category_name || null,
  categoryColor: row.category_color || null,
  paymentMethodId: row.payment_method_id ? String(row.payment_method_id) : null,
  paymentMethod: row.payment_method_name || null,
  recurringId: row.recurring_id ? String(row.recurring_id) : null,
  description: row.description,
  notes: row.notes || null,
  date: typeof row.date === 'string' ? row.date.slice(0, 10) : row.date,
  status: row.status,
  receiptUrl: row.receipt_url || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const SELECT_WITH_JOINS = `
  SELECT t.*, c.name AS category_name, c.color AS category_color,
         pm.name AS payment_method_name
    FROM transactions t
    JOIN categories c            ON c.id = t.category_id
    LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id`;

const SORT_COLUMNS = {
  date: 't.date',
  amount: 't.amount',
  createdAt: 't.created_at',
  description: 't.description',
};

// GET /api/transactions
export async function listTransactions(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const where = ['t.user_id = ?'];
    const params = [req.user.id];

    const { search, type, categoryId, paymentMethodId, status, from, to, minAmount, maxAmount } = req.query;

    if (search) {
      where.push('(t.description LIKE ? OR c.name LIKE ?)');
      const like = `%${String(search).slice(0, 100)}%`;
      params.push(like, like);
    }
    if (type === 'income' || type === 'expense') {
      where.push('t.type = ?');
      params.push(type);
    }
    if (categoryId) {
      where.push('t.category_id = ?');
      params.push(parseInt(categoryId, 10));
    }
    if (paymentMethodId) {
      where.push('t.payment_method_id = ?');
      params.push(parseInt(paymentMethodId, 10));
    }
    if (status === 'completed' || status === 'pending') {
      where.push('t.status = ?');
      params.push(status);
    }
    if (from) {
      where.push('t.date >= ?');
      params.push(String(from));
    }
    if (to) {
      where.push('t.date <= ?');
      params.push(String(to));
    }
    if (minAmount !== undefined) {
      where.push('t.amount >= ?');
      params.push(minAmount);
    }
    if (maxAmount !== undefined) {
      where.push('t.amount <= ?');
      params.push(maxAmount);
    }

    const sortCol = SORT_COLUMNS[req.query.sort] || 't.date';
    const order = String(req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const whereSql = where.join(' AND ');

    const countRow = await queryOne(
      `SELECT COUNT(*) AS total FROM transactions t JOIN categories c ON c.id = t.category_id WHERE ${whereSql}`,
      params
    );
    const rows = await query(
      `${SELECT_WITH_JOINS} WHERE ${whereSql} ORDER BY ${sortCol} ${order}, t.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return sendSuccess(res, 'Transactions retrieved', { transactions: rows.map(mapTransaction) }, {
      meta: {
        page,
        limit,
        total: countRow.total,
        totalPages: Math.max(1, Math.ceil(countRow.total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/transactions/:id
export async function getTransaction(req, res, next) {
  try {
    const row = await queryOne(`${SELECT_WITH_JOINS} WHERE t.id = ? AND t.user_id = ?`, [
      req.params.id,
      req.user.id,
    ]);
    if (!row) throw notFound('Transaction not found');
    return sendSuccess(res, 'Transaction retrieved', { transaction: mapTransaction(row) });
  } catch (error) {
    return next(error);
  }
}

// POST /api/transactions
export async function createTransaction(req, res, next) {
  try {
    const { type, amount, categoryId, description, date, paymentMethodId, notes, status, receiptUrl } = req.body;

    await assertCategory(req.user.id, categoryId, type);
    if (paymentMethodId) await assertPaymentMethod(req.user.id, paymentMethodId);

    const result = await query(
      `INSERT INTO transactions
         (user_id, type, amount, category_id, payment_method_id, description, notes, date, status, receipt_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        type,
        amount,
        categoryId,
        paymentMethodId || null,
        description,
        notes || null,
        String(date).slice(0, 10),
        status || 'completed',
        receiptUrl || null,
      ]
    );

    const row = await queryOne(`${SELECT_WITH_JOINS} WHERE t.id = ? AND t.user_id = ?`, [
      result.insertId,
      req.user.id,
    ]);

    // Alerting side-effects (budget thresholds, unusual spending) never
    // fail the create itself - both helpers swallow their own errors.
    const [y, m] = String(date).slice(0, 10).split('-').map(Number);
    await checkBudgetAlerts({ userId: req.user.id, categoryId, month: m, year: y });
    if (type === 'expense') {
      await checkUnusualSpending({ userId: req.user.id, categoryId, amount, date: String(date).slice(0, 10) });
    }

    await logAudit({
      userId: req.user.id,
      action: 'transaction_create',
      entityType: 'transaction',
      entityId: result.insertId,
      req,
      details: { type, amount },
    });
    return sendSuccess(res, 'Transaction created', { transaction: mapTransaction(row) }, { status: 201 });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/transactions/:id
export async function updateTransaction(req, res, next) {
  try {
    const existing = await queryOne('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Transaction not found');

    const finalType = req.body.type ?? existing.type;
    const finalCategoryId = req.body.categoryId ?? existing.category_id;

    if (req.body.categoryId !== undefined || req.body.type !== undefined) {
      await assertCategory(req.user.id, finalCategoryId, finalType);
    }
    if (req.body.paymentMethodId !== undefined && req.body.paymentMethodId !== null) {
      await assertPaymentMethod(req.user.id, req.body.paymentMethodId);
    }

    const fields = {
      type: req.body.type,
      amount: req.body.amount,
      category_id: req.body.categoryId,
      payment_method_id: req.body.paymentMethodId,
      description: req.body.description,
      notes: req.body.notes,
      date: req.body.date ? String(req.body.date).slice(0, 10) : undefined,
      status: req.body.status,
      receipt_url: req.body.receiptUrl,
    };

    const updates = [];
    const params = [];
    for (const [col, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${col} = ?`);
        params.push(value === '' && col === 'notes' ? null : value);
      }
    }
    if (updates.length === 0) throw badRequest('No changes provided');

    params.push(existing.id, req.user.id);
    await query(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);

    const row = await queryOne(`${SELECT_WITH_JOINS} WHERE t.id = ? AND t.user_id = ?`, [
      existing.id,
      req.user.id,
    ]);
    await logAudit({
      userId: req.user.id,
      action: 'transaction_update',
      entityType: 'transaction',
      entityId: existing.id,
      req,
    });
    return sendSuccess(res, 'Transaction updated', { transaction: mapTransaction(row) });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/transactions/:id
export async function deleteTransaction(req, res, next) {
  try {
    const existing = await queryOne('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Transaction not found');

    await query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [existing.id, req.user.id]);
    await logAudit({
      userId: req.user.id,
      action: 'transaction_delete',
      entityType: 'transaction',
      entityId: existing.id,
      req,
    });
    return sendSuccess(res, 'Transaction deleted');
  } catch (error) {
    return next(error);
  }
}
