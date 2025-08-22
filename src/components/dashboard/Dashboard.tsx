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
import { formatLKR } from '../../utils/currency';
import StatsCard from './StatsCard';
import RecentTransactions from './RecentTransactions';
import ExpenseChart from './ExpenseChart';
import BudgetOverview from './BudgetOverview';

const Dashboard: React.FC = () => {
  const { transactions } = useApp();

  // Calculate stats
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate.getMonth() === currentMonth && 
           transactionDate.getFullYear() === currentYear;
  });

  const totalIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  // Previous month for comparison
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  
  const prevMonthTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate.getMonth() === prevMonth && 
           transactionDate.getFullYear() === prevYear;
  });

  const prevTotalIncome = prevMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const prevTotalExpenses = prevMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const incomeChange = prevTotalIncome === 0 ? 0 : 
    ((totalIncome - prevTotalIncome) / prevTotalIncome * 100);
  
  const expenseChange = prevTotalExpenses === 0 ? 0 : 
    ((totalExpenses - prevTotalExpenses) / prevTotalExpenses * 100);

  const balanceChange = balance - (prevTotalIncome - prevTotalExpenses);

  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Current Balance"
          value={formatLKR(balance)}
          change={balanceChange >= 0 ? `+${formatLKR(balanceChange)}` : formatLKR(balanceChange)}
          changeType={balanceChange >= 0 ? 'positive' : 'negative'}
          icon={Wallet}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        
        <StatsCard
          title="Total Income"
          value={formatLKR(totalIncome)}
          change={`${incomeChange >= 0 ? '+' : ''}${incomeChange.toFixed(1)}%`}
          changeType={incomeChange >= 0 ? 'positive' : 'negative'}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-green-500 to-green-600"
        />
        
        <StatsCard
          title="Total Expenses"
          value={formatLKR(totalExpenses)}
          change={`${expenseChange >= 0 ? '+' : ''}${expenseChange.toFixed(1)}%`}
          changeType={expenseChange >= 0 ? 'negative' : 'positive'}
          icon={TrendingDown}
          gradient="bg-gradient-to-br from-red-500 to-red-600"
        />
        
        <StatsCard
          title="Savings Rate"
          value={`${totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0}%`}
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
          <button className="flex items-center justify-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100">
            <ArrowDownRight className="w-5 h-5 text-red-500 mr-2" />
            <span className="font-medium text-gray-900">Add Expense</span>
          </button>
          
          <button className="flex items-center justify-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100">
            <ArrowUpRight className="w-5 h-5 text-green-500 mr-2" />
            <span className="font-medium text-gray-900">Add Income</span>
          </button>
          
          <button className="flex items-center justify-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100">
            <Calendar className="w-5 h-5 text-blue-500 mr-2" />
            <span className="font-medium text-gray-900">View Reports</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;