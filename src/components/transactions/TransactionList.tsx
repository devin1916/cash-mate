import React, { useEffect, useState, useCallback } from 'react';
import { Search, Filter, Download, Edit, Trash2, Calendar, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatMoney } from '../../utils/currency';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, TransactionFilters } from '../../types';
import EditTransactionModal from './EditTransactionModal';

const TransactionList: React.FC = () => {
  const { transactions, transactionsMeta, categories, paymentMethods, fetchTransactions, deleteTransaction, loading } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sort, setSort] = useState<'date' | 'amount' | 'description'>('date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const buildFilters = useCallback(
    (targetPage: number): TransactionFilters => ({
      page: targetPage,
      limit: 10,
      search: searchQuery || undefined,
      type: filterType,
      categoryId: filterCategory || undefined,
      paymentMethodId: filterMethod || undefined,
      from: dateRange.start || undefined,
      to: dateRange.end || undefined,
      sort,
      order,
    }),
    [searchQuery, filterType, filterCategory, filterMethod, dateRange, sort, order]
  );

  // Fetch when filters change (search debounced) or page changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions(buildFilters(page));
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [buildFilters, fetchTransactions, page, searchQuery]);

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [filterType, filterCategory, filterMethod, sort, order]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteTransaction(id);
      } catch {
        alert('Unable to delete this transaction');
      }
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      // Export everything matching the current filters (up to 500 rows)
      const exportFilters = { ...buildFilters(1), limit: 500 };
      await fetchTransactions(exportFilters);
      await new Promise((r) => setTimeout(r, 350));

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Transactions', 14, 16);
      doc.setFontSize(10);
      doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd')}`, 14, 21);

      const tableColumn = ['Date', 'Description', 'Category', 'Type', 'Amount'];
      const tableRows: string[][] = [];

      transactions.forEach((transaction) => {
        tableRows.push([
          format(new Date(transaction.date), 'yyyy-MM-dd'),
          transaction.description,
          transaction.category,
          transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
          formatMoney(transaction.amount),
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 24,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save('transactions.pdf');
    } finally {
      setExporting(false);
      fetchTransactions(buildFilters(page));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
          <p className="text-sm text-gray-500">{transactionsMeta.total} total transactions</p>
        </div>
        <button
          onClick={exportToPDF}
          disabled={exporting}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-200 disabled:opacity-50"
        >
          <Download className="w-4 h-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transactions..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'income' | 'expense')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">All Payment Methods</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={`${sort}-${order}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split('-');
                setSort(s as 'date' | 'amount' | 'description');
                setOrder(o as 'asc' | 'desc');
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-desc">Highest amount</option>
              <option value="amount-asc">Lowest amount</option>
              <option value="description-asc">Description A-Z</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No transactions found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or add your first transaction.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: transaction.categoryColor || '#6b7280' }}
                    >
                      {transaction.category?.charAt(0) || '?'}
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900">{transaction.description}</h3>
                      <div className="flex items-center space-x-3 mt-1 flex-wrap">
                        <span
                          className="text-xs px-3 py-1 rounded-full font-medium"
                          style={{
                            backgroundColor: `${transaction.categoryColor || '#6b7280'}20`,
                            color: transaction.categoryColor || '#6b7280'
                          }}
                        >
                          {transaction.category}
                        </span>
                        <span className="text-sm text-gray-500">
                          {format(new Date(transaction.date), 'MMM dd, yyyy')}
                        </span>
                        {transaction.paymentMethod && (
                          <span className="text-xs text-gray-400">{transaction.paymentMethod}</span>
                        )}
                        {transaction.status === 'pending' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span
                      className={`text-lg font-bold ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}{formatMoney(transaction.amount)}
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditing(transaction)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                        aria-label="Edit transaction"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                        aria-label="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {transactionsMeta.total > 0 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {transactionsMeta.page} of {transactionsMeta.totalPages} ({transactionsMeta.total} transactions)
            </span>
            <button
              onClick={() => setPage((p) => Math.min(transactionsMeta.totalPages, p + 1))}
              disabled={page >= transactionsMeta.totalPages}
              className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>

      <EditTransactionModal transaction={editing} onClose={() => setEditing(null)} />
    </div>
  );
};

export default TransactionList;
