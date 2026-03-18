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
 *
 * STEP 7 ADDITIONS:
 *   registerUser       — now sends firstName, lastName alongside email, password
 *   resendVerification — new: POST /api/auth/resend-verification
 *   verifyEmail        — new: GET /api/auth/verify/:token
 */

import axios from 'axios';

/*
 * axios will use the Vite proxy configured in vite.config.js.
 * Any request to /api/* is forwarded to http://localhost:5000.
 * This avoids CORS issues in development.
 */

/*
 * REGISTER
 *
 * Now sends firstName and lastName in addition to email and password.
 * Response is a message only — no tokens.
 * The user must verify their email before they can log in.
 */
export async function registerUser(firstName, lastName, email, password) {
  const response = await axios.post('/api/auth/register', {
    firstName,
    lastName,
    email,
    password,
  });
  return response.data;
}

/*
 * LOGIN
 *
 * Unchanged — email and password only.
 * Returns accessToken, refreshToken, and user object on success.
 * Returns 403 if account is unverified.
 */
export async function loginUser(email, password) {
  const response = await axios.post('/api/auth/login', { email, password });
  return response.data;
}

/*
 * RESEND VERIFICATION
 *
 * Sends a new verification email to the given address.
 * Called from LoginPage (after 403) and VerifyPage (after expired link).
 * Rate limited on the server — max 3 attempts per hour per IP.
 */
export async function resendVerification(email) {
  const response = await axios.post('/api/auth/resend-verification', { email });
  return response.data;
}

/*
 * VERIFY EMAIL
 *
 * Called by VerifyPage on mount with the token from the URL.
 * GET request — token is in the URL path, not the request body.
 * Returns 200 on success, 400 if expired, 404 if invalid.
 */
export async function verifyEmail(token) {
  const response = await axios.get(`/api/auth/verify/${token}`);
  return response.data;
}