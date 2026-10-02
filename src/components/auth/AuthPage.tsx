import React, { useState } from 'react';
import { Wallet, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import ResetPasswordForm from './ResetPasswordForm';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

const AuthPage: React.FC = () => {
  const { sessionExpired, dismissSessionExpired } = useAuth();
  const initialToken =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null;
  const [mode, setMode] = useState<AuthMode>(initialToken ? 'reset' : 'login');

  const goToLogin = () => {
    setMode('login');
    // Clean the reset token out of the URL
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      <div className="min-h-screen flex">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-8 lg:py-12 bg-gradient-to-br from-blue-600 via-blue-700 to-teal-700">
          <div className="mx-auto max-w-md text-center">
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                <Wallet className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-6">CashMate</h1>
            <p className="text-xl text-blue-100 mb-8">
              Your intelligent finance companion
            </p>
            <div className="space-y-4 text-blue-100">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                <span>Track expenses & income effortlessly</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                <span>Set budgets & get smart alerts</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                <span>Analyze spending with beautiful charts</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                <span>Export data & stay organized</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Auth Forms */}
        <div className="flex-1 flex flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm lg:max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-teal-600 rounded-xl mr-3">
                  <Wallet className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">CashMate</h1>
              </div>
            </div>

            {sessionExpired && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mr-2 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    Your session has expired. Please sign in again.
                  </p>
                </div>
                <button
                  onClick={dismissSessionExpired}
                  className="text-amber-500 hover:text-amber-700"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {mode === 'login' && (
              <>
                <LoginForm
                  onSwitchToRegister={() => setMode('register')}
                  onSwitchToForgot={() => setMode('forgot')}
                />
              </>
            )}
            {mode === 'register' && <RegisterForm onSwitchToLogin={() => setMode('login')} />}
            {mode === 'forgot' && <ForgotPasswordForm onSwitchToLogin={() => setMode('login')} />}
            {mode === 'reset' && initialToken && (
              <ResetPasswordForm token={initialToken} onDone={goToLogin} />
            )}
            {mode === 'reset' && !initialToken && (
              <ForgotPasswordForm onSwitchToLogin={() => setMode('login')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
