/*
 * FILE: server/modules/user/validators.js
 *
 * RESPONSIBILITY:
 *   Input validation rules for user profile endpoints.
 *   Runs before the controller to reject malformed requests early.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Database queries
 *   - Business logic
 *   - HTTP response logic
 *
 * HOW IT FITS:
 *   Attached to routes in user/routes.js.
 *   Runs after authenticate middleware, before the controller.
 */

const { body, validationResult } = require('express-validator');

/*
 * VALIDATE UPDATE PROFILE
 *
 * Rules for PUT /api/user/profile
 *
 * All fields are optional — the user may update any subset of them.
 * .optional() tells express-validator to skip the rule entirely
 * if the field is absent from the request body.
 * This allows partial updates — sending only { firstName } is valid.
 */
const validateUpdateProfile = [
  body('firstName')
    .optional()
    .trim()
    .notEmpty().withMessage('First name cannot be empty')
    .isLength({ max: 50 }).withMessage('First name must be 50 characters or fewer')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name must not contain numbers or special characters'),

  body('lastName')
    .optional()
    .trim()
    .notEmpty().withMessage('Last name cannot be empty')
    .isLength({ max: 50 }).withMessage('Last name must be 50 characters or fewer')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name must not contain numbers or special characters'),

  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Display name must be 50 characters or fewer'),

  body('country')
    .optional()
    .trim()
    .isLength({ min: 2, max: 2 }).withMessage('Country must be a 2-letter ISO code'),

  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('Phone number must be 20 characters or fewer'),

  body('bio')
    .optional()
    .trim()
    /*
     * .isLength({ max: 200 }) — enforced here AND client-side.
     * The schema does not enforce this — validator is the single
     * source of truth for the 200 character limit.
     */
    .isLength({ max: 200 }).withMessage('Bio must be 200 characters or fewer'),

  handleValidationErrors,
];

/*
 * VALIDATE CHANGE PASSWORD
 *
 * Rules for PUT /api/user/password
 *
 * All three fields are required.
 * confirmPassword is validated server-side here (must match newPassword).
 * This is intentional — password change is sensitive enough to warrant
 * server-side confirmation, unlike registration where it was client-only.
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8, max: 72 }).withMessage('New password must be between 8 and 72 characters'),

  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your new password')
    /*
     * .custom() lets you write any validation logic that built-in
     * rules cannot express.
     *
     * req.body is not directly available here — express-validator
     * passes the entire request via the second argument { req }.
     * We use that to read newPassword and compare.
     */
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  handleValidationErrors,
];

/*
 * HANDLE VALIDATION ERRORS
 *
 * Shared middleware — collects all rule failures and returns 422.
 * Identical pattern to auth/validators.js.
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

module.exports = { validateUpdateProfile, validateChangePassword };