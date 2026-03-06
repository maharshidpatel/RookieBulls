/*
 * market/routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Defines the URL structure for the market module.
 *   Maps incoming HTTP requests to the correct controller function.
 *
 * ROUTES:
 *   GET /api/market/price/:ticker    — single stock price lookup
 *   GET /api/market/search?q=query   — ticker symbol search
 *   GET /api/market/status           — market open or closed
 *   GET /api/market/quote/:ticker    — full quote object
 *   GET /api/market/profile/:ticker  — company profile from SEC EDGAR
 *   GET /api/market/candles/:ticker  — 90-day daily OHLCV candle data
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
const {
  getPriceHandler,
  getQuoteHandler,
  search,
  getStatus,
  getProfileHandler,
  getCandlesHandler,
} = require('./controller')

// GET /api/market/price/:ticker
// Returns the current delayed price for a single ticker.
router.get('/price/:ticker', getPriceHandler)

// GET /api/market/search?q=query
// Returns a list of matching US-listed common stocks.
router.get('/search', search)

// GET /api/market/status
// Returns whether the US market is currently open or closed.
router.get('/status', getStatus)

// GET /api/market/quote/:ticker
// Returns full quote object — price, change, changePercent, high, low, open, prevClose.
router.get('/quote/:ticker', getQuoteHandler)

// GET /api/market/profile/:ticker
// Returns company profile from SEC EDGAR — name, exchange, industry, description.
// Used by the Quote page to display company details alongside the price chart.
router.get('/profile/:ticker', getProfileHandler)

// GET /api/market/candles/:ticker
// Returns 90 days of daily OHLCV candle data from Stooq.
// Used by the Quote page chart.
router.get('/candles/:ticker', getCandlesHandler)

module.exports = router