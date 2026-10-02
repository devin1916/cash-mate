import { query } from '../config/db.js';
import { notify } from './notifications.js';

/**
 * Recurring transaction generation.
 * A cron-style processor picks every active rule whose next_run_date is due,
 * creates the transaction (dated on the scheduled day), advances the
 * schedule, and notifies the user.
 */

export function advanceDate(dateStr, frequency) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
  switch (frequency) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'monthly': {
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 1);
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, lastDay));
      break;
    }
    case 'yearly': {
      const month = d.getUTCMonth();
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), month + 1, 0)).getUTCDate();
      d.setUTCMonth(month);
      d.setUTCDate(Math.min(day, lastDay));
      break;
    }
    default:
      break;
  }
  return d.toISOString().slice(0, 10);
}

/** Generate all due transactions. Runs on boot + interval; safe to run often. */
export async function processRecurring() {
  const due = await query(
    `SELECT * FROM recurring_transactions
      WHERE status = 'active' AND next_run_date <= CURDATE()
        AND (end_date IS NULL OR end_date >= CURDATE())`
  );

  let created = 0;
  for (const rule of due) {
    try {
      const runDate = String(rule.next_run_date).slice(0, 10);
      await query(
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

      const next = advanceDate(runDate, rule.frequency);
      const finished = rule.end_date && next > String(rule.end_date).slice(0, 10);
      await query(
        `UPDATE recurring_transactions
            SET last_run_date = ?, next_run_date = ?, status = ?
          WHERE id = ?`,
        [runDate, next, finished ? 'completed' : rule.status, rule.id]
      );

      await notify(rule.user_id, {
        type: 'recurring_created',
        title: `${rule.type === 'income' ? 'Income' : 'Expense'} generated automatically`,
        message: `"${rule.description}" (${rule.type}) was created from your recurring schedule.`,
        data: { recurringId: String(rule.id), date: runDate },
        dedupeKey: `recurring:${rule.id}:${runDate}`,
      });
      created += 1;
    } catch (error) {
       
      console.error('[recurring] failed for rule', rule.id, error.message);
    }
  }
  return created;
}

/** Start the recurring processor loop (called once on server boot). */
export function startRecurringProcessor(intervalMs = 60 * 60 * 1000) {
  const run = () => processRecurring().catch(() => {});
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}
