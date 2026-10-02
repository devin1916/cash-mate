import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import AuthPage from './components/auth/AuthPage';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './components/dashboard/Dashboard';
import AddTransactionForm from './components/transactions/AddTransactionForm';
import TransactionList from './components/transactions/TransactionList';
import BudgetsPage from './components/budgets/BudgetsPage';
import GoalsPage from './components/goals/GoalsPage';
import RecurringPage from './components/recurring/RecurringPage';
import BillsPage from './components/bills/BillsPage';
import NotificationsPage from './components/notifications/NotificationsPage';

const AppContent: React.FC = () => {
  const { isAuthenticated, initializing } = useAuth();
  const { reload, loading } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load this user's data as soon as they are signed in.
  useEffect(() => {
    if (isAuthenticated && !dataLoaded) {
      setDataLoaded(true);
      reload();
    }
    if (!isAuthenticated) {
      setDataLoaded(false);
    }
  }, [isAuthenticated, dataLoaded, reload]);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading CashMate...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard';
      case 'add-transaction': return 'Add Transaction';
      case 'transactions': return 'Transactions';
      case 'reports': return 'Reports';
      case 'budgets': return 'Budgets';
      case 'goals': return 'Savings Goals';
      case 'recurring': return 'Recurring Transactions';
      case 'bills': return 'Bills & Reminders';
      case 'notifications': return 'Notifications';
      case 'settings': return 'Settings';
      default: return 'Dashboard';
    }
  };

  const renderContent = () => {
    if (loading && activeTab === 'dashboard') {
      return (
        <div className="p-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your finances...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'add-transaction':
        return (
          <div className="p-6">
            <AddTransactionForm />
          </div>
        );
      case 'transactions':
        return (
          <div className="p-6">
            <TransactionList />
          </div>
        );
      case 'reports':
        return (
          <div className="p-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Reports & Analytics</h2>
              <p className="text-gray-600">Advanced reporting features coming soon!</p>
            </div>
          </div>
        );
      case 'budgets':
        return <BudgetsPage />;
      case 'goals':
        return <GoalsPage />;
      case 'recurring':
        return <RecurringPage />;
      case 'bills':
        return <BillsPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'settings':
        return (
          <div className="p-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
              <p className="text-gray-600">Manage your account settings and preferences.</p>
            </div>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-teal-50">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 min-w-0">
        <Header
          title={getTabTitle(activeTab)}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onNavigate={setActiveTab}
        />

        <main className="min-h-[calc(100vh-4rem)]">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
