/*
 * FILE: server/modules/auth/controller.js
 *
 * RESPONSIBILITY:
 *   Handles HTTP layer for authentication endpoints.
 *   Extracts data from requests, calls the auth service,
 *   and sends appropriate HTTP responses.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic (no password hashing, no token generation)
 *   - Database queries (call service instead)
 *   - Input format validation (that is validators.js)
 *
 * HOW IT FITS:
 *   routes.js calls these controller functions after validators pass.
 *   This file calls service.js with plain values extracted from req.body.
 *   All errors thrown by the service bubble up to the global error handler
 *   via next(err).
 *
 * STEP 7 ADDITIONS:
 *   register()             — now extracts firstName, lastName from req.body
 *   verifyEmail()          — new: handles GET /api/auth/verify/:token
 *   resendVerification()   — new: handles POST /api/auth/resend-verification
 */

const authService = require('./service');

/*
 * REGISTER
 *
 * POST /api/auth/register
 *
 * Expects req.body: { firstName, lastName, email, password }
 * Validators have already confirmed all fields are present and valid.
 *
 * Step 7 change:
 *   - Extracts firstName and lastName from req.body
 *   - Passes all four values to authService.register()
 *   - Response is now a message only — no user object, no tokens
 *     (user must verify email before they can log in)
 */
async function register(req, res, next) {
  try {
    const { firstName, lastName, email, password } = req.body;

    const result = await authService.register(firstName, lastName, email, password);

    res.status(201).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

/*
 * LOGIN
 *
 * POST /api/auth/login
 *
 * Expects req.body: { email, password }
 * Returns access token, refresh token, and user object on success.
 * Returns 403 if credentials are valid but email is not verified.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/*
 * REFRESH
 *
 * POST /api/auth/refresh
 *
 * Extracts refresh token from req.body.
 * Returns a new access token if the refresh token is valid.
 * Called automatically by the frontend axios interceptor on 401.
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    const result = await authService.refresh(refreshToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/*
 * VERIFY EMAIL
 *
 * GET /api/auth/verify/:token
 *
 * The token comes from the URL parameter, not the request body.
 * req.params.token is the raw hex string from the email link.
 *
 * Three outcomes from the service:
 *   200 — token valid, user is now verified
 *   400 — token exists but has expired
 *   404 — no user has this token (invalid or already used)
 */
async function verifyEmail(req, res, next) {
  try {
    /*
     * req.params.token extracts the :token segment from the URL.
     * Example: GET /api/auth/verify/abc123def456...
     *          req.params.token === 'abc123def456...'
     */
    const { token } = req.params;

    const result = await authService.verifyEmail(token);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

/*
 * RESEND VERIFICATION
 *
 * POST /api/auth/resend-verification
 *
 * Expects req.body: { email }
 * Generates a fresh token and sends a new verification email.
 * Rate limited at the route level — this function has no rate limit logic.
 */
async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;

    const result = await authService.resendVerification(email);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, verifyEmail, resendVerification };