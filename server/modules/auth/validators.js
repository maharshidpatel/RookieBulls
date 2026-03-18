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
 * STEP 7 ADDITIONS:
 *   validateRegister — now includes firstName and lastName rules
 *   validateResendVerification — new, validates email for resend endpoint
 */

const { body, validationResult } = require('express-validator');

/*
 * VALIDATE REGISTER
 *
 * Rules applied to POST /auth/register requests.
 *
 * Step 7 additions:
 *   firstName and lastName are now required fields.
 *   confirmPassword is intentionally NOT validated here.
 *   It is a client-side UX guard only — the server never receives it.
 */
const validateRegister = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    /*
     * .isLength({ max: 50 }) — reasonable upper bound.
     * Prevents absurdly long strings from reaching the DB.
     */
    .isLength({ max: 50 }).withMessage('First name must be 50 characters or fewer')
    /*
     * .matches(regex) — tests the value against a regular expression.
     *
     * ^[a-zA-Z\s'-]+$  breaks down as:
     *   ^         — start of string
     *   [a-zA-Z]  — any uppercase or lowercase letter
     *   \s        — spaces (for names like "Mary Jo")
     *   '         — apostrophe (for names like "O'Brien")
     *   -         — hyphen (for names like "Anne-Marie")
     *   +         — one or more of the above characters
     *   $         — end of string
     *
     * This rejects digits and all special characters except
     * apostrophe and hyphen, which are legitimate in real names.
     */
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name must not contain numbers or special characters'),

  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ max: 50 }).withMessage('Last name must be 50 characters or fewer')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name must not contain numbers or special characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .toLowerCase(),

  body('password')
    .notEmpty().withMessage('Password is required')
    /*
     * min 10: minimum acceptable length for security.
     * max 72: bcrypt silently truncates input beyond 72 bytes.
     *         Enforcing this here means the stored hash always matches
     *         exactly what the user believes their password to be.
     */
    .isLength({ min: 10, max: 72 }).withMessage('Password must be between 10 and 72 characters'),

  handleValidationErrors,
];

/*
 * VALIDATE LOGIN
 *
 * Rules applied to POST /auth/login requests.
 * Only checks that both fields are present and formatted correctly.
 * Credential correctness is handled in service.js.
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .toLowerCase(),

  body('password')
    .notEmpty().withMessage('Password is required'),

  handleValidationErrors,
];

/*
 * VALIDATE RESEND VERIFICATION
 *
 * Rules applied to POST /auth/resend-verification requests.
 * Only needs an email address — that is all the endpoint accepts.
 */
const validateResendVerification = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .toLowerCase(),

  handleValidationErrors,
];

/*
 * HANDLE VALIDATION ERRORS
 *
 * Shared middleware placed at the end of every validator array.
 * Collects all errors from the rules above and returns a 422 if any exist.
 * If no errors, calls next() to hand control to the controller.
 *
 * 422 Unprocessable Entity:
 *   The server understood the request structure but the data inside is invalid.
 *   More precise than 400 Bad Request for input validation failures.
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

module.exports = { validateRegister, validateLogin, validateResendVerification };