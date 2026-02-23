/*
 * FILE: client/src/context/AuthContext.jsx
 *
 * RESPONSIBILITY:
 *   Global authentication state for the entire React app.
 *   Stores the current user and access token.
 *   Provides login and logout functions to any component.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - API calls (services/auth.js handles those)
 *   - UI rendering (this is pure state logic)
 *   - Business logic beyond storing and clearing auth state
 *
 * HOW IT FITS:
 *   main.jsx wraps the app in AuthProvider.
 *   Any component calls useAuth() to read or update auth state.
 *
 * USAGE:
 *   import { useAuth } from '../context/AuthContext'
 *   const { user, login, logout } = useAuth()
 */

import { createContext, useContext, useState } from 'react';

/*
 * createContext(undefined) allows TypeScript to correctly infer
 * the context type. Using null would cause useAuth() to be
 * inferred as returning never, which produces a false error.
 */
const AuthContext = createContext(undefined);

/*
 * AUTH PROVIDER
 *
 * Wraps the app and makes auth state available to all children.
 * Reads any existing token from localStorage on first render
 * so the user stays logged in after a page refresh.
 */
export function AuthProvider({ children }) {
  /*
   * Initialize state from localStorage.
   * If a token exists from a previous session, parse and use it.
   * If not, start with null (logged out state).
   */
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('auth');
      return stored ? JSON.parse(stored).user : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState(() => {
    try {
      const stored = localStorage.getItem('auth');
      return stored ? JSON.parse(stored).accessToken : null;
    } catch {
      return null;
    }
  });

  /*
   * LOGIN
   *
   * Called by LoginPage after a successful API response.
   * Stores user and tokens in state and localStorage.
   *
   * Why localStorage:
   *   React state is lost on page refresh.
   *   localStorage persists until explicitly cleared.
   *
   * Security note:
   *   Storing tokens in localStorage is acceptable for this
   *   educational platform. A banking app would use httpOnly
   *   cookies instead. That is a post-MVP hardening consideration.
   */
  function login(userData, token) {
    setUser(userData);
    setAccessToken(token);
    localStorage.setItem('auth', JSON.stringify({
      user: userData,
      accessToken: token,
    }));
  }

  /*
   * LOGOUT
   *
   * Clears all auth state from memory and localStorage.
   * After this, the user is treated as unauthenticated.
   */
  function logout() {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('auth');
  }

  /*
   * isAuthenticated
   *
   * Convenience boolean derived from user state.
   * Components use this to decide what to render.
   */
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

/*
 * useAuth
 *
 * Custom hook that any component uses to access auth state.
 * Throws a clear error if used outside of AuthProvider
 * so mistakes are caught immediately during development.
 *
 * Usage:
 *   const { user, login, logout, isAuthenticated } = useAuth()
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}