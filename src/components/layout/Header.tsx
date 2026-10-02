import React, { useEffect, useRef, useState } from 'react';
import { Menu, Bell, Search, CheckCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onNavigate?: (tab: string) => void;
}

const Header: React.FC<HeaderProps> = ({ title, onMenuClick, onNavigate }) => {
  const { notifications, notificationsMeta, markNotificationRead, markAllNotificationsRead, fetchNotifications } = useApp();
  const { user } = useAuth();
  const [bellOpen, setBellOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Close the dropdown on outside click
  useEffect(() => {
    if (!bellOpen) return;
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [bellOpen]);

  const unread = notificationsMeta.unread || 0;
  const recent = notifications.slice(0, 6);

  const handleItemClick = async (id: string) => {
    await markNotificationRead(id);
    setBellOpen(false);
    onNavigate?.('notifications');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      onNavigate?.('transactions');
      setSearchQuery('');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-5 lg:px-6 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 lg:hidden transition-colors duration-200"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="ml-2 lg:ml-0 text-2xl font-bold text-gray-900">{title}</h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search transactions..."
              className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Notification bell */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setBellOpen((v) => !v)}
              className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
            >
              <Bell className="w-6 h-6" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-200 z-40 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <span className="text-sm font-semibold text-gray-900">
                    Notifications {unread > 0 && <span className="text-blue-600">({unread} new)</span>}
                  </span>
                  <button
                    onClick={markAllNotificationsRead}
                    disabled={unread === 0}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40 flex items-center"
                  >
                    <CheckCheck className="w-3.5 h-3.5 mr-1" />
                    Mark all read
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {recent.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleItemClick(n.id)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors duration-200 ${
                        n.isRead ? 'opacity-70' : 'bg-blue-50/50'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                        <div className={n.isRead ? 'pl-0' : ''}>
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </button>
                  ))}

                  {recent.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No notifications yet</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setBellOpen(false);
                    onNavigate?.('notifications');
                  }}
                  className="w-full px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 font-medium transition-colors duration-200 border-t border-gray-100"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {user && <span className="sr-only">Signed in as {user.name}</span>}
    </header>
  );
};

export default Header;
