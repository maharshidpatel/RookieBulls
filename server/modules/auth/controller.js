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

module.exports = { register, login };