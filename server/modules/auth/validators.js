/*
 * FILE: server/modules/auth/validators.js
 *
 * RESPONSIBILITY:
 *   Defines reusable input validation rules for auth-related routes.
 *   Checks that incoming request data is present, correctly formatted,
 *   and within acceptable bounds before any business logic runs.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Database queries (does not check if email already exists — that is service logic)
 *   - Password hashing
 *   - Token generation
 *   - Any HTTP response logic
 *
 * HOW IT FITS:
 *   Validators are attached directly to routes in routes.js.
 *   They run as middleware before the controller function is called.
 *   If validation fails, the request is rejected here and never reaches the controller.
 *
 * PATTERN:
 *   Each exported array is a list of middleware functions.
 *   Routes attach them like this:
 *     router.post('/register', validateRegister, controller.register)
 */

const { body, validationResult } = require('express-validator');

/*
 * VALIDATE REGISTER
 *
 * Rules applied to POST /auth/register requests.
 */
const validateRegister = [
  /*
   * body('email')
   *   Targets the 'email' field inside req.body.
   *
   * .trim()
   *   Removes surrounding whitespace before any check runs.
   *
   * .notEmpty()
   *   Fails if the field is missing or an empty string.
   *
   * .isEmail()
   *   Checks that the value matches standard email format (x@x.x).
   *
   * .normalizeEmail()
   *   Lowercases the email and resolves common aliases.
   *   Example: "User+Tag@Gmail.com" → "user@gmail.com"
   */
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),

  /*
   * body('password')
   *   Targets the 'password' field inside req.body.
   *
   * .isLength({ min: 8, max: 72 })
   *   Minimum 8: too short to be considered secure.
   *   Maximum 72: bcrypt silently truncates input beyond 72 bytes.
   *              Enforcing this here ensures the password stored in the DB
   *              is exactly the password the user believes they set.
   */
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 72 }).withMessage('Password must be between 8 and 72 characters'),

  /*
   * handleValidationErrors
   *   This middleware runs after all the rules above.
   *   It reads any errors they collected and sends a 400 response if any exist.
   *   If no errors exist, it calls next() to pass control to the controller.
   */
  handleValidationErrors,
];

/*
 * VALIDATE LOGIN
 *
 * Rules applied to POST /auth/login requests.
 * Simpler than register — we just need both fields present.
 * The service layer handles checking whether they are correct.
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),

  handleValidationErrors,
];

/*
 * HANDLE VALIDATION ERRORS
 *
 * A shared middleware function used at the end of every validator array.
 *
 * validationResult(req)
 *   Collects all errors produced by the rules above it in the chain.
 *
 * If errors exist:
 *   - Responds with HTTP 422 (Unprocessable Entity)
 *   - 422 means "we understood the request, but the data inside it is invalid"
 *   - Returns an array of error objects so the frontend knows exactly what failed
 *
 * If no errors:
 *   - Calls next() — passes control to the next middleware (the controller)
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  next();
}

module.exports = { validateRegister, validateLogin };