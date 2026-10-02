import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  AlertTriangle,
  AlertOctagon,
  CalendarClock,
  PiggyBank,
  RefreshCw,
  TrendingUp,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../api/client';
import { AppNotification } from '../../types';

const ICONS: Record<AppNotification['type'], { icon: typeof Bell; cls: string }> = {
  budget_warning: { icon: AlertTriangle, cls: 'bg-amber-100 text-amber-600' },
  budget_exceeded: { icon: AlertOctagon, cls: 'bg-red-100 text-red-600' },
  bill_reminder: { icon: CalendarClock, cls: 'bg-blue-100 text-blue-600' },
  goal_progress: { icon: PiggyBank, cls: 'bg-purple-100 text-purple-600' },
  recurring_created: { icon: RefreshCw, cls: 'bg-teal-100 text-teal-600' },
  unusual_spending: { icon: TrendingUp, cls: 'bg-orange-100 text-orange-600' },
  account: { icon: Info, cls: 'bg-gray-100 text-gray-600' },
  system: { icon: Info, cls: 'bg-gray-100 text-gray-600' },
};

const NotificationsPage: React.FC = () => {
  const {
    notifications,
    notificationsMeta,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearNotifications,
  } = useApp();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const visible = unreadOnly ? notifications.filter((n) => !n.isRead) : notifications;

  const handleMarkAll = async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to update notifications');
    }
    setBusy(false);
  };

  const handleClear = async () => {
    if (confirm('Delete all notifications?')) {
      try {
        await clearNotifications();
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Unable to clear notifications');
      }
    }
  };

  const handleItemClick = async (n: AppNotification) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(n.id);
      } catch {
        /* non-critical */
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to delete notification');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500">
            {notificationsMeta.unread > 0 ? `You have ${notificationsMeta.unread} unread notifications` : 'You are all caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
              unreadOnly ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <BellOff className="w-4 h-4 inline mr-1.5" />
            Unread only
          </button>
          <button
            onClick={handleMarkAll}
            disabled={busy || notificationsMeta.unread === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
          >
            <CheckCheck className="w-4 h-4 inline mr-1.5" />
            Mark all read
          </button>
          <button
            onClick={handleClear}
            disabled={notifications.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all duration-200"
          >
            <Trash2 className="w-4 h-4 inline mr-1.5" />
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {visible.map((n) => {
          const meta = ICONS[n.type] || ICONS.system;
          const Icon = meta.icon;
          return (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`bg-white p-4 rounded-2xl shadow-sm border cursor-pointer hover:shadow-md transition-all duration-200 flex items-start space-x-4 ${
                n.isRead ? 'border-gray-100 opacity-75' : 'border-blue-100 bg-blue-50/40'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${meta.cls}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className={`text-sm ${n.isRead ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</h3>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={(e) => handleDelete(e, n.id)}
                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 shrink-0"
                aria-label="Delete notification"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{unreadOnly ? 'No unread notifications' : 'No notifications yet'}</p>
            <p className="text-sm text-gray-400 mt-1">
              Budget warnings, bill reminders and goal milestones will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
