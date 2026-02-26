/*
 * market/controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   HTTP layer for the market module.
 *   Reads request data, calls market/service.js, and sends the response.
 *
 * RESPONSIBILITIES:
 *   - getPrice    → GET /api/market/price/:ticker
 *   - search      → GET /api/market/search?q=query
 *   - getStatus   → GET /api/market/status
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Any Finnhub API calls (belongs in market/service.js)
 *   - Business logic of any kind (belongs in market/service.js)
 *   - Database operations (market module has no model)
 *
 * REQUEST FLOW:
 *   Request → routes.js → controller.js → service.js → Finnhub → response
 */

const { getPrice, searchTickers, isMarketOpen } = require('./service')

// getPrice
//
// Handles: GET /api/market/price/:ticker
//
// Reads the ticker from the URL parameter (req.params.ticker).
// Calls getPrice() in market/service.js which calls Finnhub.
// Returns the current delayed price as a number.
//
// Example response:
//   { ticker: 'AAPL', price: 175.50 }
//
// Errors:
//   404 — ticker not recognized by Finnhub
//   503 — Finnhub is unreachable
const getPriceHandler = async (req, res, next) => {
  try {
    // req.params.ticker comes from the :ticker segment in the route URL.
    // Example: GET /api/market/price/AAPL → req.params.ticker = 'AAPL'
    const { ticker } = req.params

    const price = await getPrice(ticker)

    res.status(200).json({ ticker: ticker.toUpperCase(), price })
  } catch (err) {
    next(err)
  }
}

// search
//
// Handles: GET /api/market/search?q=query
//
// Reads the search query from the URL query string (req.query.q).
// Calls searchTickers() in market/service.js which calls Finnhub.
// Returns an array of matching stocks filtered to US common stocks.
//
// Example response:
//   {
//     results: [
//       { ticker: 'AAPL', companyName: 'Apple Inc', exchange: 'US' },
//       { ticker: 'AAPX', companyName: 'Some Other Corp', exchange: 'US' }
//     ]
//   }
//
// Returns an empty results array if no matches found — not an error.
//
// Errors:
//   400 — query parameter missing or empty
//   503 — Finnhub is unreachable
const search = async (req, res, next) => {
  try {
    // req.query.q is the value after ?q= in the URL.
    // Example: GET /api/market/search?q=APP → req.query.q = 'APP'
    const { q } = req.query

    // Reject the request if no query string was provided.
    // Calling Finnhub with an empty string wastes an API request
    // and returns meaningless results.
    if (!q || q.trim() === '') {
      const err = new Error('Search query is required')
      err.statusCode = 400
      throw err
    }

    const results = await searchTickers(q.trim())

    res.status(200).json({ results })
  } catch (err) {
    next(err)
  }
}

// getStatus
//
// Handles: GET /api/market/status
//
// Calls isMarketOpen() in market/service.js which calls Finnhub.
// Returns whether the US market is currently open or closed.
//
// Example responses:
//   { isOpen: true,  message: 'Market is open' }
//   { isOpen: false, message: 'Market is closed' }
//
// Errors:
//   503 — Finnhub market status endpoint is unreachable
const getStatus = async (req, res, next) => {
  try {
    const isOpen = await isMarketOpen()

    res.status(200).json({
      isOpen,
      // Human-readable message for the frontend market status indicator.
      // The frontend can use isOpen (boolean) for logic
      // and message (string) for display.
      message: isOpen ? 'Market is open' : 'Market is closed',
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getPriceHandler, search, getStatus }