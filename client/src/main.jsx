/**
 * main.jsx — React Application Entry Point
 *
 * This is the first file React executes.
 * It mounts the App component into the root div in index.html.
 *
 * BrowserRouter:
 *   Wraps the entire app to enable client-side routing.
 *   It listens to the browser URL and tells React Router
 *   which page component to render based on the current path.
 *   Must wrap App — nothing inside App can use routing without it.
 *
 * ThemeProvider:
 *   Wraps the app to provide the active theme object to all components.
 *   Persists theme preference in localStorage.
 *   Must wrap AuthProvider so auth-aware components can also read the theme.
 *
 * AuthProvider:
 *   Wraps the app to provide auth state (user, login, logout) to all components.
 *
 * StrictMode:
 *   Activates additional development warnings.
 *   No effect in production.
 *   Intentionally runs certain functions twice in development
 *   to expose side effects that should not exist.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import App from './App.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);