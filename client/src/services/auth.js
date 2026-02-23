/*
 * FILE: client/src/services/auth.js
 *
 * RESPONSIBILITY:
 *   All HTTP requests related to authentication.
 *   Pages and components never call axios directly —
 *   they call functions from this file.
 *
 * WHY THIS EXISTS:
 *   If the API URL or request shape changes, you update it here only.
 *   Nothing else in the frontend needs to change.
 */

import axios from 'axios';

/*
 * axios will use the Vite proxy configured in vite.config.js.
 * Any request to /api/* is forwarded to http://localhost:5000.
 * This avoids CORS issues in development.
 */

export async function registerUser(email, password) {
  const response = await axios.post('/api/auth/register', { email, password });
  return response.data;
}

export async function loginUser(email, password) {
  const response = await axios.post('/api/auth/login', { email, password });
  return response.data;
}