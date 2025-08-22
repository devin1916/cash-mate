import React from 'react';
import { ArrowUpRight, ArrowDownRight, MoreVertical } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatLKR } from '../../utils/currency';
import { format } from 'date-fns';

const RecentTransactions: React.FC = () => {
  const { transactions, categories } = useApp();

  const recentTransactions = transactions
    .slice(0, 8)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(c => c.name === categoryName);
    return category?.color || '#6b7280';
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>

      <div className="space-y-4">
        {recentTransactions.map((transaction) => (
          <div key={transaction.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${getCategoryColor(transaction.category)}20` }}
              >
                {transaction.type === 'income' ? (
                  <ArrowUpRight 
                    className="w-5 h-5" 
                    style={{ color: getCategoryColor(transaction.category) }}
                  />
                ) : (
                  <ArrowDownRight 
                    className="w-5 h-5" 
                    style={{ color: getCategoryColor(transaction.category) }}
                  />
                )}
              </div>
              
              <div>
                <p className="font-medium text-gray-900">{transaction.description}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span 
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ 
                      backgroundColor: `${getCategoryColor(transaction.category)}20`,
                      color: getCategoryColor(transaction.category)
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
                {transaction.type === 'income' ? '+' : '-'}{formatLKR(transaction.amount)}
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
            <p className="text-sm text-gray-400 mt-1">Start by adding your first transaction</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentTransactions;