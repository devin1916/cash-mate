import React from 'react';
import { ArrowUpRight, ArrowDownRight, MoreVertical } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatMoney } from '../../utils/currency';
import { format } from 'date-fns';

const RecentTransactions: React.FC = () => {
  const { summary } = useApp();
  const recentTransactions = summary?.recent ?? [];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
      </div>

      <div className="space-y-4">
        {recentTransactions.map((transaction) => (
          <div key={transaction.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${transaction.categoryColor || '#6b7280'}20` }}
              >
                {transaction.type === 'income' ? (
                  <ArrowUpRight 
                    className="w-5 h-5" 
                    style={{ color: transaction.categoryColor || '#6b7280' }}
                  />
                ) : (
                  <ArrowDownRight 
                    className="w-5 h-5" 
                    style={{ color: transaction.categoryColor || '#6b7280' }}
                  />
                )}
              </div>
              
              <div>
                <p className="font-medium text-gray-900">{transaction.description}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span 
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ 
                      backgroundColor: `${transaction.categoryColor || '#6b7280'}20`,
                      color: transaction.categoryColor || '#6b7280'
                    }}
                  >
                    {transaction.category}
                  </span>
                  <span className="text-xs text-gray-500">
                    {format(new Date(transaction.date), 'MMM dd, yyyy')}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <span 
                className={`font-semibold ${
                  transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {transaction.type === 'income' ? '+' : '-'}{formatMoney(transaction.amount)}
              </span>
              
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        
        {recentTransactions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No transactions yet</p>
            <p className="text-sm text-gray-400 mt-1">Start tracking your income and expenses to see your financial activity here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentTransactions;
