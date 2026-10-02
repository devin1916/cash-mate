import { query } from '../config/db.js';
import { notify } from './notifications.js';

/**
 * Bill processing: overdue marking + advance reminders.
 * Runs on boot and on an interval; all notifications are deduplicated.
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

export async function processBills() {
  // 1. Overdue: unpaid bills past their due date
  const overdueCount = await query(
    `UPDATE bills SET status = 'overdue'
      WHERE status = 'upcoming' AND due_date < CURDATE()`
  );

  // 2. Reminders: due within each bill's reminder window
  const upcoming = await query(
    `SELECT * FROM bills
      WHERE status IN ('upcoming', 'overdue')
        AND due_date <= DATE_ADD(CURDATE(), INTERVAL reminder_days_before DAY)`
  );

  for (const bill of upcoming) {
    const due = String(bill.due_date).slice(0, 10);
    const daysLeft = Math.ceil((new Date(`${due}T00:00:00Z`) - new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86400000);
    const when = daysLeft > 0 ? `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'today';
    await notify(bill.user_id, {
      type: 'bill_reminder',
      title: `Bill due ${when}: ${bill.name}`,
      message: `${bill.name} of ${Number(bill.amount).toFixed(2)} is due on ${due}.`,
      data: { billId: String(bill.id), dueDate: due },
      dedupeKey: `bill:${bill.id}:${due}`,
    });
  }

  return { overdue: overdueCount?.affectedRows ?? 0, reminded: upcoming.length };
}

/** Start the bill processor loop (called once on server boot). */
export function startBillProcessor(intervalMs = 60 * 60 * 1000) {
  const run = () => processBills().catch(() => {});
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}
