/*
 * FILE: server/modules/user/routes.js
 *
 * RESPONSIBILITY:
 *   Defines all HTTP endpoints for the user profile module.
 *   Wires authentication, validators, and controller functions to URL paths.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic (service.js)
 *   - HTTP response logic (controller.js)
 *   - Input validation rules (validators.js)
 *
 * HOW IT FITS:
 *   Mounted in server.js under /api/user.
 *   All routes here require a valid JWT — authenticate runs first.
 *
 * REQUEST FLOW:
 *   Request → authenticate → validator → controller → service → model
 */

const express    = require('express');
const router     = express.Router();
const controller = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { validateUpdateProfile, validateChangePassword } = require('./validators');

/*
 * All routes in this module require authentication.
 * authenticate reads the JWT from the Authorization header,
 * verifies it, and attaches req.user = { sub, role, firstName }.
 * If the token is missing or invalid, authenticate returns 401
 * and the controller never runs.
 */

// GET /api/user/profile
// Returns the authenticated user's full profile data.
// No request body — identity comes from the JWT.
router.get('/profile', authenticate, controller.getProfile);

// PUT /api/user/profile
// Updates editable profile fields.
// Partial updates supported — only sent fields are changed.
router.put('/profile', authenticate, ...validateUpdateProfile, controller.updateProfile);

// PUT /api/user/password
// Changes the user's password.
// Requires current password to be provided and correct.
router.put('/password', authenticate, ...validateChangePassword, controller.changePassword);

module.exports = router;