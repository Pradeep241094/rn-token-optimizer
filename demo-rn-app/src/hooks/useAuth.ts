// ─── useAuth hook ─────────────────────────────────────────────────────────────
// Manages authentication state, login, register, logout flows.

import { useState, useCallback, useEffect } from 'react';
import * as AuthService from '../services/AuthService';
import type { User, AuthTokens } from '../types';

export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = user !== null;

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await AuthService.login({ email, password });
      setUser(result.user);
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await AuthService.register({ name, email, password, confirmPassword: password });
      setUser(result.user);
    } catch (err: any) {
      setError(err.message ?? 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
    } catch {
      setUser(null); // Clear locally even if server call fails
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await AuthService.requestPasswordReset({ email });
    } catch (err: any) {
      setError(err.message ?? 'Password reset request failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await AuthService.getCurrentUser();
      setUser(fresh);
    } catch {
      setUser(null);
    }
  }, []);

  return { user, isAuthenticated, isLoading, error, login, register, logout, requestPasswordReset, clearError, refreshUser };
}
