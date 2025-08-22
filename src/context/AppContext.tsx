import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Transaction, Category, Budget } from '../types';
import { format } from 'date-fns';

interface AppState {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  setBudget: (budget: Omit<Budget, 'id'>) => void;
  searchTransactions: (query: string) => Transaction[];
  filterTransactions: (filters: any) => Transaction[];
}

const AppContext = createContext<AppState | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

const defaultCategories: Category[] = [
  { id: '1', name: 'Food & Dining', type: 'expense', color: '#ef4444', icon: 'utensils' },
  { id: '2', name: 'Transportation', type: 'expense', color: '#3b82f6', icon: 'car' },
  { id: '3', name: 'Bills & Utilities', type: 'expense', color: '#f59e0b', icon: 'receipt' },
  { id: '4', name: 'Entertainment', type: 'expense', color: '#8b5cf6', icon: 'film' },
  { id: '5', name: 'Shopping', type: 'expense', color: '#ec4899', icon: 'shopping-bag' },
  { id: '6', name: 'Healthcare', type: 'expense', color: '#10b981', icon: 'heart' },
  { id: '7', name: 'Travel', type: 'expense', color: '#06b6d4', icon: 'plane' },
  { id: '8', name: 'Salary', type: 'income', color: '#22c55e', icon: 'banknote' },
  { id: '9', name: 'Business', type: 'income', color: '#f97316', icon: 'briefcase' },
  { id: '10', name: 'Investments', type: 'income', color: '#6366f1', icon: 'trending-up' }
];

const mockTransactions: Transaction[] = [
  {
    id: '1',
    userId: '1',
    type: 'income',
    amount: 150000,
    category: 'Salary',
    description: 'Monthly salary',
    date: new Date('2025-01-01'),
    createdAt: new Date('2025-01-01')
  },
  {
    id: '2',
    userId: '1',
    type: 'expense',
    amount: 2500,
    category: 'Food & Dining',
    description: 'Lunch at restaurant',
    date: new Date('2025-01-02'),
    createdAt: new Date('2025-01-02')
  },
  {
    id: '3',
    userId: '1',
    type: 'expense',
    amount: 15000,
    category: 'Bills & Utilities',
    description: 'Electricity bill',
    date: new Date('2025-01-03'),
    createdAt: new Date('2025-01-03')
  }
];

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const addTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    setTransactions(prev => [newTransaction, ...prev]);
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => 
      prev.map(transaction => 
        transaction.id === id ? { ...transaction, ...updates } : transaction
      )
    );
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(transaction => transaction.id !== id));
  };

  const addCategory = (category: Omit<Category, 'id'>) => {
    const newCategory: Category = {
      ...category,
      id: Date.now().toString()
    };
    setCategories(prev => [...prev, newCategory]);
  };

  const setBudget = (budget: Omit<Budget, 'id'>) => {
    const newBudget: Budget = {
      ...budget,
      id: Date.now().toString()
    };
    setBudgets(prev => {
      const existing = prev.find(b => 
        b.category === budget.category && 
        b.month === budget.month && 
        b.year === budget.year
      );
      if (existing) {
        return prev.map(b => b.id === existing.id ? newBudget : b);
      }
      return [...prev, newBudget];
    });
  };

  const searchTransactions = (query: string) => {
    return transactions.filter(transaction =>
      transaction.description.toLowerCase().includes(query.toLowerCase()) ||
      transaction.category.toLowerCase().includes(query.toLowerCase())
    );
  };

  const filterTransactions = (filters: any) => {
    return transactions.filter(transaction => {
      if (filters.type && transaction.type !== filters.type) return false;
      if (filters.category && transaction.category !== filters.category) return false;
      if (filters.dateRange) {
        const transactionDate = transaction.date;
        if (transactionDate < filters.dateRange.start || transactionDate > filters.dateRange.end) {
          return false;
        }
      }
      return true;
    });
  };

  const value: AppState = {
    transactions,
    categories,
    budgets,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    setBudget,
    searchTransactions,
    filterTransactions
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};