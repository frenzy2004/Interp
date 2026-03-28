"use client";
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'interp_theme';

export function useTheme() {
  const [theme, setTheme] = useState('dark');

  // Sync from localStorage after hydration
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
