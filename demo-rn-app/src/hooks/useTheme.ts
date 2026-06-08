// ─── useTheme hook ────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import type { AppTheme, ThemeColors } from '../types';

const LIGHT_COLORS: ThemeColors = {
  primary: '#0ea5e9', secondary: '#7c3aed', background: '#ffffff',
  surface: '#f8fafc', text: '#0f172a', textMuted: '#64748b',
  error: '#ef4444', success: '#22c55e', warning: '#f59e0b',
};

const DARK_COLORS: ThemeColors = {
  primary: '#38bdf8', secondary: '#a78bfa', background: '#0f172a',
  surface: '#1e293b', text: '#f1f5f9', textMuted: '#94a3b8',
  error: '#f87171', success: '#4ade80', warning: '#fbbf24',
};

export function useTheme() {
  const [isDark, setIsDark] = useState(true);

  const theme: AppTheme = {
    dark: isDark,
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
  };

  const toggleTheme = useCallback(() => setIsDark(d => !d), []);
  const setDarkMode  = useCallback((dark: boolean) => setIsDark(dark), []);

  return { theme, isDark, toggleTheme, setDarkMode };
}

// ─── useDebounce hook ─────────────────────────────────────────────────────────

import { useState as useStateD, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useStateD<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debouncedValue;
}

// ─── usePagination hook ───────────────────────────────────────────────────────

export function usePagination(initialPage = 1, pageSize = 20) {
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / pageSize);
  const canGoNext = page < totalPages;
  const canGoPrev = page > 1;

  const nextPage = useCallback(() => { if (canGoNext) setPage(p => p + 1); }, [canGoNext]);
  const prevPage = useCallback(() => { if (canGoPrev) setPage(p => p - 1); }, [canGoPrev]);
  const goToPage = useCallback((p: number) => setPage(Math.max(1, Math.min(p, totalPages))), [totalPages]);
  const reset    = useCallback(() => setPage(1), []);

  return { page, total, totalPages, canGoNext, canGoPrev, pageSize, setTotal, nextPage, prevPage, goToPage, reset };
}
