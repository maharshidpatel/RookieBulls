/*
 * market/routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Defines the URL structure for the market module.
 *   Maps incoming HTTP requests to the correct controller function.
 *
 * ROUTES:
 *   GET /api/market/price/:ticker   — single stock price lookup
 *   GET /api/market/search?q=query  — ticker symbol search
 *   GET /api/market/status          — market open or closed
 *
 * WHY NO AUTH MIDDLEWARE:
 *   Stock prices and market status are public information.
 *   Requiring a login to see a price would break the ticker search
 *   and market status indicator on any public-facing page.
 *   Authentication is applied at the trade level — not the price level.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic (belongs in market/service.js)
 *   - HTTP response handling (belongs in market/controller.js)
 */

const express = require('express')
const router = express.Router()
const { getPriceHandler, getQuoteHandler, search, getStatus } = require('./controller')

// GET /api/market/price/:ticker
// Returns the current delayed price for a single ticker.
// :ticker is a URL parameter — it becomes req.params.ticker in the controller.
router.get('/price/:ticker', getPriceHandler)

// GET /api/market/search?q=query
// Returns a list of matching US-listed common stocks.
// ?q= is a query string parameter — it becomes req.query.q in the controller.
router.get('/search', search)

// GET /api/market/status
// Returns whether the US market is currently open or closed.
router.get('/status', getStatus)

// GET /api/market/quote/:ticker
// Returns full quote object — price, change, changePercent, high, low, open, prevClose.
// Used by panels and quote popup — richer than /price which returns a number only.
router.get('/quote/:ticker', getQuoteHandler)

module.exports = router