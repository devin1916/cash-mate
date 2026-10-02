import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthState, User } from '../types';
import api, { setAccessToken, refreshSession, ApiError } from '../api/client';
import { setCurrency } from '../utils/currency';

const AuthContext = createContext<AuthState | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const applyUser = useCallback((next: User | null) => {
    setUser(next);
    setIsAuthenticated(Boolean(next));
    setCurrency(next?.currency);
  }, []);

  // Restore session on app load using the httpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await refreshSession();
      if (cancelled) return;
      if (data?.user) applyUser(data.user);
      setInitializing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  // Automatic logout when the session can no longer be refreshed.
  useEffect(() => {
    const onExpired = () => {
      applyUser(null);
      setSessionExpired(true);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [applyUser]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    setAccessToken(res.data!.accessToken);
    setSessionExpired(false);
    applyUser(res.data!.user);
  };

  const register = async (name: string, email: string, password: string, phone?: string) => {
    const res = await api.post('/auth/register', { name, email, password, phone });
    setAccessToken(res.data!.accessToken);
    setSessionExpired(false);
    applyUser(res.data!.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* best effort - local state is cleared regardless */
    }
    setAccessToken(null);
    applyUser(null);
    setSessionExpired(false);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      applyUser(res.data!.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) applyUser(null);
    }
  };

  const updateUser = (next: User) => applyUser(next);

  const dismissSessionExpired = () => setSessionExpired(false);

  const loginWithGoogle = async () => {
    throw new ApiError('Google sign-in is not enabled yet. Use email and password.', 501);
  };

  const loginWithFacebook = async () => {
    throw new ApiError('Facebook sign-in is not enabled yet. Use email and password.', 501);
  };

  const value: AuthState = {
    isAuthenticated,
    user,
    initializing,
    sessionExpired,
    login,
    register,
    loginWithGoogle,
    loginWithFacebook,
    logout,
    updateUser,
    refreshUser,
    dismissSessionExpired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
