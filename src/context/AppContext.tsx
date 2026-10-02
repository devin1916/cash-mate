import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Transaction,
  TransactionInput,
  TransactionFilters,
  Category,
  PaymentMethod,
  Budget,
  DashboardSummary,
  PageMeta,
  DatePreset,
  Goal,
  RecurringRule,
  Bill,
  AppNotification,
  UserSettings,
} from '../types';
import api, { ApiError } from '../api/client';

interface AppState {
  // Core
  transactions: Transaction[];
  transactionsMeta: PageMeta;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  budgets: Budget[];
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  // Phase 2
  goals: Goal[];
  recurring: RecurringRule[];
  bills: Bill[];
  notifications: AppNotification[];
  notificationsMeta: PageMeta & { unread: number };
  settings: UserSettings | null;

  reload: () => Promise<void>;
  // Transactions
  fetchTransactions: (filters?: TransactionFilters) => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<Transaction>;
  updateTransaction: (id: string, input: Partial<TransactionInput>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  // Categories & payment methods
  addCategory: (category: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addPaymentMethod: (method: { name: string; color?: string; icon?: string }) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
  // Budgets
  setBudget: (budget: { id?: string; categoryId?: string | null; amount: number; month: number; year: number }) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  fetchBudgets: (month?: number, year?: number) => Promise<void>;
  fetchSummary: (preset?: DatePreset, from?: string, to?: string) => Promise<void>;
  // Goals
  fetchGoals: () => Promise<void>;
  saveGoal: (goal: { id?: string; name: string; targetAmount: number; targetDate?: string | null; description?: string | null; status?: string }) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  contributeToGoal: (id: string, payload: { amount: number; date?: string; note?: string | null }) => Promise<void>;
  deleteContribution: (goalId: string, contributionId: string) => Promise<void>;
  // Recurring
  fetchRecurring: () => Promise<void>;
  saveRecurring: (rule: Record<string, unknown> & { id?: string }) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  runRecurring: (id: string) => Promise<void>;
  // Bills
  fetchBills: () => Promise<void>;
  saveBill: (bill: Record<string, unknown> & { id?: string }) => Promise<void>;
  payBill: (id: string) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  // Notifications
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  // Settings
  fetchSettings: () => Promise<void>;
  saveSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

const DEFAULT_FILTERS: TransactionFilters = { page: 1, limit: 20 };

/** Silently swallow auth errors during bootstrap (login page is showing). */
const silently = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) {
      // Non-auth failures are surfaced by the individual fetchers where relevant
    }
  }
};

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsMeta, setTransactionsMeta] = useState<PageMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsMeta, setNotificationsMeta] = useState<PageMeta & { unread: number }>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    unread: 0,
  });
  const [settings, setSettings] = useState<UserSettings | null>(null);

  // ----------------------------- Fetchers -----------------------------
  const fetchTransactions = useCallback(async (filters: TransactionFilters = DEFAULT_FILTERS) => {
    try {
      const res = await api.get('/transactions', filters as Record<string, string | number | undefined>);
      setTransactions(res.data!.transactions);
      if (res.meta) setTransactionsMeta(res.meta as PageMeta);
      setError(null);
    } catch (e) {
      const err = e as ApiError;
      if (err.status !== 401) setError(err.message || 'Unable to load transactions');
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    await silently(async () => {
      const res = await api.get('/categories');
      setCategories(res.data!.categories);
    });
  }, []);

  const fetchPaymentMethods = useCallback(async () => {
    await silently(async () => {
      const res = await api.get('/payment-methods');
      setPaymentMethods(res.data!.paymentMethods);
    });
  }, []);

  const fetchBudgets = useCallback(async (month?: number, year?: number) => {
    await silently(async () => {
      const now = new Date();
      const res = await api.get('/budgets', {
        month: month ?? now.getMonth() + 1,
        year: year ?? now.getFullYear(),
      });
      setBudgets(res.data!.budgets);
    });
  }, []);

  const fetchSummary = useCallback(async (preset?: DatePreset, from?: string, to?: string) => {
    await silently(async () => {
      const res = await api.get('/dashboard/summary', { preset, from, to });
      setSummary(res.data as DashboardSummary);
    });
  }, []);

  const fetchGoals = useCallback(async () => {
    await silently(async () => {
      const res = await api.get('/goals');
      setGoals(res.data!.goals);
    });
  }, []);

  const fetchRecurring = useCallback(async () => {
    await silently(async () => {
      const res = await api.get('/recurring');
      setRecurring(res.data!.recurring);
    });
  }, []);

  const fetchBills = useCallback(async () => {
    await silently(async () => {
      const res = await api.get('/bills');
      setBills(res.data!.bills);
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    await silently(async () => {
      const res = await api.get('/notifications', { limit: 20 });
      setNotifications(res.data!.notifications);
      if (res.meta) setNotificationsMeta(res.meta as PageMeta & { unread: number });
    });
  }, []);

  const fetchSettings = useCallback(async () => {
    await silently(async () => {
      const res = await api.get('/settings');
      setSettings(res.data!.settings as UserSettings);
    });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchCategories(),
        fetchPaymentMethods(),
        fetchBudgets(),
        fetchTransactions(),
        fetchSummary(),
        fetchGoals(),
        fetchRecurring(),
        fetchBills(),
        fetchNotifications(),
        fetchSettings(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [
    fetchCategories,
    fetchPaymentMethods,
    fetchBudgets,
    fetchTransactions,
    fetchSummary,
    fetchGoals,
    fetchRecurring,
    fetchBills,
    fetchNotifications,
    fetchSettings,
  ]);

  const refreshAfterTransactionChange = async () => {
    await Promise.all([fetchTransactions(), fetchSummary(), fetchBudgets(), fetchNotifications(), fetchGoals()]);
  };

  // --------------------------- Transactions ---------------------------
  const addTransaction = async (input: TransactionInput): Promise<Transaction> => {
    const res = await api.post('/transactions', input);
    await refreshAfterTransactionChange();
    return res.data!.transaction;
  };

  const updateTransaction = async (id: string, input: Partial<TransactionInput>) => {
    await api.patch(`/transactions/${id}`, input);
    await refreshAfterTransactionChange();
  };

  const deleteTransaction = async (id: string) => {
    await api.delete(`/transactions/${id}`);
    await refreshAfterTransactionChange();
  };

  // ------------------------ Categories & methods ----------------------
  const addCategory = async (category: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) => {
    await api.post('/categories', category);
    await fetchCategories();
  };

  const deleteCategory = async (id: string) => {
    await api.delete(`/categories/${id}`);
    await fetchCategories();
  };

  const addPaymentMethod = async (method: { name: string; color?: string; icon?: string }) => {
    await api.post('/payment-methods', method);
    await fetchPaymentMethods();
  };

  const deletePaymentMethod = async (id: string) => {
    await api.delete(`/payment-methods/${id}`);
    await fetchPaymentMethods();
  };

  // ----------------------------- Budgets ------------------------------
  const setBudget = async (budget: { id?: string; categoryId?: string | null; amount: number; month: number; year: number }) => {
    if (budget.id) {
      const { id, ...payload } = budget;
      await api.patch(`/budgets/${id}`, payload);
    } else {
      const existing = budgets.find(
        (b) =>
          b.month === budget.month &&
          b.year === budget.year &&
          (budget.categoryId ? b.categoryId === budget.categoryId : b.categoryId === null)
      );
      if (existing) {
        await api.put(`/budgets/${existing.id}`, { amount: budget.amount });
      } else {
        await api.post('/budgets', budget);
      }
    }
    await Promise.all([fetchBudgets(), fetchSummary()]);
  };

  const deleteBudget = async (id: string) => {
    await api.delete(`/budgets/${id}`);
    await Promise.all([fetchBudgets(), fetchSummary()]);
  };

  // ------------------------------- Goals ------------------------------
  const saveGoal = async (goal: { id?: string; name: string; targetAmount: number; targetDate?: string | null; description?: string | null; status?: string }) => {
    const payload = {
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate || null,
      description: goal.description || null,
      ...(goal.status ? { status: goal.status } : {}),
    };
    if (goal.id) await api.patch(`/goals/${goal.id}`, payload);
    else await api.post('/goals', payload);
    await Promise.all([fetchGoals(), fetchSummary()]);
  };

  const deleteGoal = async (id: string) => {
    await api.delete(`/goals/${id}`);
    await Promise.all([fetchGoals(), fetchNotifications()]);
  };

  const contributeToGoal = async (id: string, payload: { amount: number; date?: string; note?: string | null }) => {
    await api.post(`/goals/${id}/contributions`, payload);
    await Promise.all([fetchGoals(), fetchNotifications(), fetchSummary()]);
  };

  const deleteContribution = async (goalId: string, contributionId: string) => {
    await api.delete(`/goals/${goalId}/contributions/${contributionId}`);
    await fetchGoals();
  };

  // ----------------------------- Recurring ----------------------------
  const saveRecurring = async (rule: Record<string, unknown> & { id?: string }) => {
    if (rule.id) await api.patch(`/recurring/${rule.id}`, rule);
    else await api.post('/recurring', rule);
    await fetchRecurring();
  };

  const deleteRecurring = async (id: string) => {
    await api.delete(`/recurring/${id}`);
    await fetchRecurring();
  };

  const runRecurring = async (id: string) => {
    await api.post(`/recurring/${id}/run`);
    await Promise.all([fetchRecurring(), fetchTransactions(), fetchSummary(), fetchNotifications()]);
  };

  // -------------------------------- Bills -----------------------------
  const saveBill = async (bill: Record<string, unknown> & { id?: string }) => {
    if (bill.id) await api.patch(`/bills/${bill.id}`, bill);
    else await api.post('/bills', bill);
    await fetchBills();
  };

  const payBill = async (id: string) => {
    await api.post(`/bills/${id}/pay`);
    await Promise.all([fetchBills(), fetchNotifications()]);
  };

  const deleteBill = async (id: string) => {
    await api.delete(`/bills/${id}`);
    await fetchBills();
  };

  // --------------------------- Notifications --------------------------
  const markNotificationRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    await fetchNotifications();
  };

  const markAllNotificationsRead = async () => {
    await api.patch('/notifications/read-all');
    await Promise.all([fetchNotifications(), fetchSummary()]);
  };

  const deleteNotification = async (id: string) => {
    await api.delete(`/notifications/${id}`);
    await fetchNotifications();
  };

  const clearNotifications = async () => {
    await api.delete('/notifications');
    await fetchNotifications();
  };

  // ------------------------------ Settings ----------------------------
  const saveSettings = async (next: Partial<UserSettings>) => {
    await api.put('/settings', next);
    await fetchSettings();
  };

  const value: AppState = {
    transactions,
    transactionsMeta,
    categories,
    paymentMethods,
    budgets,
    summary,
    loading,
    error,
    goals,
    recurring,
    bills,
    notifications,
    notificationsMeta,
    settings,
    reload,
    fetchTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    deleteCategory,
    addPaymentMethod,
    deletePaymentMethod,
    setBudget,
    deleteBudget,
    fetchBudgets,
    fetchSummary,
    fetchGoals,
    saveGoal,
    deleteGoal,
    contributeToGoal,
    deleteContribution,
    fetchRecurring,
    saveRecurring,
    deleteRecurring,
    runRecurring,
    fetchBills,
    saveBill,
    payBill,
    deleteBill,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearNotifications,
    fetchSettings,
    saveSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
