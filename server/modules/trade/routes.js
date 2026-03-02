/*
 * trade/routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Defines HTTP endpoints for trade execution.
 *   Applies authentication and validation middleware before the controller.
 *
 * ROUTES:
 *   POST /api/trade/buy    — execute a buy order
 *   POST /api/trade/sell   — execute a sell order
 *
 * MIDDLEWARE ORDER (left to right on each route):
 *   authenticate          — verifies JWT, rejects unauthenticated requests
 *   validateTrade         — validates ticker and quantity fields
 *   handleValidationErrors — returns 422 if validation failed
 *   controller function   — executes the trade
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic
 *   - Direct database access
 *   - Response construction
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { validateTrade, handleValidationErrors } = require('./validators');
const { buy, sell, history } = require('./controller');

// POST /api/trade/buy
// All four middleware run in order for every buy request.
router.post('/buy', authenticate, validateTrade, handleValidationErrors, buy);

// POST /api/trade/sell
// Same middleware chain as buy — same input shape, same auth requirement.
router.post('/sell', authenticate, validateTrade, handleValidationErrors, sell);

// GET /api/trade/history
// authenticate — only the logged-in user's own trades are returned.
// No validation middleware needed — no request body, userId comes from the token.
router.get('/history', authenticate, history);

module.exports = router;