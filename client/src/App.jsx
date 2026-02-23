/**
 * App.jsx — Root Application Component
 *
 * The top level of the React component tree.
 * Every page and component in Rookie Bulls is a descendant of this.
 *
 * Responsibilities:
 *  - Set up React Router so URLs map to page components
 *  - Wrap the application in Context providers
 *    so global state is available everywhere
 *
 * What does NOT belong here:
 *  - Any UI layout or content (goes in pages/ and components/)
 *  - Any API calls (goes in services/)
 *  - Any business logic (stays in the backend)
 *
 * This file grows as new pages are added to the router.
 * It should stay thin — routing and providers only.
 */

/*
 * FILE: client/src/App.jsx
 *
 * RESPONSIBILITY:
 *   Root component. Defines all client-side routes.
 *   Maps URL paths to page components.
 *
 * HOW IT FITS:
 *   main.jsx renders this component inside BrowserRouter.
 *   Every page in the app is registered here.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}