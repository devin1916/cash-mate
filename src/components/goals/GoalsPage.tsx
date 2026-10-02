import React, { useState } from 'react';
import { Plus, Trash2, Pencil, PiggyBank, Target, Calendar, TrendingUp, Coins } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatMoney, getCurrency } from '../../utils/currency';
import { ApiError } from '../../api/client';
import { Goal } from '../../types';
import Modal from '../ui/Modal';

const emptyForm = { name: '', targetAmount: '', targetDate: '', description: '' };

const GoalsPage: React.FC = () => {
  const { goals, saveGoal, deleteGoal, contributeToGoal } = useApp();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [contribGoal, setContribGoal] = useState<Goal | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribDate, setContribDate] = useState(new Date().toISOString().split('T')[0]);
  const [contribNote, setContribNote] = useState('');
  const [contribError, setContribError] = useState<string | null>(null);
  const [contribSaving, setContribSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      targetDate: goal.targetDate || '',
      description: goal.description || '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const targetAmount = parseFloat(form.targetAmount);
    if (!targetAmount || targetAmount <= 0) {
      setFormError('Target amount must be greater than zero');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Goal name is required');
      return;
    }
    setSaving(true);
    try {
      await saveGoal({
        id: editing?.id,
        name: form.name.trim(),
        targetAmount,
        targetDate: form.targetDate || null,
        description: form.description.trim() || null,
      });
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save goal');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this savings goal and its contribution history?')) {
      try {
        await deleteGoal(id);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Unable to delete goal');
      }
    }
  };

  const submitContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribGoal) return;
    setContribError(null);
    const amount = parseFloat(contribAmount);
    if (!amount || amount <= 0) {
      setContribError('Amount must be greater than zero');
      return;
    }
    setContribSaving(true);
    try {
      await contributeToGoal(contribGoal.id, { amount, date: contribDate, note: contribNote || null });
      setContribGoal(null);
      setContribAmount('');
      setContribNote('');
    } catch (err) {
      setContribError(err instanceof ApiError ? err.message : 'Unable to add contribution');
    }
    setContribSaving(false);
  };

  const statusBadge = (status: Goal['status']) => {
    if (status === 'completed') return <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">Completed</span>;
    if (status === 'archived') return <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">Archived</span>;
    return <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">Active</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Savings Goals</h2>
          <p className="text-sm text-gray-500">Set targets and watch your savings grow</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Goal
        </button>
      </div>

      {/* Goal cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {goals.map((goal) => (
          <div key={goal.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <PiggyBank className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{goal.name}</h3>
                  <div className="mt-1">{statusBadge(goal.status)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(goal)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                  aria-label="Edit goal"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                  aria-label="Delete goal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-gray-900">{formatMoney(goal.currentAmount)}</span>
                <span className="text-gray-500">of {formatMoney(goal.targetAmount)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    goal.percentUsed >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'
                  }`}
                  style={{ width: `${Math.min(goal.percentUsed, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{goal.percentUsed}% complete</p>
            </div>

            <div className="space-y-1.5 text-sm text-gray-600 mb-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center"><Target className="w-4 h-4 mr-2 text-gray-400" />Remaining</span>
                <span className="font-medium">{formatMoney(goal.remaining)}</span>
              </div>
              {goal.targetDate && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-gray-400" />Target date</span>
                  <span className="font-medium">{goal.targetDate} {goal.daysLeft !== null && goal.daysLeft > 0 ? `(${goal.daysLeft}d left)` : ''}</span>
                </div>
              )}
              {goal.requiredMonthly !== null && goal.remaining > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center"><TrendingUp className="w-4 h-4 mr-2 text-gray-400" />Needed / month</span>
                  <span className="font-medium">{formatMoney(goal.requiredMonthly)}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => { setContribGoal(goal); setContribError(null); }}
              disabled={goal.status !== 'active'}
              className="w-full flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium"
            >
              <Coins className="w-4 h-4 mr-2" />
              Add Money
            </button>
          </div>
        ))}

        {goals.length === 0 && (
          <div className="col-span-full bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center">
            <PiggyBank className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No savings goals yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Create a goal like "Emergency fund" or "New laptop" and start saving towards it.
            </p>
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Goal' : 'New Savings Goal'}>
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Emergency fund"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              maxLength={120}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target amount ({getCurrency()})</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.targetAmount}
              onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
              placeholder="100000"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target date (optional)</label>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              maxLength={2000}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="What is this goal for?"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update Goal' : 'Create Goal'}
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

      {/* Contribution modal */}
      <Modal open={Boolean(contribGoal)} onClose={() => setContribGoal(null)} title={`Add money to "${contribGoal?.name || ''}"`}>
        {contribError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{contribError}</div>
        )}
        <form onSubmit={submitContribution} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({getCurrency()})</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={contribAmount}
              onChange={(e) => setContribAmount(e.target.value)}
              placeholder="5000"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={contribDate}
              onChange={(e) => setContribDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
            <input
              type="text"
              value={contribNote}
              onChange={(e) => setContribNote(e.target.value)}
              maxLength={255}
              placeholder="e.g. monthly saving"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={contribSaving}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 disabled:opacity-50"
            >
              {contribSaving ? 'Adding...' : 'Add Contribution'}
            </button>
            <button
              type="button"
              onClick={() => setContribGoal(null)}
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

export default GoalsPage;
