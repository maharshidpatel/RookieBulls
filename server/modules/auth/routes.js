/*
 * FILE: server/modules/auth/routes.js
 *
 * RESPONSIBILITY:
 *   Defines all HTTP endpoints for the auth module.
 *   Wires validators and controller functions to URL paths.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic (service.js)
 *   - HTTP response logic (controller.js)
 *   - Input validation rules (validators.js)
 *
 * HOW IT FITS:
 *   This router is mounted in server.js under /api/auth.
 *   A route defined here as /register is reachable at /api/auth/register.
 *
 * STEP 7 ADDITIONS:
 *   GET  /verify/:token          — verifies email from link click
 *   POST /resend-verification    — sends a fresh verification email
 */

const express    = require('express');
const router     = express.Router();
const controller = require('./controller');

const {
  validateRegister,
  validateLogin,
  validateResendVerification,
} = require('./validators');

const {
  resendVerificationLimiter,
  loginLimiter,
  registerLimiter,
} = require('../../middleware/rateLimiter');

// POST /api/auth/register
// Validators confirm firstName, lastName, email, password are present.
// On success: 201 with a message — no tokens returned until email is verified.
router.post('/register', registerLimiter, ...validateRegister, controller.register);

// POST /api/auth/login
// Validators confirm email and password are present.
// Returns 403 if account exists but email is not yet verified.
router.post('/login', loginLimiter, ...validateLogin, controller.login);

// POST /api/auth/refresh
// No validator — refresh token is validated inside the service.
router.post('/refresh', controller.refresh);

// GET /api/auth/verify/:token
// Public endpoint — no auth middleware.
// Token comes from the email link: /verify/<hex string>
// No request body — token is in the URL path.
router.get('/verify/:token', controller.verifyEmail);

// POST /api/auth/resend-verification
// Validator confirms a valid email was submitted.
// Rate limited to 3 requests per hour per IP.
//
router.post('/resend-verification', resendVerificationLimiter, ...validateResendVerification, controller.resendVerification);

module.exports = router;