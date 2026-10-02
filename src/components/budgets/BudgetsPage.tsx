import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, AlertTriangle, CheckCircle, Clock, Save, Target } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatMoney } from '../../utils/currency';
import { ApiError } from '../../api/client';
import { Budget } from '../../types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PRESET_THRESHOLDS = [50, 75, 90, 100];

const BudgetsPage: React.FC = () => {
  const { budgets, categories, setBudget, deleteBudget, fetchBudgets, settings, saveSettings } = useApp();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [formCategory, setFormCategory] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [thresholds, setThresholds] = useState<number[]>(PRESET_THRESHOLDS);
  const [customThreshold, setCustomThreshold] = useState('');
  const [savingThresholds, setSavingThresholds] = useState(false);

  useEffect(() => {
    fetchBudgets(month, year);
  }, [month, year, fetchBudgets]);  

  useEffect(() => {
    if (settings?.budgetAlertThresholds) setThresholds(settings.budgetAlertThresholds);
  }, [settings]);

  const resetForm = () => {
    setEditing(null);
    setFormCategory('');
    setFormAmount('');
    setFormMonth(month);
    setFormYear(year);
    setFormError(null);
    setShowForm(false);
  };

  const startEdit = (budget: Budget) => {
    setEditing(budget);
    setFormCategory(budget.categoryId || '');
    setFormAmount(String(budget.amount));
    setFormMonth(budget.month);
    setFormYear(budget.year);
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0) {
      setFormError('Budget amount must be greater than zero');
      return;
    }
    setSaving(true);
    try {
      await setBudget({
        id: editing?.id,
        categoryId: formCategory || null,
        amount,
        month: formMonth,
        year: formYear,
      });
      resetForm();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save budget');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this budget?')) {
      try {
        await deleteBudget(id);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Unable to delete budget');
      }
    }
  };

  const toggleThreshold = (t: number) => {
    setThresholds((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort((a, b) => a - b)));
  };

  const addCustomThreshold = () => {
    const n = parseInt(customThreshold, 10);
    if (!Number.isInteger(n) || n < 1 || n > 100) return;
    setThresholds((prev) => (prev.includes(n) ? prev : [...prev, n].sort((a, b) => a - b)));
    setCustomThreshold('');
  };

  const handleSaveThresholds = async () => {
    if (thresholds.length === 0) return;
    setSavingThresholds(true);
    try {
      await saveSettings({ budgetAlertThresholds: thresholds });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to save thresholds');
    }
    setSavingThresholds(false);
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const statusIcon = (pct: number) => {
    if (pct >= 90) return { icon: AlertTriangle, cls: 'text-red-600 bg-red-100' };
    if (pct >= 70) return { icon: Clock, cls: 'text-yellow-600 bg-yellow-100' };
    return { icon: CheckCircle, cls: 'text-green-600 bg-green-100' };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header + period picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Budgets</h2>
          <p className="text-sm text-gray-500">Track spending against your monthly limits</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {[0, 1, 2].map((d) => (
              <option key={d} value={now.getFullYear() - d}>{now.getFullYear() - d}</option>
            ))}
          </select>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Budget
          </button>
        </div>
      </div>

      {/* Create / edit form */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{editing ? 'Edit Budget' : 'Create Budget'}</h3>
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Overall budget</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount limit</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="30000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={formMonth}
                onChange={(e) => setFormMonth(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={formYear}
                onChange={(e) => setFormYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {[0, 1, 2].map((d) => (
                  <option key={d} value={now.getFullYear() - d}>{now.getFullYear() - d}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 disabled:opacity-50 transition-all duration-200"
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Budget list */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {budgets.map((budget) => {
          const pct = budget.percentUsed;
          const { icon: Icon, cls } = statusIcon(pct);
          return (
            <div key={budget.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-full ${cls}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-gray-900">{budget.category || 'Overall'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(budget)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                    aria-label="Edit budget"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                    aria-label="Delete budget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{pct.toFixed(0)}% used</span>
                  <span className="text-gray-500">{MONTHS[budget.month - 1]} {budget.year}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Spent <span className="font-semibold">{formatMoney(budget.spent)}</span></span>
                <span className="text-gray-600">Limit <span className="font-semibold">{formatMoney(budget.amount)}</span></span>
              </div>
              <div className="mt-2 text-sm">
                {budget.remaining >= 0 ? (
                  <span className="text-green-600 font-medium">{formatMoney(budget.remaining)} remaining</span>
                ) : (
                  <span className="text-red-600 font-medium">Over by {formatMoney(-budget.remaining)}</span>
                )}
              </div>
            </div>
          );
        })}

        {budgets.length === 0 && !showForm && (
          <div className="col-span-full bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center">
            <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No budgets for this period</p>
            <p className="text-sm text-gray-400 mt-1">
              Create a budget to track spending and get alerts at 50%, 75%, 90% and 100%.
            </p>
          </div>
        )}
      </div>

      {/* Alert thresholds */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center mb-1">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl mr-3">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Budget Alert Thresholds</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Get notified when a budget crosses any of these usage percentages.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_THRESHOLDS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleThreshold(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all duration-200 ${
                thresholds.includes(t)
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {t}%
            </button>
          ))}
          {thresholds.filter((t) => !PRESET_THRESHOLDS.includes(t)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleThreshold(t)}
              className="px-4 py-2 rounded-full text-sm font-medium border-2 bg-blue-50 border-blue-500 text-blue-700"
            >
              {t}% ×
            </button>
          ))}
          <div className="flex items-center gap-2 ml-2">
            <input
              type="number"
              min={1}
              max={100}
              value={customThreshold}
              onChange={(e) => setCustomThreshold(e.target.value)}
              placeholder="Custom"
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addCustomThreshold}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Add
            </button>
          </div>
          <button
            onClick={handleSaveThresholds}
            disabled={savingThresholds || thresholds.length === 0}
            className="ml-auto flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg text-sm hover:from-blue-600 hover:to-teal-600 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {savingThresholds ? 'Saving...' : 'Save Thresholds'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BudgetsPage;
