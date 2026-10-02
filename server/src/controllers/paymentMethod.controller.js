import { query, queryOne } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { conflict, notFound, forbidden } from '../utils/errors.js';

/** Payment methods: built-in defaults + per-user custom methods. */

const mapMethod = (row) => ({
  id: String(row.id),
  name: row.name,
  color: row.color,
  icon: row.icon,
  isSystem: Boolean(row.is_system),
});

// GET /api/payment-methods
export async function listPaymentMethods(req, res, next) {
  try {
    const rows = await query(
      `SELECT id, name, color, icon, is_system
         FROM payment_methods
        WHERE user_id IS NULL OR user_id = ?
        ORDER BY is_system DESC, name`,
      [req.user.id]
    );
    return sendSuccess(res, 'Payment methods retrieved', { paymentMethods: rows.map(mapMethod) });
  } catch (error) {
    return next(error);
  }
}

// POST /api/payment-methods
export async function createPaymentMethod(req, res, next) {
  try {
    const { name, color = '#3b82f6', icon = 'credit-card' } = req.body;
    const dup = await queryOne('SELECT id FROM payment_methods WHERE user_id = ? AND name = ? LIMIT 1', [
      req.user.id,
      name,
    ]);
    if (dup) throw conflict('You already have a payment method with this name');

    const result = await query(
      'INSERT INTO payment_methods (user_id, name, color, icon, is_system) VALUES (?, ?, ?, ?, 0)',
      [req.user.id, name, color, icon]
    );
    const row = await queryOne('SELECT id, name, color, icon, is_system FROM payment_methods WHERE id = ?', [
      result.insertId,
    ]);
    return sendSuccess(res, 'Payment method created', { paymentMethod: mapMethod(row) }, { status: 201 });
  } catch (error) {
    return next(error);
  }
}

// PUT /api/payment-methods/:id
export async function updatePaymentMethod(req, res, next) {
  try {
    const { name, color, icon } = req.body;
    const existing = await queryOne('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Payment method not found');
    if (existing.is_system) throw forbidden('Built-in payment methods cannot be modified');

    await query('UPDATE payment_methods SET name = ?, color = ?, icon = ? WHERE id = ? AND user_id = ?', [
      name ?? existing.name,
      color ?? existing.color,
      icon ?? existing.icon,
      existing.id,
      req.user.id,
    ]);
    const row = await queryOne('SELECT id, name, color, icon, is_system FROM payment_methods WHERE id = ?', [
      existing.id,
    ]);
    return sendSuccess(res, 'Payment method updated', { paymentMethod: mapMethod(row) });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/payment-methods/:id
export async function deletePaymentMethod(req, res, next) {
  try {
    const existing = await queryOne('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Payment method not found');
    if (existing.is_system) throw forbidden('Built-in payment methods cannot be deleted');

    const usage = await queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE payment_method_id = ? LIMIT 1', [
      existing.id,
    ]);
    if (usage.cnt > 0) throw conflict('This payment method is used by existing transactions');

    await query('DELETE FROM payment_methods WHERE id = ? AND user_id = ?', [existing.id, req.user.id]);
    return sendSuccess(res, 'Payment method deleted');
  } catch (error) {
    return next(error);
  }
}
