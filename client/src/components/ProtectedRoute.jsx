/*
 * FILE: client/src/components/ProtectedRoute.jsx
 *
 * RESPONSIBILITY:
 *   Wraps routes that require authentication.
 *   Redirects unauthenticated users to the login page.
 *   Renders the protected page if the user is authenticated.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Role-based access logic (future — admin vs user)
 *   - Any UI rendering beyond the redirect decision
 *
 * HOW IT FITS:
 *   Used in App.jsx to wrap any route that requires login.
 *
 * USAGE:
 *   <Route path="/summary" element={
 *     <ProtectedRoute>
 *       <SummaryPage />
 *     </ProtectedRoute>
 *   } />
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();

  /*
   * If the user is not authenticated, redirect to login.
   *
   * replace={true} replaces the current history entry instead
   * of pushing a new one. This means pressing the browser back
   * button after being redirected to login will not send the
   * user back to the protected page they were denied access to.
   */
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  /*
   * User is authenticated — render whatever page was requested.
   * children is the page component passed between the tags.
   */
  return children;
}