import { query, closePool } from '../config/db.js';
import { hashPassword } from '../utils/password.js';
import env from '../config/env.js';

/**
 * Idempotent seed:
 *  1. Built-in system categories (per product spec)
 *  2. Built-in payment methods
 *  3. Default system settings
 *  4. Admin account (only if ADMIN_EMAIL + ADMIN_PASSWORD are provided)
 *
 * Usage:  npm run seed
 */

const EXPENSE_CATEGORIES = [
  { name: 'Food', color: '#ef4444', icon: 'utensils' },
  { name: 'Transport', color: '#3b82f6', icon: 'car' },
  { name: 'Shopping', color: '#ec4899', icon: 'shopping-bag' },
  { name: 'Bills', color: '#f59e0b', icon: 'receipt' },
  { name: 'Rent', color: '#8b5cf6', icon: 'home' },
  { name: 'Utilities', color: '#06b6d4', icon: 'zap' },
  { name: 'Healthcare', color: '#10b981', icon: 'heart-pulse' },
  { name: 'Education', color: '#6366f1', icon: 'graduation-cap' },
  { name: 'Entertainment', color: '#f97316', icon: 'film' },
  { name: 'Travel', color: '#14b8a6', icon: 'plane' },
  { name: 'Subscriptions', color: '#a855f7', icon: 'repeat' },
  { name: 'Other', color: '#6b7280', icon: 'tag' },
];

const INCOME_CATEGORIES = [
  { name: 'Salary', color: '#22c55e', icon: 'banknote' },
  { name: 'Freelance', color: '#10b981', icon: 'laptop' },
  { name: 'Business', color: '#f97316', icon: 'briefcase' },
  { name: 'Investment', color: '#6366f1', icon: 'trending-up' },
  { name: 'Bonus', color: '#eab308', icon: 'star' },
  { name: 'Gift', color: '#ec4899', icon: 'gift' },
  { name: 'Other', color: '#6b7280', icon: 'tag' },
];

const PAYMENT_METHODS = [
  { name: 'Cash', color: '#10b981', icon: 'banknote' },
  { name: 'Debit Card', color: '#3b82f6', icon: 'credit-card' },
  { name: 'Credit Card', color: '#8b5cf6', icon: 'credit-card' },
  { name: 'Bank Transfer', color: '#06b6d4', icon: 'landmark' },
  { name: 'Online Payment', color: '#f59e0b', icon: 'globe' },
  { name: 'Mobile Payment', color: '#ec4899', icon: 'smartphone' },
];

async function seedCategory({ name, type, color, icon }) {
  const rows = await query(
    'SELECT id FROM categories WHERE user_id IS NULL AND name = ? AND type = ? LIMIT 1',
    [name, type]
  );
  if (rows.length === 0) {
    await query(
      'INSERT INTO categories (user_id, name, type, color, icon, is_system) VALUES (NULL, ?, ?, ?, ?, 1)',
      [name, type, color, icon]
    );
  }
}

async function seedPaymentMethod({ name, color, icon }) {
  const rows = await query(
    'SELECT id FROM payment_methods WHERE user_id IS NULL AND name = ? LIMIT 1',
    [name]
  );
  if (rows.length === 0) {
    await query(
      'INSERT INTO payment_methods (user_id, name, color, icon, is_system) VALUES (NULL, ?, ?, ?, 1)',
      [name, color, icon]
    );
  }
}

async function seedSetting(key, value) {
  await query(
    'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_key = setting_key',
    [key, value]
  );
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
     
    console.log('[seed] ADMIN_EMAIL/ADMIN_PASSWORD not set - skipping admin account');
    return;
  }
  const rows = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (rows.length > 0) {
     
    console.log(`[seed] admin ${email} already exists - skipping`);
    return;
  }
  const hash = await hashPassword(password);
  await query(
    `INSERT INTO users (name, email, password_hash, role, status, currency, email_verified_at)
     VALUES (?, ?, ?, 'admin', 'active', 'LKR', NOW())`,
    [process.env.ADMIN_NAME || 'Admin', email, hash]
  );
   
  console.log(`[seed] created admin account ${email}`);
}

export async function runSeed() {
  for (const c of EXPENSE_CATEGORIES) await seedCategory({ ...c, type: 'expense' });
  for (const c of INCOME_CATEGORIES) await seedCategory({ ...c, type: 'income' });
  for (const m of PAYMENT_METHODS) await seedPaymentMethod(m);

  await seedSetting('app_name', 'CashMate');
  await seedSetting('default_currency', 'LKR');
  await seedSetting('budget_alert_thresholds', '50,75,90,100');

  await seedAdmin();
   
  console.log('[seed] done');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
       
      console.error('[seed] failed:', err.message);
      await closePool().catch(() => {});
      process.exit(1);
    });
}
