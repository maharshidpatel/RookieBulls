/*
 * FILE: client/src/context/AuthContext.jsx
 *
 * RESPONSIBILITY:
 *   Global authentication state for the entire React app.
 *   Stores the current user and access token.
 *   Provides login, logout, and isAuthenticated to all components.
 *
 * STORAGE DECISION — sessionStorage vs localStorage:
 *   sessionStorage is used instead of localStorage.
 *   sessionStorage clears automatically when the tab or browser closes.
 *   localStorage persists indefinitely across sessions.
 *   For a financial platform, clearing on tab close is the correct behavior.
 *   A returning user always starts with a fresh login — no silent persistence.
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

import { createContext, useContext, useState, useEffect } from 'react';
import { startInactivityTimer, stopInactivityTimer } from '../utils/inactivityTimer';
import { setAuthCallbacks } from '../services/axiosInstance';

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
 * Reads any existing session from sessionStorage on first render.
 * If the tab was closed and reopened, sessionStorage is empty
 * and the user starts unauthenticated — correct behavior.
 */
export function AuthProvider({ children }) {
  /*
   * Initialize state from sessionStorage.
   * If a session exists from before a page refresh, parse and use it.
   * If not, start with null values (logged out state).
   *
   * Note: sessionStorage survives page refreshes within the same tab
   * but is cleared when the tab or browser is closed.
   */
  const [auth, setAuth] = useState(() => {
    try {
      const stored = sessionStorage.getItem('auth');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Corrupted sessionStorage — start fresh.
    }
    return { user: null, accessToken: null, refreshToken: null };
  });

  /*
   * LOGIN
   *
   * Called by LoginPage after a successful API response.
   * Stores user and both tokens in state and sessionStorage.
   * Starts the inactivity timer immediately after login.
   *
   * Why sessionStorage:
   *   React state is lost on page refresh — sessionStorage restores it.
   *   Unlike localStorage, sessionStorage clears on tab close,
   *   which is the correct behavior for a financial platform.
   *
   * Security note:
   *   Storing tokens in sessionStorage is more secure than localStorage
   *   because it does not persist across sessions. A banking app would
   *   use httpOnly cookies instead. That is a post-MVP consideration.
   */
  function login(user, accessToken, refreshToken) {
    const next = { user, accessToken, refreshToken };
    setAuth(next);
    sessionStorage.setItem('auth', JSON.stringify(next));

    // Start the inactivity timer when the user logs in.
    // Pass logout as the callback — called after 10 min of no activity.
    startInactivityTimer(logout);
  }

  /*
   * LOGOUT
   *
   * Clears all auth state from memory and sessionStorage.
   * After this, the user is treated as unauthenticated.
   *
   * Called by:
   *   - The logout button (user initiated)
   *   - The inactivity timer (10 min of no activity)
   *   - The axios interceptor (refresh token expired or invalid)
   */
  function logout() {
    setAuth({ user: null, accessToken: null, refreshToken: null });
    sessionStorage.removeItem('auth');

    // Clear last visited quote — prevents showing a previous user's ticker
    // on the Quote pill after login by a different account.
    localStorage.removeItem('lastQuoteTicker');
    // Stop the timer and remove all event listeners on logout.
    // Prevents the timer from running when no user is active.
    stopInactivityTimer();
  }

  /*
   * UPDATE ACCESS TOKEN
   *
   * Called by the axios interceptor after a successful token refresh.
   * Updates only the access token in state and sessionStorage.
   * Does not touch the refresh token or user object.
   */
  function updateAccessToken(newAccessToken) {
    const next = { ...auth, accessToken: newAccessToken };
    setAuth(next);
    sessionStorage.setItem('auth', JSON.stringify(next));
  }

  /*
   * INACTIVITY TIMER RESTART ON PAGE REFRESH
   *
   * If the user reloads the page while logged in, sessionStorage keeps
   * them authenticated but the inactivity timer is lost on reload.
   * This effect restarts the timer after the component mounts.
   * Only runs once on mount — the empty-like dependency is intentional.
   */
  useEffect(() => {
    if (auth.user) {
      startInactivityTimer(logout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * AXIOS INTERCEPTOR SYNC
   *
   * Gives the axios interceptor access to auth state and actions.
   * Runs after every render to keep the auth reference fresh.
   * No dependency array is intentional — ensures the interceptor
   * always reads the latest token values, not a stale closure.
   */
  useEffect(() => {
    setAuthCallbacks(
      () => auth,          // getAuth — interceptor reads current tokens
      logout,              // onLogout — called when refresh token fails
      updateAccessToken    // onTokenRefresh — called when refresh succeeds
    );
  });

  /*
   * isAuthenticated
   *
   * Convenience boolean derived from user state.
   * Components use this to decide what to render.
   */
  const isAuthenticated = !!auth.user;

  return (
    <AuthContext.Provider value={{
      user: auth.user,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      isAuthenticated,
      login,
      logout,
      updateAccessToken,
    }}>
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