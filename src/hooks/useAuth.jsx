"use client";
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { checkAuth, login as apiLogin, verifyCredentials as apiVerifyCredentials, persistSession, register as apiRegister, logout as apiLogout, isLoggedIn, getStoredUser } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    const verifyAuth = async () => {
      // Restore cached user immediately for immediate UI response
      const storedUser = getStoredUser();
      if (storedUser) setUser(storedUser);

      if (!isLoggedIn()) {
        setLoading(false);
        return;
      }

      // If offline, trust the stored user and skip the check
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setLoading(false);
        return;
      }

      try {
        const result = await checkAuth();
        if (result.authenticated) {
          setUser(result.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  // Listen for logout events from API (e.g., when token expires)
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const result = await apiLogin(email, password);
      // Wait for state update to trigger sync? No, direct user set is better.
      setUser(result.user);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const verifyCredentials = useCallback(async (email, password) => {
    setError(null);
    try {
      const result = await apiVerifyCredentials(email, password);
      return { success: true, result };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const completeLogin = useCallback((token, userData) => {
    persistSession(token, userData);
    setUser(userData);
  }, []);

  const register = useCallback(async (email, password, name) => {
    setError(null);
    try {
      const result = await apiRegister(email, password, name);
      setUser(result.user);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    error,
    login,
    verifyCredentials,
    completeLogin,
    register,
    logout,
    isAuthenticated: !!(user && (user.id || user.email)),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
