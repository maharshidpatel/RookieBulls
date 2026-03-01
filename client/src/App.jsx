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
 *   Public routes  — /register, /login
 *   Protected routes — all wrapped in ProtectedRoute → Layout
 *     Layout renders TopNav + SecondNav + Outlet (current page).
 *     Child pages receive openBuyPanel / openSellPanel via useOutletContext().
 *
 * Catch-all route:
 *   Any unknown URL (e.g. /dashboard, /xyz) redirects to /summary.
 *   Prevents blank pages when the user types an unknown path.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout/Layout';
import SummaryPage from './pages/SummaryPage';
import HoldingsPage from './pages/HoldingsPage';
import QuotePage from './pages/QuotePage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  return (
    <Routes>

      {/* Redirect root to summary */}
      <Route path="/" element={<Navigate to="/summary" replace />} />

      {/* Public routes */}
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login"    element={<LoginPage />} />

      {/* Protected routes — Layout owns TopNav + SecondNav + Outlet */}
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
      </Route>

      {/*
       * Catch-all — any URL that matches nothing above redirects to /summary.
       * Covers old routes (/dashboard), typos, and direct URL attempts.
       * Must be last — React Router evaluates routes top to bottom.
       */}
      <Route path="*" element={<Navigate to="/summary" replace />} />

    </Routes>
  );
}