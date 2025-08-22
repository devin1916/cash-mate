import React from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatLKR } from '../../utils/currency';

const BudgetOverview: React.FC = () => {
  const { budgets, transactions } = useApp();

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Calculate current month spending by category
  const currentMonthExpenses = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return t.type === 'expense' && 
           transactionDate.getMonth() === currentMonth && 
           transactionDate.getFullYear() === currentYear;
  });

  const spendingByCategory = currentMonthExpenses.reduce((acc, transaction) => {
    const category = transaction.category;
    acc[category] = (acc[category] || 0) + transaction.amount;
    return acc;
  }, {} as Record<string, number>);

  // Mock budgets for demonstration
  const mockBudgets = [
    { id: '1', userId: '1', category: 'Food & Dining', limit: 25000, spent: spendingByCategory['Food & Dining'] || 0, month: currentMonth, year: currentYear },
    { id: '2', userId: '1', category: 'Transportation', limit: 15000, spent: spendingByCategory['Transportation'] || 0, month: currentMonth, year: currentYear },
    { id: '3', userId: '1', category: 'Entertainment', limit: 10000, spent: spendingByCategory['Entertainment'] || 0, month: currentMonth, year: currentYear },
    { id: '4', userId: '1', category: 'Bills & Utilities', limit: 30000, spent: spendingByCategory['Bills & Utilities'] || 0, month: currentMonth, year: currentYear },
  ];

  const currentBudgets = budgets.length > 0 ? budgets : mockBudgets;

  const getBudgetStatus = (spent: number, limit: number) => {
    const percentage = (spent / limit) * 100;
    if (percentage >= 90) return { status: 'over', color: 'text-red-600', bgColor: 'bg-red-100', icon: AlertTriangle };
    if (percentage >= 70) return { status: 'warning', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock };
    return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle };
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Budget Overview</h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          Manage
        </button>
      </div>

      <div className="space-y-4">
        {currentBudgets.map((budget) => {
          const percentage = (budget.spent / budget.limit) * 100;
          const budgetInfo = getBudgetStatus(budget.spent, budget.limit);
          const Icon = budgetInfo.icon;

          return (
            <div key={budget.id} className="p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors duration-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`p-1 rounded-full ${budgetInfo.bgColor}`}>
                    <Icon className={`w-4 h-4 ${budgetInfo.color}`} />
                  </div>
                  <span className="font-medium text-gray-900">{budget.category}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {percentage.toFixed(0)}% used
                </span>
              </div>

              <div className="mb-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      percentage >= 90 ? 'bg-red-500' :
                      percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Spent: {formatLKR(budget.spent)}
                </span>
                <span className="text-gray-600">
                  Limit: {formatLKR(budget.limit)}
                </span>
              </div>

              {budget.spent > budget.limit && (
                <div className="mt-2 p-2 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">
                    Over budget by {formatLKR(budget.spent - budget.limit)}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {currentBudgets.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No budgets set</p>
            <p className="text-sm text-gray-400 mt-1">Create your first budget to track spending</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetOverview;