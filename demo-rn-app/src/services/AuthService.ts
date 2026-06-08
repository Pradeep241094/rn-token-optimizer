// ─── AuthService ──────────────────────────────────────────────────────────────
// Handles login, register, logout, password reset and session persistence.

import { post, setAuthTokens, clearAuthTokens } from './ApiService';
import type { User, AuthTokens, ApiResponse } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface LoginResult {
  user: User;
  tokens: AuthTokens;
}

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const res = await post<LoginResult>('/auth/login', credentials);
  setAuthTokens(res.data.tokens);
  return res.data;
}

export async function register(payload: RegisterPayload): Promise<LoginResult> {
  if (payload.password !== payload.confirmPassword) {
    throw new Error('Passwords do not match');
  }
  const res = await post<LoginResult>('/auth/register', payload);
  setAuthTokens(res.data.tokens);
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    await post('/auth/logout', {});
  } finally {
    clearAuthTokens();
  }
}

export async function requestPasswordReset(payload: PasswordResetRequest): Promise<void> {
  await post('/auth/password-reset/request', payload);
}

export async function confirmPasswordReset(payload: PasswordResetConfirm): Promise<void> {
  if (payload.newPassword !== payload.confirmPassword) {
    throw new Error('Passwords do not match');
  }
  await post('/auth/password-reset/confirm', payload);
}

export async function getCurrentUser(): Promise<User> {
  const res = await post<User>('/auth/me', {});
  return res.data;
}

export async function updateProfile(updates: Partial<Pick<User, 'name' | 'avatarUrl'>>): Promise<User> {
  const res = await post<User>('/auth/profile', updates);
  return res.data;
}

export function isSessionExpired(tokens: AuthTokens): boolean {
  return Date.now() >= tokens.expiresAt;
}

export function getTokenExpiryMinutes(tokens: AuthTokens): number {
  return Math.floor((tokens.expiresAt - Date.now()) / 60_000);
}
