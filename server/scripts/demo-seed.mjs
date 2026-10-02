/**
 * Demo data seeder - creates a rich sample account through the real REST API.
 * Usage:  node scripts/demo-seed.mjs
 * Credentials: demo@cashmate.local / Demo@12345
 */
const BASE = 'http://localhost:4000/api';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json.errors ? ` fields=${JSON.stringify(json.errors)}` : '';
    throw new Error(`${method} ${path} -> ${res.status} ${json.message || ''}${detail}`);
  }
  return json;
}

async function main() {
  // 1. Auth -----------------------------------------------------------
  let token;
  try {
    const reg = await api('/auth/register', {
      method: 'POST',
      body: { name: 'Demo User', email: 'demo@cashmate.local', password: 'Demo@12345' },
    });
    token = reg.data.accessToken;
    console.log('registered demo@cashmate.local');
  } catch (e) {
    const login = await api('/auth/login', {
      method: 'POST',
      body: { email: 'demo@cashmate.local', password: 'Demo@12345' },
    });
    token = login.data.accessToken;
    console.log('demo user already exists - logged in');
  }

  const cats = (await api('/categories', { token })).data.categories;
  const catId = (name, type = 'expense') => cats.find((c) => c.name === name && c.type === type)?.id;

  // Idempotency guard: don't double-seed an existing account
  const existing = await api('/transactions?limit=1', { token });
  if (existing.meta.total > 0) {
    console.log(`account already has ${existing.meta.total} transactions - skipping seed`);
    return;
  }

  const now = new Date();
  const monthStart = (offset) => new Date(now.getFullYear(), now.getMonth() - offset, 1);

  // 2. Budgets FIRST so expense alerts can fire -----------------------
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const budgets = [
    ['Food', 40000],
    ['Transport', 15000],
    ['Entertainment', 10000],
    ['Subscriptions', 5000],
  ];
  for (const [name, amount] of budgets) {
    await api('/budgets', {
      method: 'POST',
      token,
      body: { categoryId: catId(name), amount, month: currentMonth, year: currentYear },
    });
  }
  console.log(`created ${budgets.length} budgets`);

  // 3. Transactions across the last 4 months ---------------------------
  const day = (base, offset, maxDay) => {
    const d = monthStart(offset);
    // Never schedule current-month entries in the future: clamp to today
    const cap = offset === 0 ? Math.max(1, now.getDate()) : Math.min(base, maxDay || 28);
    d.setDate(Math.min(base, cap));
    return ymd(d);
  };

  const tx = [];
  const foodAmounts = [3200, 5400, 2800, 7600, 4100, 6300, 2950, 8200, 4300];
  const transportAmounts = [1500, 2200, 3500, 1800, 4200];

  for (let m = 3; m >= 0; m--) {
    const isCurrent = m === 0;
    // Income
    tx.push({ type: 'income', amount: 150000, categoryId: catId('Salary', 'income'), description: 'Monthly salary', date: day(1, m), paymentMethodId: null });
    if (m % 2 === 0) tx.push({ type: 'income', amount: 45000, categoryId: catId('Freelance', 'income'), description: 'Freelance project', date: day(18, m) });

    // Fixed expenses
    tx.push({ type: 'expense', amount: 45000, categoryId: catId('Rent'), description: 'Apartment rent', date: day(5, m) });
    tx.push({ type: 'expense', amount: 1990, categoryId: catId('Subscriptions'), description: 'Netflix subscription', date: day(7, m) });
    tx.push({ type: 'expense', amount: 4999, categoryId: catId('Bills'), description: 'Internet bill', date: day(10, m) });
    if (m !== 0) tx.push({ type: 'expense', amount: 8500 + m * 600, categoryId: catId('Utilities'), description: 'Electricity bill', date: day(12, m) });

    // Variable expenses (for current month keep only ~half so budget usage sits at 50-80%)
    const foodCount = isCurrent ? 5 : foodAmounts.length;
    for (let i = 0; i < foodCount; i++) {
      tx.push({ type: 'expense', amount: foodAmounts[i], categoryId: catId('Food'), description: ['Supermarket run', 'Lunch with team', 'Dinner out', 'Groceries', 'Coffee & snacks', 'Family dinner', 'Bakery', 'Food court', 'Weekend brunch'][i], date: day(3 + i * 3, m) });
    }
    const transportCount = isCurrent ? 2 : transportAmounts.length;
    for (let i = 0; i < transportCount; i++) {
      tx.push({ type: 'expense', amount: transportAmounts[i], categoryId: catId('Transport'), description: ['Fuel', 'Bus pass', 'Taxi ride', 'Car service', 'Train ticket'][i], date: day(4 + i * 4, m) });
    }
    tx.push({ type: 'expense', amount: 2500 + m * 300, categoryId: catId('Entertainment'), description: 'Cinema & games', date: day(20, m) });
    if (m === 1) tx.push({ type: 'expense', amount: 18500, categoryId: catId('Shopping'), description: 'New shoes and clothes', date: day(15, m) });
    if (m === 2) tx.push({ type: 'expense', amount: 6500, categoryId: catId('Healthcare'), description: 'Pharmacy + consultation', date: day(9, m) });
    if (m === 3) tx.push({ type: 'expense', amount: 32000, categoryId: catId('Travel'), description: 'Weekend trip', date: day(22, m) });
  }

  let created = 0;
  for (const t of tx) {
    if (!t.categoryId) continue;
    await api('/transactions', { method: 'POST', token, body: t });
    created++;
  }
  console.log(`created ${created} transactions`);

  // 4. Savings goals ---------------------------------------------------
  const goals = [
    { name: 'Emergency Fund', targetAmount: 500000, current: 185000, days: 150, description: '6 months of expenses' },
    { name: 'New Laptop', targetAmount: 420000, current: 130000, days: 90, description: 'Work upgrade' },
    { name: 'Vacation', targetAmount: 250000, current: 60000, days: 210, description: 'Beach holiday' },
  ];
  for (const g of goals) {
    const target = new Date();
    target.setDate(target.getDate() + g.days);
    const res = await api('/goals', {
      method: 'POST',
      token,
      body: { name: g.name, targetAmount: g.targetAmount, targetDate: ymd(target), description: g.description },
    });
    await api(`/goals/${res.data.goal.id}/contributions`, {
      method: 'POST',
      token,
      body: { amount: g.current, date: ymd(new Date(now.getFullYear(), now.getMonth(), Math.min(5, now.getDate()))) },
    });
  }
  console.log(`created ${goals.length} savings goals with contributions`);

  // 5. Bills ------------------------------------------------------------
  const bills = [
    ['Electricity Bill', 8500, 3],
    ['Water Bill', 2200, 5],
    ['Internet Bill', 4999, 7],
    ['Mobile Phone', 1500, 10],
  ];
  for (const [name, amount, plusDays] of bills) {
    const due = new Date();
    due.setDate(due.getDate() + plusDays);
    await api('/bills', {
      method: 'POST',
      token,
      body: { name, amount, dueDate: ymd(due), frequency: 'monthly', categoryId: catId('Bills'), reminderDaysBefore: 3 },
    });
  }
  console.log(`created ${bills.length} bills`);

  // 6. Recurring schedules ---------------------------------------------
  const firstNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  await api('/recurring', {
    method: 'POST',
    token,
    body: { type: 'income', amount: 150000, categoryId: catId('Salary', 'income'), description: 'Monthly salary', frequency: 'monthly', startDate: ymd(firstNext) },
  });
  await api('/recurring', {
    method: 'POST',
    token,
    body: { type: 'expense', amount: 1990, categoryId: catId('Subscriptions'), description: 'Netflix', frequency: 'monthly', startDate: ymd(firstNext) },
  });
  await api('/recurring', {
    method: 'POST',
    token,
    body: { type: 'expense', amount: 45000, categoryId: catId('Rent'), description: 'Apartment rent', frequency: 'monthly', startDate: ymd(firstNext) },
  });
  console.log('created 3 recurring schedules');

  // 7. Verify dashboard -------------------------------------------------
  const summary = await api('/dashboard/summary?preset=month', { token });
  console.log('dashboard summary:', JSON.stringify(summary.data.totals));
  const notifs = await api('/notifications', { token });
  console.log('notifications:', notifs.meta.unread, 'unread');
  console.log('DONE - login with demo@cashmate.local / Demo@12345');
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});
