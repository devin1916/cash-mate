import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import AuthPage from './components/auth/AuthPage';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './components/dashboard/Dashboard';
import AddTransactionForm from './components/transactions/AddTransactionForm';
import TransactionList from './components/transactions/TransactionList';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      case 'settings': return 'Settings';
      default: return 'Dashboard';
    }
  };

  const renderContent = () => {
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
        return (
          <div className="p-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Budget Management</h2>
              <p className="text-gray-600">Set and manage your monthly budgets here!</p>
            </div>
          </div>
        );
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
      
      <div>
        <Header
          title={getTabTitle(activeTab)}
          onMenuClick={() => setIsMobileMenuOpen(true)}
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