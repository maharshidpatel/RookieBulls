/**
 * FOLDER: /client
 *
 * The entire frontend application lives here.
 * Built with React and Vite.
 *
 * What this folder contains:
 *  - src/pages/      → one file per full page the user sees
 *  - src/components/ → reusable UI building blocks used across pages
 *  - src/context/    → shared application state (logged in user etc.)
 *  - src/services/   → functions that make HTTP requests to the backend
 *
 * How it works:
 *  Vite runs a local development server on port 5173.
 *  React renders the UI in the browser.
 *  When a user does something (login, buy a stock), a service
 *  function sends an HTTP request to the Express backend.
 *  The backend responds with data and React updates the UI.
 *
 * What this folder does NOT contain:
 *  - Any business logic (lives in /server/modules)
 *  - Any database access (lives in /server)
 *  - Any secrets (never put API keys or credentials in frontend code)
 *
 * Deployment target:
 *  Vercel — the built output (HTML, CSS, JS) is deployed there.
 *  Vite builds the production bundle with: npm run build
 */