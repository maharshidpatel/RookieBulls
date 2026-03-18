/*
 * App.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Root component. Defines all client-side routes.
 *   Maps URL paths to page components.
 *
 * Does NOT belong here:
 *   UI content, API calls, business logic.
 *
 * Route structure:
 *   Public routes  — /login, /register, /verify/:token
 *   Protected routes — all wrapped in ProtectedRoute → Layout
 *     Layout renders TopNav + SecondNav + Outlet (current page).
 *     Child pages receive openBuyPanel / openSellPanel via useOutletContext().
 *
 * STEP 7 ADDITIONS:
 *   /verify/:token — public, no Layout, no nav
 *                    VerifyPage handles all verify states (loading, success,
 *                    expired, invalid) and the resend flow
 *   /profile       — protected, inside Layout
 *                    ProfilePage — read and update account data
 *
 * Catch-all route:
 *   Any unknown URL redirects to /summary.
 *   Must be last — React Router evaluates routes top to bottom.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import RegisterPage  from './pages/RegisterPage';
import LoginPage     from './pages/LoginPage';
import VerifyPage    from './pages/VerifyPage';
import ProtectedRoute from './components/ProtectedRoute';
import Layout        from './components/layout/Layout';
import SummaryPage   from './pages/SummaryPage';
import HoldingsPage  from './pages/HoldingsPage';
import QuotePage     from './pages/QuotePage';
import HistoryPage   from './pages/HistoryPage';
import ProfilePage   from './pages/ProfilePage';

export default function App() {
  return (
    <Routes>

      {/* Redirect root to login — first impression is the login page */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ── Public routes ─────────────────────────────────────────────────── */}
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login"    element={<LoginPage />} />

      {/*
       * /verify/:token — public, standalone page, no nav.
       * Not wrapped in ProtectedRoute or Layout.
       * VerifyPage reads :token from useParams() and calls the API on mount.
       */}
      <Route path="/verify/:token" element={<VerifyPage />} />

      {/* ── Protected routes — Layout owns TopNav + SecondNav + Outlet ─────── */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/summary"       element={<SummaryPage />} />
        <Route path="/holdings"      element={<HoldingsPage />} />
        <Route path="/quote/:ticker" element={<QuotePage />} />
        <Route path="/history"       element={<HistoryPage />} />

        {/*
         * /profile — protected, inside Layout.
         * ProfilePage handles reading and updating account data.
         * Built in substep 7.15.
         */}
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/*
       * Catch-all — any URL that matches nothing redirects to /summary.
       * Covers typos, old bookmarks, and direct URL attempts.
       * Must be last — React Router evaluates routes top to bottom.
       */}
      <Route path="*" element={<Navigate to="/summary" replace />} />

    </Routes>
  );
}