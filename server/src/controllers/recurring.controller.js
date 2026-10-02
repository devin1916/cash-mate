import { query, queryOne } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { notFound, badRequest } from '../utils/errors.js';
import { assertCategory, assertPaymentMethod } from './category.controller.js';
import { advanceDate } from '../services/recurring.js';
import { notify } from '../services/notifications.js';

/** Recurring income/expense schedules with automatic generation. */

const SELECT_JOINED = `
  SELECT r.*, c.name AS category_name, c.color AS category_color, pm.name AS payment_method_name
    FROM recurring_transactions r
    JOIN categories c            ON c.id = r.category_id
    LEFT JOIN payment_methods pm ON pm.id = r.payment_method_id`;

const mapRule = (row) => ({
  id: String(row.id),
  type: row.type,
  amount: Number(row.amount),
  categoryId: String(row.category_id),
  category: row.category_name || null,
  categoryColor: row.category_color || null,
  paymentMethodId: row.payment_method_id ? String(row.payment_method_id) : null,
  paymentMethod: row.payment_method_name || null,
  description: row.description,
  notes: row.notes || null,
  frequency: row.frequency,
  startDate: String(row.start_date).slice(0, 10),
  endDate: row.end_date ? String(row.end_date).slice(0, 10) : null,
  nextRunDate: String(row.next_run_date).slice(0, 10),
  lastRunDate: row.last_run_date ? String(row.last_run_date).slice(0, 10) : null,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const today = () => new Date().toISOString().slice(0, 10);

// GET /api/recurring
export async function listRecurring(req, res, next) {
  try {
    const where = ['r.user_id = ?'];
    const params = [req.user.id];
    if (['active', 'paused', 'completed'].includes(req.query.status)) {
      where.push('r.status = ?');
      params.push(req.query.status);
    }
    const rows = await query(`${SELECT_JOINED} WHERE ${where.join(' AND ')} ORDER BY r.status, r.next_run_date`, params);
    return sendSuccess(res, 'Recurring transactions retrieved', { recurring: rows.map(mapRule) });
  } catch (error) {
    return next(error);
  }
}

// POST /api/recurring
export async function createRecurring(req, res, next) {
  try {
    const { type, amount, categoryId, paymentMethodId, description, notes, frequency, startDate, endDate } = req.body;
    await assertCategory(req.user.id, categoryId, type);
    if (paymentMethodId) await assertPaymentMethod(req.user.id, paymentMethodId);

    // First run never back-dates: a past start date runs from today.
    const nextRun = startDate < today() ? today() : startDate;

    const result = await query(
      `INSERT INTO recurring_transactions
         (user_id, type, amount, category_id, payment_method_id, description, notes, frequency, start_date, end_date, next_run_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        type,
        amount,
        categoryId,
        paymentMethodId || null,
        description,
        notes || null,
        frequency,
        startDate,
        endDate || null,
        nextRun,
      ]
    );
    const row = await queryOne(`${SELECT_JOINED} WHERE r.id = ? AND r.user_id = ?`, [result.insertId, req.user.id]);
    return sendSuccess(res, 'Recurring transaction created', { recurring: mapRule(row) }, { status: 201 });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/recurring/:id
export async function updateRecurring(req, res, next) {
  try {
    const existing = await queryOne('SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Recurring transaction not found');

    const finalType = req.body.type ?? existing.type;
    if (req.body.categoryId !== undefined) await assertCategory(req.user.id, req.body.categoryId, finalType);
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
      frequency: req.body.frequency,
      start_date: req.body.startDate,
      end_date: req.body.endDate,
      status: req.body.status,
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

    // Reschedule when start date changed (only while active)
    if (req.body.startDate !== undefined && existing.status === 'active') {
      updates.push('next_run_date = ?');
      params.push(req.body.startDate < today() ? today() : req.body.startDate);
    }

    params.push(existing.id, req.user.id);
    await query(`UPDATE recurring_transactions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);

    const row = await queryOne(`${SELECT_JOINED} WHERE r.id = ? AND r.user_id = ?`, [existing.id, req.user.id]);
    return sendSuccess(res, 'Recurring transaction updated', { recurring: mapRule(row) });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/recurring/:id
export async function deleteRecurring(req, res, next) {
  try {
    const existing = await queryOne('SELECT id FROM recurring_transactions WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Recurring transaction not found');
    // Generated transactions keep their history (recurring_id becomes NULL)
    await query('DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?', [existing.id, req.user.id]);
    return sendSuccess(res, 'Recurring transaction deleted');
  } catch (error) {
    return next(error);
  }
}

// POST /api/recurring/:id/run  - generate the next transaction immediately
export async function runRecurringNow(req, res, next) {
  try {
    const rule = await queryOne('SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!rule) throw notFound('Recurring transaction not found');
    if (rule.status === 'completed') throw badRequest('This schedule has already completed');

    const runDate = today();
    const inserted = await query(
      `INSERT INTO transactions
         (user_id, type, amount, category_id, payment_method_id, description, notes, date, status, recurring_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [
        rule.user_id,
        rule.type,
        rule.amount,
        rule.category_id,
        rule.payment_method_id,
        rule.description,
        rule.notes,
        runDate,
        rule.id,
      ]
    );

    const next = advanceDate(rule.next_run_date > runDate ? rule.next_run_date : runDate, rule.frequency);
    const finished = rule.end_date && next > String(rule.end_date).slice(0, 10);
    await query('UPDATE recurring_transactions SET last_run_date = ?, next_run_date = ?, status = ? WHERE id = ? AND user_id = ?', [
      runDate,
      next,
      finished ? 'completed' : rule.status,
      rule.id,
      req.user.id,
    ]);

    await notify(req.user.id, {
      type: 'recurring_created',
      title: `${rule.type === 'income' ? 'Income' : 'Expense'} generated`,
      message: `"${rule.description}" was generated from your recurring schedule.`,
      data: { recurringId: String(rule.id), date: runDate },
      dedupeKey: `recurring:${rule.id}:${runDate}`,
    });

    const row = await queryOne(`${SELECT_JOINED} WHERE r.id = ? AND r.user_id = ?`, [rule.id, req.user.id]);
    return sendSuccess(
      res,
      'Transaction generated from schedule',
      { recurring: mapRule(row), transactionId: String(inserted.insertId) },
      { status: 201 }
    );
  } catch (error) {
    return next(error);
  }
}
