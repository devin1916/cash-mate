import React, { useState } from 'react';
import { Plus, Trash2, Pencil, Play, Pause, RefreshCw, CalendarClock, Repeat, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatMoney, getCurrency } from '../../utils/currency';
import { ApiError } from '../../api/client';
import { RecurringRule } from '../../types';
import Modal from '../ui/Modal';

const emptyForm = {
  type: 'expense' as 'income' | 'expense',
  amount: '',
  categoryId: '',
  paymentMethodId: '',
  description: '',
  notes: '',
  frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
};

const RecurringPage: React.FC = () => {
  const { recurring, categories, paymentMethods, saveRecurring, deleteRecurring, runRecurring } = useApp();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, startDate: new Date().toISOString().split('T')[0] });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (rule: RecurringRule) => {
    setEditing(rule);
    setForm({
      type: rule.type,
      amount: String(rule.amount),
      categoryId: rule.categoryId,
      paymentMethodId: rule.paymentMethodId || '',
      description: rule.description,
      notes: rule.notes || '',
      frequency: rule.frequency,
      startDate: rule.startDate,
      endDate: rule.endDate || '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return setFormError('Amount must be greater than zero');
    if (!form.categoryId) return setFormError('Please choose a category');
    if (!form.description.trim()) return setFormError('Description is required');

    setSaving(true);
    try {
      await saveRecurring({
        id: editing?.id,
        type: form.type,
        amount,
        categoryId: form.categoryId,
        paymentMethodId: form.paymentMethodId || null,
        description: form.description.trim(),
        notes: form.notes.trim() || null,
        frequency: form.frequency,
        startDate: form.startDate,
        endDate: form.endDate || null,
      });
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save schedule');
    }
    setSaving(false);
  };

  const handleToggle = async (rule: RecurringRule) => {
    setBusyId(rule.id);
    try {
      await saveRecurring({ id: rule.id, status: rule.status === 'active' ? 'paused' : 'active' });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to update schedule');
    }
    setBusyId(null);
  };

  const handleRun = async (rule: RecurringRule) => {
    setBusyId(rule.id);
    try {
      await runRecurring(rule.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to generate transaction');
    }
    setBusyId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this schedule? Already generated transactions are kept.')) {
      try {
        await deleteRecurring(id);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Unable to delete schedule');
      }
    }
  };

  const filtered = categories.filter((c) => c.type === form.type);

  const statusBadge = (status: RecurringRule['status']) => {
    if (status === 'active') return <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">Active</span>;
    if (status === 'paused') return <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Paused</span>;
    return <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">Completed</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recurring Transactions</h2>
          <p className="text-sm text-gray-500">Salary, rent, subscriptions - generated automatically</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Schedule
        </button>
      </div>

      <div className="space-y-4">
        {recurring.map((rule) => (
          <div key={rule.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-xl ${rule.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                  <Repeat className={`w-5 h-5 ${rule.type === 'income' ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{rule.description}</h3>
                    {statusBadge(rule.status)}
                  </div>
                  <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
                    <span className="font-medium" style={{ color: rule.categoryColor || undefined }}>
                      {rule.category}
                    </span>
                    <span className="capitalize">{rule.frequency}</span>
                    {rule.paymentMethod && <span>{rule.paymentMethod}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <div className="text-right">
                  <p className={`text-lg font-bold ${rule.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {rule.type === 'income' ? '+' : '-'}{formatMoney(rule.amount)}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center justify-end">
                    <CalendarClock className="w-3.5 h-3.5 mr-1" />
                    Next: {rule.status === 'active' ? rule.nextRunDate : 'paused'}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(rule)}
                    disabled={busyId === rule.id || rule.status === 'completed'}
                    className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all duration-200 disabled:opacity-40"
                    aria-label={rule.status === 'active' ? 'Pause schedule' : 'Resume schedule'}
                    title={rule.status === 'active' ? 'Pause' : 'Resume'}
                  >
                    {rule.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleRun(rule)}
                    disabled={busyId === rule.id || rule.status === 'completed'}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 disabled:opacity-40"
                    aria-label="Generate transaction now"
                    title="Generate transaction now"
                  >
                    <RefreshCw className={`w-4 h-4 ${busyId === rule.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => openEdit(rule)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                    aria-label="Edit schedule"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                    aria-label="Delete schedule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {recurring.length === 0 && (
          <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center">
            <RefreshCw className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No recurring transactions</p>
            <p className="text-sm text-gray-400 mt-1">
              Set up monthly salary, rent or subscriptions and CashMate will create them for you.
            </p>
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Schedule' : 'New Recurring Transaction'} wide>
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start">
            <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'expense', categoryId: '' })}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                form.type === 'expense' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'income', categoryId: '' })}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                form.type === 'income' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              Income
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({getCurrency()})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as typeof form.frequency })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">Select category</option>
                {filtered.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment method (optional)</label>
              <select
                value={form.paymentMethodId}
                onChange={(e) => setForm({ ...form, paymentMethodId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">None</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Monthly rent"
              maxLength={255}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End date (optional)</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              maxLength={5000}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update Schedule' : 'Create Schedule'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RecurringPage;
