/*
 * trade/validators.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Input validation for trade endpoints.
 *   Runs before the controller. Rejects malformed requests early
 *   so the service layer never receives invalid data.
 *
 * VALIDATES:
 *   ticker   — required, string, 1–10 characters
 *   quantity — required, integer, minimum 1
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business rules (e.g. "does the user own this stock") — belongs in service
 *   - Price checks — belongs in service
 *   - HTTP response construction — belongs in controller
 *
 * NOTE ON ticker VALIDATION:
 *   The validator checks format only — that ticker is a non-empty string.
 *   Whether the ticker exists in the mock price table is checked in
 *   market/service.js during execution. These are two separate concerns:
 *     validators.js  → is the input well-formed?
 *     service.js     → is the ticker tradeable?
 */

const { body, validationResult } = require('express-validator');

// validateTrade
//
// Validates the request body for both buy and sell endpoints.
// Both routes accept the same two fields: ticker and quantity.
// A single validator covers both to avoid duplication.
const validateTrade = [
  // ticker must be a non-empty string, max 10 characters.
  // 10 characters covers all real ticker formats (e.g. 'BRK.B' is 5 chars).
  // trim() removes accidental whitespace before validation.
  // toUpperCase() normalizes input so 'aapl' and 'AAPL' both pass.
  body('ticker')
    .trim()
    .toUpperCase()
    .notEmpty()
    .withMessage('Ticker is required')
    .isString()
    .withMessage('Ticker must be a string')
    .isLength({ max: 10 })
    .withMessage('Ticker must be 10 characters or fewer'),

  // quantity must be an integer of at least 1.
  // isInt({ min: 1 }) rejects decimals, zero, and negative numbers.
  // toInt() converts the string '5' from the request body to the number 5.
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a whole number of at least 1')
    .toInt(),
];

// handleValidationErrors
//
// Runs after validateTrade in the middleware chain.
// If any validation rule failed, responds with 422 and the error list.
// If all rules passed, calls next() and the controller takes over.
//
// 422 Unprocessable Entity — the request was well-formed HTTP but
// the data inside failed validation rules. Same pattern as auth module.
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = { validateTrade, handleValidationErrors };