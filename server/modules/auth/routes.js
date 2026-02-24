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
 *   So a route defined here as /register is reachable at /api/auth/register.
 *
 * REQUEST FLOW:
 *   POST /api/auth/register
 *     → validateRegister middleware runs
 *     → if validation passes, controller.register runs
 *
 *   POST /api/auth/login
 *     → validateLogin middleware runs
 *     → if validation passes, controller.login runs
 */

const express = require('express');
const router = express.Router();
const { validateRegister, validateLogin } = require('./validators');
const controller = require('./controller');

/*
 * POST /api/auth/register
 *
 * ...validateRegister is spread here because validateRegister is an array
 * of middleware functions, not a single function.
 * Spreading it passes each function individually to the route,
 * which is what Express expects.
 *
 * Execution order:
 *   1. body('email') validation
 *   2. body('password') validation
 *   3. handleValidationErrors — rejects if any rule failed
 *   4. controller.register — runs only if all validation passed
 */
router.post('/register', ...validateRegister, controller.register);

/*
 * POST /api/auth/login
 *
 * Same pattern as register.
 * Validators confirm fields are present before the controller runs.
 */
router.post('/login', ...validateLogin, controller.login);

// POST /api/auth/refresh
// Issues a new access token using a valid refresh token.
// No authentication middleware — the refresh token itself is the credential.
// Full path: POST /api/auth/refresh
router.post('/refresh', controller.refresh);

module.exports = router;