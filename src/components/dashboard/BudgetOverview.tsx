import React from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatMoney } from '../../utils/currency';

const BudgetOverview: React.FC = () => {
  const { budgets } = useApp();

  const getBudgetStatus = (percentUsed: number) => {
    if (percentUsed >= 90) return { status: 'over', color: 'text-red-600', bgColor: 'bg-red-100', icon: AlertTriangle };
    if (percentUsed >= 70) return { status: 'warning', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock };
    return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle };
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Budget Overview</h3>
      </div>

      <div className="space-y-4">
        {budgets.map((budget) => {
          const percentage = budget.percentUsed;
          const budgetInfo = getBudgetStatus(percentage);
          const Icon = budgetInfo.icon;
          const label = budget.category || 'Overall';

          return (
            <div key={budget.id} className="p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors duration-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`p-1 rounded-full ${budgetInfo.bgColor}`}>
                    <Icon className={`w-4 h-4 ${budgetInfo.color}`} />
                  </div>
                  <span className="font-medium text-gray-900">{label}</span>
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
                  Spent: {formatMoney(budget.spent)}
                </span>
                <span className="text-gray-600">
                  Limit: {formatMoney(budget.amount)}
                </span>
              </div>

              {budget.spent > budget.amount && (
                <div className="mt-2 p-2 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">
                    Over budget by {formatMoney(budget.spent - budget.amount)}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {budgets.length === 0 && (
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
