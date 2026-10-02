import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import type { TooltipItem } from 'chart.js';
import { useApp } from '../../context/AppContext';
import { getCurrency, formatMoney } from '../../utils/currency';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ExpenseChart: React.FC = () => {
  const { summary } = useApp();

  const breakdown = summary?.categoryBreakdown ?? [];
  const categoryNames = breakdown.map((c) => c.category);
  const categoryAmounts = breakdown.map((c) => c.amount);

  const doughnutData = {
    labels: categoryNames,
    datasets: [
      {
        data: categoryAmounts,
        backgroundColor: breakdown.map((c) => c.color || '#6b7280'),
        borderColor: breakdown.map((c) => c.color || '#6b7280'),
        borderWidth: 2,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: true,
        text: 'Expenses by Category',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'doughnut'>) => ` ${ctx.label}: ${formatMoney(Number(ctx.parsed))}`,
        },
      },
    },
    maintainAspectRatio: false,
  };

  // Monthly income vs expenses from the API (last 6 months, server-side)
  const monthly = summary?.monthly ?? [];
  const labels = monthly.map((m) => MONTH_LABELS[m.month - 1] || m.month);

  const barData = {
    labels,
    datasets: [
      {
        label: 'Income',
        data: monthly.map((m) => m.income),
        backgroundColor: '#10b981',
        borderRadius: 6,
      },
      {
        label: 'Expenses',
        data: monthly.map((m) => m.expenses),
        backgroundColor: '#ef4444',
        borderRadius: 6,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Income vs Expenses - Last 6 Months',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value: string | number) {
            return `${getCurrency()} ${Number(value).toLocaleString()}`;
          },
        },
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Doughnut Chart */}
        <div className="bg-gray-50 p-4 rounded-xl">
          <div className="h-64">
            {categoryNames.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p>No expense data available</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add expenses to see your spending breakdown
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Category Breakdown</h4>
          <div className="space-y-3">
            {breakdown.map((item) => {
              const total = categoryAmounts.reduce((sum, amt) => sum + amt, 0);
              const percentage = total > 0 ? (item.amount / total) * 100 : 0;

              return (
                <div key={item.categoryId} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color || '#6b7280' }}
                    />
                    <span className="text-sm font-medium text-gray-700">{item.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatMoney(item.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
            {breakdown.length === 0 && (
              <p className="text-sm text-gray-400">No spending recorded for this period.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-gray-50 p-4 rounded-xl">
        <div className="h-80">
          {monthly.length > 0 ? (
            <Bar data={barData} options={barOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Add income and expenses to see your monthly trends
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseChart;
