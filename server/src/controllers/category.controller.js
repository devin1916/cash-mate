import { query, queryOne } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { badRequest, conflict, notFound, forbidden } from '../utils/errors.js';

/**
 * Categories: built-in system categories (user_id IS NULL) plus the
 * user's own custom categories. Every query is user-scoped.
 */

const mapCategory = (row) => ({
  id: String(row.id),
  name: row.name,
  type: row.type,
  color: row.color,
  icon: row.icon,
  isSystem: Boolean(row.is_system),
});

// GET /api/categories
export async function listCategories(req, res, next) {
  try {
    const rows = await query(
      `SELECT id, name, type, color, icon, is_system
         FROM categories
        WHERE user_id IS NULL OR user_id = ?
        ORDER BY is_system DESC, type, name`,
      [req.user.id]
    );
    return sendSuccess(res, 'Categories retrieved', { categories: rows.map(mapCategory) });
  } catch (error) {
    return next(error);
  }
}

// POST /api/categories
export async function createCategory(req, res, next) {
  try {
    const { name, type, color = '#6366f1', icon = 'tag' } = req.body;

    const dup = await queryOne(
      'SELECT id FROM categories WHERE user_id = ? AND name = ? AND type = ? LIMIT 1',
      [req.user.id, name, type]
    );
    if (dup) throw conflict('You already have a category with this name');

    const result = await query(
      'INSERT INTO categories (user_id, name, type, color, icon, is_system) VALUES (?, ?, ?, ?, ?, 0)',
      [req.user.id, name, type, color, icon]
    );
    const row = await queryOne('SELECT id, name, type, color, icon, is_system FROM categories WHERE id = ?', [
      result.insertId,
    ]);
    return sendSuccess(res, 'Category created', { category: mapCategory(row) }, { status: 201 });
  } catch (error) {
    return next(error);
  }
}

// PUT /api/categories/:id  (owner + custom only)
export async function updateCategory(req, res, next) {
  try {
    const { name, color, icon } = req.body;
    const existing = await queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Category not found');
    if (existing.is_system) throw forbidden('Built-in categories cannot be modified');

    if (name && name !== existing.name) {
      const dup = await queryOne(
        'SELECT id FROM categories WHERE user_id = ? AND name = ? AND type = ? AND id != ? LIMIT 1',
        [req.user.id, name, existing.type, existing.id]
      );
      if (dup) throw conflict('You already have a category with this name');
    }

    await query('UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ? AND user_id = ?', [
      name ?? existing.name,
      color ?? existing.color,
      icon ?? existing.icon,
      existing.id,
      req.user.id,
    ]);
    const row = await queryOne('SELECT id, name, type, color, icon, is_system FROM categories WHERE id = ?', [
      existing.id,
    ]);
    return sendSuccess(res, 'Category updated', { category: mapCategory(row) });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/categories/:id
export async function deleteCategory(req, res, next) {
  try {
    const existing = await queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Category not found');
    if (existing.is_system) throw forbidden('Built-in categories cannot be deleted');

    const usage = await queryOne(
      'SELECT COUNT(*) AS cnt FROM transactions WHERE category_id = ? LIMIT 1',
      [existing.id]
    );
    if (usage.cnt > 0) {
      throw conflict('This category is used by existing transactions and cannot be deleted');
    }
    await query('DELETE FROM budgets WHERE category_id = ? AND user_id = ?', [existing.id, req.user.id]);
    await query('DELETE FROM categories WHERE id = ? AND user_id = ?', [existing.id, req.user.id]);
    return sendSuccess(res, 'Category deleted');
  } catch (error) {
    return next(error);
  }
}

// Guard used by other controllers: category must be system or owned.
export async function assertCategory(userId, categoryId, expectedType = null) {
  const cat = await queryOne('SELECT * FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)', [
    categoryId,
    userId,
  ]);
  if (!cat) throw badRequest('Selected category does not exist');
  if (expectedType && cat.type !== expectedType) {
    throw badRequest('The selected category does not match the transaction type');
  }
  return cat;
}

export async function assertPaymentMethod(userId, methodId) {
  if (!methodId) return null;
  const method = await queryOne('SELECT * FROM payment_methods WHERE id = ? AND (user_id IS NULL OR user_id = ?)', [
    methodId,
    userId,
  ]);
  if (!method) throw badRequest('Selected payment method does not exist');
  return method;
}
