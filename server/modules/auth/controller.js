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
 *   in server.js via next(err).
 */

const authService = require('./service');

/*
 * REGISTER
 *
 * POST /api/auth/register
 *
 * Expects req.body: { email, password }
 * Validators have already confirmed both fields are present and valid.
 *
 * On success: 201 Created — user registered
 * On failure: error passed to global error handler via next(err)
 *
 * 201 vs 200:
 *   200 OK means "request succeeded"
 *   201 Created means "request succeeded and a new resource was created"
 *   Registration creates a new user, so 201 is semantically correct.
 */
async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await authService.register(email, password);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user },
    });
  } catch (err) {
    /*
     * next(err) hands the error to the global error handler in server.js.
     * The error handler reads err.statusCode (set in the service) and
     * sends the appropriate HTTP status and message.
     * Controllers never send error responses directly.
     */
    next(err);
  }
}

/*
 * LOGIN
 *
 * POST /api/auth/login
 *
 * Expects req.body: { email, password }
 *
 * On success: 200 OK — returns access token, refresh token, and user info
 * On failure: error passed to global error handler via next(err)
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

// ─── refresh ──────────────────────────────────────────────────
// HTTP handler for POST /api/auth/refresh.
// Extracts the refresh token from the request body, passes it
// to the auth service, and returns a new access token.
//
// This controller does no validation or logic — it is HTTP only.
// All token verification and user lookup happens in service.js.
//
// Called automatically by the frontend axios interceptor when
// a 401 is detected. The user never triggers this manually.

async function refresh(req, res, next) {
  try {
    // Pull refresh token from request body.
    // If it is missing or invalid, the service throws a 401.
    const { refreshToken } = req.body;

    const result = await authService.refresh(refreshToken);

    // Returns only the new access token.
    // The refresh token itself is not rotated at MVP.
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    // All errors (missing token, invalid token, user not found)
    // are thrown from the service with err.statusCode attached.
    // next(err) routes them to the global error handler in server.js.
    next(err);
  }
}

module.exports = { register, login, refresh };