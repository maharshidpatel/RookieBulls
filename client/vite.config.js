import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})

/**
 * vite.config.js — Vite Development Server Configuration
 *
 * plugins:
 *   react() enables React support including JSX transformation.
 *   JSX is the HTML-like syntax used in React components.
 *   Browsers do not understand JSX natively — Vite transforms
 *   it into regular JavaScript that browsers can run.
 *
 * server.port:
 *   Locks the dev server to port 5173.
 *   Without this Vite picks an available port automatically
 *   which could change between restarts, breaking the CORS
 *   configuration in the backend .env file.
 *
 * server.proxy:
 *   Any request from React starting with /api is automatically
 *   forwarded to http://localhost:5000 during development.
 *   This means React code calls /api/auth/login
 *   and Vite sends it to http://localhost:5000/api/auth/login.
 *   In production Vercel handles this differently — the React
 *   app calls the real DigitalOcean server URL directly.
 *
 * changeOrigin:
 *   Rewrites the request origin header to match the target.
 *   Required for the Express CORS configuration to accept
 *   the proxied request correctly.
 */
