/*
 * FILE: client/src/services/axiosInstance.js
 *
 * RESPONSIBILITY:
 *   A configured axios instance used by all frontend services.
 *   Attaches an interceptor that automatically refreshes the access token
 *   when a 401 response is received, then retries the original request.
 *
 * WHY A SHARED INSTANCE:
 *   All API calls go through this one instance instead of raw axios.
 *   The interceptor only needs to be set up once, in one place.
 *   Individual service files (wallet.js, auth.js) import this instead of axios.
 *
 * INTERCEPTOR FLOW:
 *   Request fires → server returns 401
 *   → interceptor calls POST /api/auth/refresh with stored refresh token
 *   → if refresh succeeds: update stored access token, retry original request
 *   → if refresh fails: call logout(), redirect to /login
 *
 * WHAT DOES NOT BELONG HERE:
 *   Business logic, UI, component state.
 */

import axios from 'axios';

const axiosInstance = axios.create();

// getAuthCallbacks is set by AuthProvider after mount.
// This avoids a circular dependency between axiosInstance and AuthContext.
// AuthContext cannot be imported here directly because this file is not
// a React component and cannot use hooks.
let getAuth = null;
let onLogout = null;
let onTokenRefresh = null;

export function setAuthCallbacks(getAuthFn, logoutFn, updateTokenFn) {
  // Called once from AuthProvider on mount.
  // Gives the interceptor access to the current auth state and actions
  // without importing AuthContext directly.
  getAuth = getAuthFn;
  onLogout = logoutFn;
  onTokenRefresh = updateTokenFn;
}

// ─── Request Interceptor ──────────────────────────────────────
// Runs before every request is sent.
// Reads the current access token from auth state and attaches it
// to the Authorization header automatically.
// No service function or component needs to handle this manually.
axiosInstance.interceptors.request.use((config) => {
  const auth = getAuth ? getAuth() : null;
  const token = auth?.accessToken;

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  return config;
});

// ─── Response Interceptor ─────────────────────────────────────
// Runs after every response is received.
// The first function handles success (2xx) — we pass through unchanged.
// The second function handles errors (4xx, 5xx).

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401 responses.
    // _retry flag prevents infinite loops — if the retried request
    // also returns 401, we do not try to refresh again.
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const auth = getAuth ? getAuth() : null;
        const refreshToken = auth?.refreshToken;

        if (!refreshToken) {
          // No refresh token available — nothing to try.
          // Log the user out immediately.
          if (onLogout) onLogout();
          return Promise.reject(error);
        }

        // Call the refresh endpoint with the stored refresh token.
        const response = await axios.post('/api/auth/refresh', { refreshToken });
        const newAccessToken = response.data.data.accessToken;

        // Update the access token in AuthContext and sessionStorage.
        if (onTokenRefresh) onTokenRefresh(newAccessToken);

        // Retry the original request with the new access token.
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } catch {
        // Refresh failed — refresh token is expired or invalid.
        // Force logout. User must log in again.
        if (onLogout) onLogout();
        return Promise.reject(error);
      }
    }

    // For all non-401 errors, pass through unchanged.
    return Promise.reject(error);
  }
);

export default axiosInstance;