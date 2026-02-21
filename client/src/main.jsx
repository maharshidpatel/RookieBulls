/**
 * main.jsx — React Application Entry Point
 *
 * This is the first file React executes.
 * It mounts the App component into the root div in index.html.
 *
 * StrictMode:
 *  Wrapping App in StrictMode activates additional development
 *  warnings. It has no effect in production.
 *  It helps catch common mistakes early by intentionally
 *  running certain functions twice in development to expose
 *  side effects that should not exist.
 *
 * You will rarely need to modify this file.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
