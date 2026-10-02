import { query, queryOne } from '../config/db.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { badRequest } from '../utils/errors.js';

/**
 * Dashboard aggregate endpoint.
 * Computes totals on the server so the UI never has to download every
 * transaction just to render stats (performance requirement).
 */

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Resolve preset / custom date ranges to inclusive YYYY-MM-DD bounds. */
export function resolveRange({ preset, from, to }) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (preset) {
    case 'today':
      break;
    case 'week': {
      const day = (now.getDay() + 6) % 7; // Monday = 0
      start.setDate(now.getDate() - day);
      break;
    }
    case 'month':
      start.setDate(1);
      break;
    case 'lastMonth': {
      start.setDate(1);
      start.setMonth(start.getMonth() - 1);
      end.setDate(1);
      end.setMonth(end.getMonth() - 1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      break;
    }
    case 'last3Months':
      start.setDate(1);
      start.setMonth(start.getMonth() - 2);
      break;
    case 'year':
      start.setMonth(0, 1);
      end.setMonth(11, 31);
      break;
    case 'custom': {
      if (!from || !to) throw badRequest('Custom range needs from and to dates');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        throw badRequest('Dates must be in YYYY-MM-DD format');
      }
      if (from > to) throw badRequest('From date must be before to date');
      return { start: from, end: to };
    }
    case undefined:
    case null:
    case '':
    case 'month':
      start.setDate(1);
      break;
    default:
      throw badRequest('Unknown date preset');
  }
  return { start: ymd(start), end: ymd(end) };
}

async function sumRange(userId, start, end) {
  return queryOne(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expenses
     FROM transactions
    WHERE user_id = ? AND date BETWEEN ? AND ?`,
    [userId, start, end]
  );
}

// GET /api/dashboard/summary?preset=&from=&to=
export async function getSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const { start, end } = resolveRange(req.query);

    const [rangeTotals, lifetime, categoryRows, recentRows, monthlyRows, unreadCount] = await Promise.all([
      sumRange(userId, start, end),
      queryOne(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expenses
         FROM transactions WHERE user_id = ?`,
        [userId]
      ),
      query(
        `SELECT t.category_id, c.name AS category, c.color, COALESCE(SUM(t.amount), 0) AS amount
           FROM transactions t JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = ? AND t.type = 'expense' AND t.date BETWEEN ? AND ?
          GROUP BY t.category_id, c.name, c.color
          ORDER BY amount DESC`,
        [userId, start, end]
      ),
      query(
        `SELECT t.*, c.name AS category_name, c.color AS category_color, pm.name AS payment_method_name
           FROM transactions t
           JOIN categories c            ON c.id = t.category_id
           LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
          WHERE t.user_id = ?
          ORDER BY t.date DESC, t.id DESC LIMIT 8`,
        [userId]
      ),
      query(
        `SELECT YEAR(date) AS y, MONTH(date) AS m,
                COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expenses
           FROM transactions
          WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
          GROUP BY YEAR(date), MONTH(date)
          ORDER BY y, m`,
        [userId]
      ),
      queryOne('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0', [userId]),
    ]);

    // Previous period (for trend comparison) of equal length
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    const days = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    const previous = await sumRange(userId, ymd(prevStart), ymd(prevEnd));

    const income = Number(rangeTotals.income);
    const expenses = Number(rangeTotals.expenses);
    const balance = income - expenses;

    return sendSuccess(res, 'Dashboard summary retrieved', {
      range: { start, end },
      totals: {
        income,
        expenses,
        balance,
        lifetimeIncome: Number(lifetime.income),
        lifetimeExpenses: Number(lifetime.expenses),
        lifetimeBalance: Number(lifetime.income) - Number(lifetime.expenses),
        savingsRate: income > 0 ? Math.round((balance / income) * 1000) / 10 : 0,
      },
      previous: {
        income: Number(previous.income),
        expenses: Number(previous.expenses),
        balance: Number(previous.income) - Number(previous.expenses),
      },
      categoryBreakdown: categoryRows.map((r) => ({
        categoryId: String(r.category_id),
        category: r.category,
        color: r.color,
        amount: Number(r.amount),
      })),
      recent: recentRows.map((r) => ({
        id: String(r.id),
        type: r.type,
        amount: Number(r.amount),
        category: r.category_name,
        categoryColor: r.category_color,
        paymentMethod: r.payment_method_name,
        description: r.description,
        date: typeof r.date === 'string' ? r.date.slice(0, 10) : r.date,
        status: r.status,
      })),
      monthly: monthlyRows.map((r) => ({
        year: Number(r.y),
        month: Number(r.m),
        income: Number(r.income),
        expenses: Number(r.expenses),
      })),
      unreadNotifications: unreadCount.cnt,
    });
  } catch (error) {
    return next(error);
  }
}
