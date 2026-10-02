import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle, AlertTriangle, Receipt, Clock, Bell, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatMoney, getCurrency } from '../../utils/currency';
import { ApiError } from '../../api/client';
import { Bill } from '../../types';
import Modal from '../ui/Modal';

const emptyForm = {
  name: '',
  amount: '',
  dueDate: '',
  frequency: 'monthly' as 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly',
  categoryId: '',
  paymentMethodId: '',
  reminderDaysBefore: '3',
};

type StatusTab = 'all' | 'upcoming' | 'overdue' | 'paid';

const BillsPage: React.FC = () => {
  const { bills, categories, paymentMethods, saveBill, payBill, deleteBill } = useApp();

  const [tab, setTab] = useState<StatusTab>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, dueDate: '' });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (bill: Bill) => {
    setEditing(bill);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      dueDate: bill.dueDate,
      frequency: bill.frequency,
      categoryId: bill.categoryId || '',
      paymentMethodId: bill.paymentMethodId || '',
      reminderDaysBefore: String(bill.reminderDaysBefore),
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return setFormError('Amount must be greater than zero');
    if (!form.name.trim()) return setFormError('Bill name is required');
    if (!form.dueDate) return setFormError('Due date is required');

    setSaving(true);
    try {
      await saveBill({
        id: editing?.id,
        name: form.name.trim(),
        amount,
        dueDate: form.dueDate,
        frequency: form.frequency,
        categoryId: form.categoryId || null,
        paymentMethodId: form.paymentMethodId || null,
        reminderDaysBefore: parseInt(form.reminderDaysBefore, 10),
      });
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save bill');
    }
    setSaving(false);
  };

  const handlePay = async (bill: Bill) => {
    setBusyId(bill.id);
    try {
      await payBill(bill.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to mark as paid');
    }
    setBusyId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this bill?')) {
      try {
        await deleteBill(id);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Unable to delete bill');
      }
    }
  };

  const filtered = bills.filter((b) => tab === 'all' || b.status === tab);
  const openBills = bills.filter((b) => b.status !== 'paid');
  const overdueCount = openBills.filter((b) => b.status === 'overdue').length;
  const dueSoonCount = openBills.filter((b) => b.daysUntilDue >= 0 && b.daysUntilDue <= 7).length;
  const openTotal = openBills.reduce((s, b) => s + b.amount, 0);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const statusBadge = (bill: Bill) => {
    if (bill.status === 'paid')
      return <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">Paid</span>;
    if (bill.status === 'overdue')
      return <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">Overdue</span>;
    return <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">Upcoming</span>;
  };

  const dueLabel = (bill: Bill) => {
    if (bill.status === 'paid') return `Paid ${bill.paidAt?.slice(0, 10) || ''}`;
    if (bill.daysUntilDue < 0) return `Due ${Math.abs(bill.daysUntilDue)} day${Math.abs(bill.daysUntilDue) === 1 ? '' : 's'} ago`;
    if (bill.daysUntilDue === 0) return 'Due today';
    return `Due in ${bill.daysUntilDue} day${bill.daysUntilDue === 1 ? '' : 's'}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bills & Reminders</h2>
          <p className="text-sm text-gray-500">Never miss a payment again</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Bill
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-100 rounded-xl mr-4">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Due in 7 days</p>
            <p className="text-xl font-bold text-gray-900">{dueSoonCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-red-100 rounded-xl mr-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Overdue</p>
            <p className="text-xl font-bold text-gray-900">{overdueCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-amber-100 rounded-xl mr-4">
            <Receipt className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Open total</p>
            <p className="text-xl font-bold text-gray-900">{formatMoney(openTotal)}</p>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center space-x-2">
        {(['all', 'upcoming', 'overdue', 'paid'] as StatusTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-all duration-200 ${
              tab === t ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Bill list */}
      <div className="space-y-4">
        {filtered.map((bill) => (
          <div key={bill.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div
                  className={`p-3 rounded-xl ${
                    bill.status === 'overdue' ? 'bg-red-100' : bill.status === 'paid' ? 'bg-green-100' : 'bg-blue-100'
                  }`}
                >
                  <Receipt className={`w-5 h-5 ${bill.status === 'overdue' ? 'text-red-600' : bill.status === 'paid' ? 'text-green-600' : 'text-blue-600'}`} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{bill.name}</h3>
                    {statusBadge(bill)}
                    {bill.frequency !== 'none' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{bill.frequency}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      {bill.dueDate}
                    </span>
                    <span className={bill.status !== 'paid' && bill.daysUntilDue < 0 ? 'text-red-600 font-medium' : ''}>
                      {dueLabel(bill)}
                    </span>
                    {bill.category && <span style={{ color: bill.categoryColor || undefined }}>{bill.category}</span>}
                    <span className="flex items-center">
                      <Bell className="w-3.5 h-3.5 mr-1" />
                      {bill.reminderDaysBefore}d before
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <p className="text-lg font-bold text-gray-900">{formatMoney(bill.amount)}</p>
                <div className="flex items-center gap-1">
                  {bill.status !== 'paid' && (
                    <button
                      onClick={() => handlePay(bill)}
                      disabled={busyId === bill.id}
                      className="flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-all duration-200 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {busyId === bill.id ? 'Saving...' : 'Mark Paid'}
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(bill)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                    aria-label="Edit bill"
                  >
                    <Plus className="w-4 h-4 rotate-45" />
                  </button>
                  <button
                    onClick={() => handleDelete(bill.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                    aria-label="Delete bill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No bills here</p>
            <p className="text-sm text-gray-400 mt-1">
              Add electricity, internet, rent or subscriptions to get reminders before they are due.
            </p>
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Bill' : 'New Bill'} wide>
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Electricity"
                maxLength={120}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repeats</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as typeof form.frequency })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remind me</label>
              <select
                value={form.reminderDaysBefore}
                onChange={(e) => setForm({ ...form, reminderDaysBefore: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="0">On the due date</option>
                <option value="1">1 day before</option>
                <option value="3">3 days before</option>
                <option value="7">7 days before</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">None</option>
                {expenseCategories.map((c) => (
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

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update Bill' : 'Create Bill'}
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

export default BillsPage;
