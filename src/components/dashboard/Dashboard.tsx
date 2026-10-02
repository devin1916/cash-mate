import React from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../utils/currency';
import StatsCard from './StatsCard';
import RecentTransactions from './RecentTransactions';
import ExpenseChart from './ExpenseChart';
import BudgetOverview from './BudgetOverview';

const Dashboard: React.FC = () => {
  const { summary } = useApp();
  const { user } = useAuth();

  const totals = summary?.totals;
  const previous = summary?.previous;

  const income = totals?.income ?? 0;
  const expenses = totals?.expenses ?? 0;
  const balance = totals?.lifetimeBalance ?? 0;
  const savingsRate = totals?.savingsRate ?? 0;

  const prevIncome = previous?.income ?? 0;
  const prevExpenses = previous?.expenses ?? 0;

  const incomeChange = prevIncome === 0 ? 0 : ((income - prevIncome) / prevIncome) * 100;
  const expenseChange = prevExpenses === 0 ? 0 : ((expenses - prevExpenses) / prevExpenses) * 100;
  const balanceChange = (income - expenses) - (previous?.balance ?? 0);

  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Balance"
          value={formatMoney(balance, user?.currency)}
          change={balanceChange >= 0 ? `+${formatMoney(balanceChange, user?.currency)}` : formatMoney(balanceChange, user?.currency)}
          changeType={balanceChange >= 0 ? 'positive' : 'negative'}
          icon={Wallet}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        
        <StatsCard
          title="Income (This Month)"
          value={formatMoney(income, user?.currency)}
          change={`${incomeChange >= 0 ? '+' : ''}${incomeChange.toFixed(1)}%`}
          changeType={incomeChange >= 0 ? 'positive' : 'negative'}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-green-500 to-green-600"
        />
        
        <StatsCard
          title="Expenses (This Month)"
          value={formatMoney(expenses, user?.currency)}
          change={`${expenseChange >= 0 ? '+' : ''}${expenseChange.toFixed(1)}%`}
          changeType={expenseChange >= 0 ? 'negative' : 'positive'}
          icon={TrendingDown}
          gradient="bg-gradient-to-br from-red-500 to-red-600"
        />
        
        <StatsCard
          title="Savings Rate"
          value={`${savingsRate}%`}
          change="This month"
          changeType="neutral"
          icon={Target}
          gradient="bg-gradient-to-br from-purple-500 to-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <RecentTransactions />
        </div>

        {/* Budget Overview */}
        <div>
          <BudgetOverview />
        </div>
      </div>

      {/* Expense Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <ExpenseChart />
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-teal-50 p-6 rounded-2xl border border-blue-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-center p-4 bg-white rounded-xl shadow-sm transition-shadow duration-200 border border-gray-100">
            <ArrowDownRight className="w-5 h-5 text-red-500 mr-2" />
            <span className="font-medium text-gray-900">Add Expense</span>
          </div>
          
          <div className="flex items-center justify-center p-4 bg-white rounded-xl shadow-sm transition-shadow duration-200 border border-gray-100">
            <ArrowUpRight className="w-5 h-5 text-green-500 mr-2" />
            <span className="font-medium text-gray-900">Add Income</span>
          </div>
          
          <div className="flex items-center justify-center p-4 bg-white rounded-xl shadow-sm transition-shadow duration-200 border border-gray-100">
            <Calendar className="w-5 h-5 text-blue-500 mr-2" />
            <span className="font-medium text-gray-900">View Reports</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
