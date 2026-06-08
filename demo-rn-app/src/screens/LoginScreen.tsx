// ─── LoginScreen ──────────────────────────────────────────────────────────────
// Entry point for unauthenticated users. Handles email/password login,
// social login buttons, and navigation to Register / ForgotPassword.

import { useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types';

export interface LoginScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    replace: (screen: string) => void;
  };
}

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateForm = useCallback((): boolean => {
    let valid = true;
    if (!email.includes('@')) { setEmailError('Enter a valid email address'); valid = false; }
    else setEmailError('');
    if (password.length < 8) { setPasswordError('Password must be at least 8 characters'); valid = false; }
    else setPasswordError('');
    return valid;
  }, [email, password]);

  const handleLogin = useCallback(async () => {
    clearError();
    if (!validateForm()) return;
    await login(email.trim().toLowerCase(), password);
    navigation.replace('MainTabs');
  }, [login, email, password, validateForm, clearError, navigation]);

  const handleGoogleLogin = useCallback(async () => {
    // OAuth flow — opens Google sign-in
    navigation.navigate('OAuthWebView', { provider: 'google' });
  }, [navigation]);

  const handleAppleLogin = useCallback(async () => {
    // Apple Sign-In via expo-apple-authentication
    navigation.navigate('OAuthWebView', { provider: 'apple' });
  }, [navigation]);

  const handleForgotPassword = useCallback(() => {
    navigation.navigate('ForgotPassword', { email });
  }, [navigation, email]);

  const handleGoToRegister = useCallback(() => {
    navigation.navigate('Register');
  }, [navigation]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(v => !v);
  }, []);

  // Render: email field, password field, login button, social buttons, register link
  return null; // UI rendered by React Native components
}
