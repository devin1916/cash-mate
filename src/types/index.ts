export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role?: 'user' | 'admin';
  currency?: string;
  emailVerified?: boolean;
  createdAt?: string;
}

export interface Transaction {
  id: string;
  userId?: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  category: string; // category name (denormalized by the API)
  categoryColor?: string | null;
  paymentMethodId?: string | null;
  paymentMethod?: string | null;
  recurringId?: string | null;
  description: string;
  notes?: string | null;
  date: string; // YYYY-MM-DD
  status?: 'completed' | 'pending';
  receiptUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransactionInput {
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  description: string;
  date: string;
  paymentMethodId?: string | null;
  notes?: string | null;
  status?: 'completed' | 'pending';
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: 'all' | 'income' | 'expense';
  categoryId?: string;
  paymentMethodId?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  sort?: 'date' | 'amount' | 'createdAt' | 'description';
  order?: 'asc' | 'desc';
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  isSystem?: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  color: string;
  icon: string;
  isSystem?: boolean;
}

export interface Budget {
  id: string;
  categoryId: string | null;
  category: string | null;
  categoryColor?: string | null;
  amount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  month: number;
  year: number;
}

export interface DashboardSummary {
  range: { start: string; end: string };
  totals: {
    income: number;
    expenses: number;
    balance: number;
    lifetimeIncome: number;
    lifetimeExpenses: number;
    lifetimeBalance: number;
    savingsRate: number;
  };
  previous: { income: number; expenses: number; balance: number };
  categoryBreakdown: { categoryId: string; category: string; color: string; amount: number }[];
  recent: {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    categoryColor?: string | null;
    paymentMethod?: string | null;
    description: string;
    date: string;
    status?: string;
  }[];
  monthly: { year: number; month: number; income: number; expenses: number }[];
  unreadNotifications: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  description: string | null;
  status: 'active' | 'completed' | 'archived';
  percentUsed: number;
  remaining: number;
  requiredMonthly: number | null;
  daysLeft: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoalContribution {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  createdAt?: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  category: string | null;
  categoryColor?: string | null;
  paymentMethodId: string | null;
  paymentMethod: string | null;
  description: string;
  notes: string | null;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  lastRunDate: string | null;
  status: 'active' | 'paused' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  frequency: 'none' | RecurringFrequency;
  categoryId: string | null;
  category: string | null;
  categoryColor?: string | null;
  paymentMethodId: string | null;
  paymentMethod: string | null;
  reminderDaysBefore: number;
  status: 'upcoming' | 'paid' | 'overdue';
  paidAt: string | null;
  createdAt?: string;
}

export interface AppNotification {
  id: string;
  type:
    | 'budget_warning'
    | 'budget_exceeded'
    | 'bill_reminder'
    | 'goal_progress'
    | 'recurring_created'
    | 'unusual_spending'
    | 'account'
    | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface UserSettings {
  budgetAlertThresholds: number[];
}

export type DatePreset =
  | 'today'
  | 'week'
  | 'month'
  | 'lastMonth'
  | 'last3Months'
  | 'year'
  | 'custom';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  initializing: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  dismissSessionExpired: () => void;
}
