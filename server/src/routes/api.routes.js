import { Router } from 'express';
import * as tx from '../controllers/transaction.controller.js';
import * as cats from '../controllers/category.controller.js';
import * as methods from '../controllers/paymentMethod.controller.js';
import * as budgets from '../controllers/budget.controller.js';
import * as dash from '../controllers/dashboard.controller.js';
import * as goals from '../controllers/goal.controller.js';
import * as recurring from '../controllers/recurring.controller.js';
import * as bills from '../controllers/bill.controller.js';
import * as notifications from '../controllers/notification.controller.js';
import * as settings from '../controllers/settings.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  transactionRules,
  transactionUpdateRules,
  listQueryRules,
  categoryRules,
  categoryUpdateRules,
  paymentMethodRules,
  paymentMethodUpdateRules,
  budgetRules,
  budgetUpdateRules,
  goalRules,
  goalUpdateRules,
  contributionRules,
  recurringRules,
  recurringUpdateRules,
  billRules,
  billUpdateRules,
  settingsRules,
  idParamRules,
} from '../validators/resource.validators.js';

const router = Router();

// Every route below requires a valid access token + active account.
router.use(requireAuth);

// ------------------------------ Dashboard ---------------------------
router.get('/dashboard/summary', dash.getSummary);

// ----------------------------- Transactions -------------------------
router.get('/transactions', listQueryRules, validate, tx.listTransactions);
router.get('/transactions/:id', idParamRules, validate, tx.getTransaction);
router.post('/transactions', transactionRules, validate, tx.createTransaction);
router.patch('/transactions/:id', idParamRules, transactionUpdateRules, validate, tx.updateTransaction);
router.put('/transactions/:id', idParamRules, transactionUpdateRules, validate, tx.updateTransaction);
router.delete('/transactions/:id', idParamRules, validate, tx.deleteTransaction);

// ------------------------------ Categories --------------------------
router.get('/categories', cats.listCategories);
router.post('/categories', categoryRules, validate, cats.createCategory);
router.put('/categories/:id', categoryUpdateRules, validate, cats.updateCategory);
router.patch('/categories/:id', categoryUpdateRules, validate, cats.updateCategory);
router.delete('/categories/:id', idParamRules, validate, cats.deleteCategory);

// --------------------------- Payment methods ------------------------
router.get('/payment-methods', methods.listPaymentMethods);
router.post('/payment-methods', paymentMethodRules, validate, methods.createPaymentMethod);
router.put('/payment-methods/:id', paymentMethodUpdateRules, validate, methods.updatePaymentMethod);
router.patch('/payment-methods/:id', paymentMethodUpdateRules, validate, methods.updatePaymentMethod);
router.delete('/payment-methods/:id', idParamRules, validate, methods.deletePaymentMethod);

// ------------------------------ Budgets -----------------------------
router.get('/budgets', budgets.listBudgets);
router.post('/budgets', budgetRules, validate, budgets.createBudget);
router.put('/budgets/:id', idParamRules, budgetUpdateRules, validate, budgets.updateBudget);
router.patch('/budgets/:id', idParamRules, budgetUpdateRules, validate, budgets.updateBudget);
router.delete('/budgets/:id', idParamRules, validate, budgets.deleteBudget);

// --------------------------- Savings goals --------------------------
router.get('/goals', goals.listGoals);
router.get('/goals/:id', idParamRules, validate, goals.getGoal);
router.post('/goals', goalRules, validate, goals.createGoal);
router.put('/goals/:id', idParamRules, goalUpdateRules, validate, goals.updateGoal);
router.patch('/goals/:id', idParamRules, goalUpdateRules, validate, goals.updateGoal);
router.delete('/goals/:id', idParamRules, validate, goals.deleteGoal);
router.post('/goals/:id/contributions', idParamRules, contributionRules, validate, goals.addContribution);
router.get('/goals/:id/contributions', idParamRules, validate, goals.listContributions);
router.delete('/goals/:id/contributions/:cid', validate, goals.deleteContribution);

// ------------------------ Recurring transactions --------------------
router.get('/recurring', recurring.listRecurring);
router.post('/recurring', recurringRules, validate, recurring.createRecurring);
router.put('/recurring/:id', idParamRules, recurringUpdateRules, validate, recurring.updateRecurring);
router.patch('/recurring/:id', idParamRules, recurringUpdateRules, validate, recurring.updateRecurring);
router.delete('/recurring/:id', idParamRules, validate, recurring.deleteRecurring);
router.post('/recurring/:id/run', idParamRules, validate, recurring.runRecurringNow);

// -------------------------------- Bills -----------------------------
router.get('/bills', bills.listBills);
router.post('/bills', billRules, validate, bills.createBill);
router.put('/bills/:id', idParamRules, billUpdateRules, validate, bills.updateBill);
router.patch('/bills/:id', idParamRules, billUpdateRules, validate, bills.updateBill);
router.delete('/bills/:id', idParamRules, validate, bills.deleteBill);
router.post('/bills/:id/pay', idParamRules, validate, bills.payBill);

// --------------------------- Notifications --------------------------
router.get('/notifications', notifications.listNotifications);
router.get('/notifications/unread-count', notifications.unreadCount);
router.patch('/notifications/read-all', notifications.markAllRead);
router.patch('/notifications/:id/read', idParamRules, validate, notifications.markRead);
router.delete('/notifications/:id', idParamRules, validate, notifications.deleteNotification);
router.delete('/notifications', notifications.clearNotifications);

// ------------------------------ Settings ----------------------------
router.get('/settings', settings.getSettings);
router.put('/settings', settingsRules, validate, settings.updateSettings);

export default router;
