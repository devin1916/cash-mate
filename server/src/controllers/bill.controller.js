import { query, queryOne, withTransaction } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { notFound, conflict, badRequest } from '../utils/errors.js';
import { assertCategory, assertPaymentMethod } from './category.controller.js';
import { advanceDate } from '../services/bills.js';

/** Bills & payment reminders with mark-paid and recurring rollover. */

const SELECT_JOINED = `
  SELECT b.*, c.name AS category_name, c.color AS category_color, pm.name AS payment_method_name
    FROM bills b
    LEFT JOIN categories c       ON c.id = b.category_id
    LEFT JOIN payment_methods pm ON pm.id = b.payment_method_id`;

const mapBill = (row) => {
  const due = String(row.due_date).slice(0, 10);
  const daysUntilDue = Math.ceil(
    (new Date(`${due}T00:00:00Z`) - new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86400000
  );
  return {
    id: String(row.id),
    name: row.name,
    amount: Number(row.amount),
    dueDate: due,
    daysUntilDue,
    frequency: row.frequency,
    categoryId: row.category_id ? String(row.category_id) : null,
    category: row.category_name || null,
    categoryColor: row.category_color || null,
    paymentMethodId: row.payment_method_id ? String(row.payment_method_id) : null,
    paymentMethod: row.payment_method_name || null,
    reminderDaysBefore: row.reminder_days_before,
    status: row.status,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// GET /api/bills?status=&search=&from=&to=
export async function listBills(req, res, next) {
  try {
    const where = ['b.user_id = ?'];
    const params = [req.user.id];

    if (['upcoming', 'paid', 'overdue'].includes(req.query.status)) {
      where.push('b.status = ?');
      params.push(req.query.status);
    }
    if (req.query.search) {
      where.push('b.name LIKE ?');
      params.push(`%${String(req.query.search).slice(0, 100)}%`);
    }
    if (req.query.from) {
      where.push('b.due_date >= ?');
      params.push(String(req.query.from));
    }
    if (req.query.to) {
      where.push('b.due_date <= ?');
      params.push(String(req.query.to));
    }

    const rows = await query(
      `${SELECT_JOINED} WHERE ${where.join(' AND ')} ORDER BY b.due_date ASC`,
      params
    );

    const bills = rows.map(mapBill);
    const open = bills.filter((b) => b.status !== 'paid');
    return sendSuccess(res, 'Bills retrieved', { bills }, {
      meta: {
        openCount: open.length,
        overdueCount: open.filter((b) => b.status === 'overdue').length,
        dueSoon: open.filter((b) => b.daysUntilDue >= 0 && b.daysUntilDue <= 7).length,
        openTotal: Math.round(open.reduce((s, b) => s + b.amount, 0) * 100) / 100,
      },
    });
  } catch (error) {
    return next(error);
  }
}

// POST /api/bills
export async function createBill(req, res, next) {
  try {
    const { name, amount, dueDate, frequency, categoryId, paymentMethodId, reminderDaysBefore } = req.body;
    if (categoryId) await assertCategory(req.user.id, categoryId, 'expense');
    if (paymentMethodId) await assertPaymentMethod(req.user.id, paymentMethodId);

    const result = await query(
      `INSERT INTO bills
         (user_id, name, amount, due_date, frequency, category_id, payment_method_id, reminder_days_before)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        name,
        amount,
        dueDate,
        frequency || 'monthly',
        categoryId || null,
        paymentMethodId || null,
        reminderDaysBefore ?? 3,
      ]
    );
    const row = await queryOne(`${SELECT_JOINED} WHERE b.id = ? AND b.user_id = ?`, [
      result.insertId,
      req.user.id,
    ]);
    return sendSuccess(res, 'Bill created', { bill: mapBill(row) }, { status: 201 });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/bills/:id
export async function updateBill(req, res, next) {
  try {
    const existing = await queryOne('SELECT * FROM bills WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Bill not found');

    if (req.body.categoryId) await assertCategory(req.user.id, req.body.categoryId, 'expense');
    if (req.body.paymentMethodId) await assertPaymentMethod(req.user.id, req.body.paymentMethodId);

    const fields = {
      name: req.body.name,
      amount: req.body.amount,
      due_date: req.body.dueDate,
      frequency: req.body.frequency,
      category_id: req.body.categoryId,
      payment_method_id: req.body.paymentMethodId,
      reminder_days_before: req.body.reminderDaysBefore,
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
    await query(`UPDATE bills SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);

    const row = await queryOne(`${SELECT_JOINED} WHERE b.id = ? AND b.user_id = ?`, [existing.id, req.user.id]);
    return sendSuccess(res, 'Bill updated', { bill: mapBill(row) });
  } catch (error) {
    return next(error);
  }
}

// POST /api/bills/:id/pay  - mark paid; recurring bills roll to the next cycle
export async function payBill(req, res, next) {
  try {
    const existing = await queryOne('SELECT * FROM bills WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Bill not found');
    if (existing.status === 'paid') throw conflict('This bill is already marked as paid');

    let nextBill = null;
    await withTransaction(async (conn) => {
      await conn.query('UPDATE bills SET status = \'paid\', paid_at = NOW() WHERE id = ? AND user_id = ?', [
        existing.id,
        req.user.id,
      ]);
      if (existing.frequency && existing.frequency !== 'none') {
        const nextDue = advanceDate(existing.due_date, existing.frequency);
        const [inserted] = await conn.query(
          `INSERT INTO bills
             (user_id, name, amount, due_date, frequency, category_id, payment_method_id, reminder_days_before)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            existing.user_id,
            existing.name,
            existing.amount,
            nextDue,
            existing.frequency,
            existing.category_id,
            existing.payment_method_id,
            existing.reminder_days_before,
          ]
        );
        nextBill = { dueDate: nextDue, id: inserted.insertId };
      }
    });

    const row = await queryOne(`${SELECT_JOINED} WHERE b.id = ? AND b.user_id = ?`, [existing.id, req.user.id]);
    return sendSuccess(res, 'Bill marked as paid', { bill: mapBill(row), nextBill });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/bills/:id
export async function deleteBill(req, res, next) {
  try {
    const existing = await queryOne('SELECT id FROM bills WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Bill not found');
    await query('DELETE FROM bills WHERE id = ? AND user_id = ?', [existing.id, req.user.id]);
    return sendSuccess(res, 'Bill deleted');
  } catch (error) {
    return next(error);
  }
}
