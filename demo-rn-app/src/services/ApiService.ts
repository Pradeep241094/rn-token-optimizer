// ─── ApiService ───────────────────────────────────────────────────────────────
// Central HTTP client wrapping axios with auth token injection,
// automatic refresh, error normalisation, and retry logic.

import type { ApiResponse, AuthTokens } from '../types';

const BASE_URL = 'https://api.demo-shop.example.com/v1';
const TIMEOUT_MS = 10_000;

let currentTokens: AuthTokens | null = null;

export function setAuthTokens(tokens: AuthTokens): void {
  currentTokens = tokens;
}

export function clearAuthTokens(): void {
  currentTokens = null;
}

export function getAccessToken(): string | null {
  return currentTokens?.accessToken ?? null;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-App-Version': '1.0.0',
  };
  if (currentTokens?.accessToken) {
    headers['Authorization'] = `Bearer ${currentTokens.accessToken}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const body = await res.json();
  if (!res.ok) {
    throw new ApiError(body.message ?? 'Request failed', res.status, body);
  }
  return body as ApiResponse<T>;
}

async function refreshTokenIfNeeded(): Promise<void> {
  if (!currentTokens) return;
  const now = Date.now();
  if (currentTokens.expiresAt - now < 60_000) {
    const refreshed = await refreshTokens(currentTokens.refreshToken);
    currentTokens = refreshed;
  }
}

export async function get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
  await refreshTokenIfNeeded();
  const url = new URL(BASE_URL + path);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: buildHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return handleResponse<T>(res);
}

export async function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  await refreshTokenIfNeeded();
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return handleResponse<T>(res);
}

export async function put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  await refreshTokenIfNeeded();
  const res = await fetch(BASE_URL + path, {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return handleResponse<T>(res);
}

export async function del<T>(path: string): Promise<ApiResponse<T>> {
  await refreshTokenIfNeeded();
  const res = await fetch(BASE_URL + path, {
    method: 'DELETE',
    headers: buildHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return handleResponse<T>(res);
}

async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError('Token refresh failed', res.status, body);
  return body.data as AuthTokens;
}

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean { return this.status === 401; }
  get isForbidden():   boolean { return this.status === 403; }
  get isNotFound():    boolean { return this.status === 404; }
  get isServerError(): boolean { return this.status >= 500; }
}
