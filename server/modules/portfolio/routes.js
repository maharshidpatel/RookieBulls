/*
 * portfolio/routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Defines HTTP endpoints for portfolio data.
 *
 * ROUTES:
 *   GET /api/portfolio/me — returns the authenticated user's portfolio
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic
 *   - Database access
 *   - Response construction
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { getMyPortfolio } = require('./controller');

// GET /api/portfolio/me
// Protected — requires valid JWT.
// No validators needed — no request body, userId comes from the token.
router.get('/me', authenticate, getMyPortfolio);

module.exports = router;