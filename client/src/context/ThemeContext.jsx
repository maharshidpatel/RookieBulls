// @refresh reset
/* eslint-disable react-refresh/only-export-components */
/*
 * ThemeContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Provides the active theme object (lightTheme or darkTheme) to all
 *   components via React context. Persists preference in localStorage.
 *   Syncs data-theme on <html> for any global CSS that reads it.
 *
 * Exports:
 *   ThemeProvider  — wraps the app tree in main.jsx
 *   useTheme()     — returns the active theme object (used by all components)
 *   useThemeMode() — returns { isDark, toggleTheme } (used only by TopNav)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { lightTheme, darkTheme } from '../styles/theme';

const ThemeContext = createContext({
  theme:       lightTheme,
  isDark:      false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const theme = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Used by all components to get the active theme object.
export function useTheme() {
  return useContext(ThemeContext).theme;
}

// Used only by TopNav for the toggle button.
export function useThemeMode() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  return { isDark, toggleTheme };
}
