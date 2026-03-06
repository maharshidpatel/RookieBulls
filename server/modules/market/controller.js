/*
 * market/controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   HTTP layer for the market module.
 *   Reads request data, calls market/service.js, and sends the response.
 *
 * RESPONSIBILITIES:
 *   - getPriceHandler    → GET /api/market/price/:ticker
 *   - getQuoteHandler    → GET /api/market/quote/:ticker
 *   - search             → GET /api/market/search?q=query
 *   - getStatus          → GET /api/market/status
 *   - getProfileHandler  → GET /api/market/profile/:ticker
 *   - getCandlesHandler  → GET /api/market/candles/:ticker
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Any external API calls (belongs in provider files)
 *   - Business logic of any kind (belongs in market/service.js)
 *   - Database operations (market module has no model)
 *   - Redis operations (belongs in market/service.js)
 *
 * REQUEST FLOW:
 *   Request → routes.js → controller.js → service.js → Redis → provider → response
 */

const {
  getPrice,
  getQuote,
  searchTickers,
  isMarketOpen,
  getStockProfile,
  getCandles,
} = require('./service')

// getPriceHandler
//
// Handles: GET /api/market/price/:ticker
//
// Reads the ticker from the URL parameter (req.params.ticker).
// Calls getPrice() in market/service.js.
// service.js checks Redis first — on a miss it calls stooqProvider.
// Returns the current delayed price as a number.
//
// Example response:
//   { ticker: 'AAPL', price: 182.10 }
//
// Errors:
//   404 — ticker not found on Stooq or no price data available
//   503 — Stooq is unreachable
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

// getQuoteHandler
//
// Handles: GET /api/market/quote/:ticker
//
// Returns the full quote object for a single ticker.
// Used by BuyPanel, SellPanel, GetQuotePopup, and the Quote page.
// Richer than /price which returns a number only.
//
// service.js checks Redis first (quote:TICKER, 90s TTL).
// On a cache miss, stooqProvider.getPrice() is called and both
// quote:TICKER and price:TICKER are written to Redis.
//
// Example response:
//   {
//     ticker: 'AAPL',
//     price: 182.10,
//     change: -1.17,
//     changePercent: -0.45,
//     high: 258.77,
//     low: 254.37,
//     open: 258.63,
//     prevClose: 258.63,
//     timestamp: '2026-03-07T03:00:19.000Z'
//   }
//
// Errors:
//   404 — ticker not found on Stooq
//   503 — Stooq is unreachable
const getQuoteHandler = async (req, res, next) => {
  try {
    const { ticker } = req.params
    const quote = await getQuote(ticker)
    res.status(200).json(quote)
  } catch (err) {
    next(err)
  }
}

// search
//
// Handles: GET /api/market/search?q=query
//
// Reads the search query from the URL query string (req.query.q).
// Calls searchTickers() in market/service.js which delegates to
// tickerSearch.js — an in-memory filter against tickers.json.
// No external API call is made. Sub-millisecond response.
//
// Returns an array of up to 10 matching stocks.
// Matches against ticker symbol and company name (case-insensitive).
//
// Example response:
//   {
//     results: [
//       { ticker: 'AAPL', companyName: 'Apple Inc.', exchange: 'Nasdaq' },
//       ...
//     ]
//   }
//
// Returns an empty results array if no matches found — not an error.
//
// Errors:
//   400 — query parameter missing or empty
const search = async (req, res, next) => {
  try {
    // req.query.q is the value after ?q= in the URL.
    // Example: GET /api/market/search?q=APP → req.query.q = 'APP'
    const { q } = req.query

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
// Calls isMarketOpen() in market/service.js which delegates to
// marketHours.js — a local calculation using:
//   - NODE_ENV check (development always returns true)
//   - Weekend check
//   - Federal holiday check (Redis cached, date.nager.at on miss)
//   - Early close days (Black Friday, Christmas Eve)
//   - EST trading hours window (9:30am–4:00pm)
//
// No external API call in development mode.
//
// Example responses:
//   { isOpen: true,  message: 'Market is open' }
//   { isOpen: false, message: 'Market is closed' }
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

// getProfileHandler
//
// Handles: GET /api/market/profile/:ticker
//
// Returns company profile data sourced from SEC EDGAR.
// Used by the Quote page (Step 6.11/6.12) to display company details
// alongside the price chart.
//
// service.js checks Redis first (profile:TICKER, 24h TTL).
// On a cache miss, secProvider.getStockProfile() is called:
//   1. Looks up CIK from tickers.json in memory
//   2. Calls SEC EDGAR submissions API with the CIK
//   3. Returns cleaned profile object
// Result is stored in Redis for 24 hours before being returned.
//
// Why 24h TTL:
//   Company profiles (name, exchange, industry) rarely change.
//   Fetching from SEC EDGAR on every request is unnecessary.
//
// Example response:
//   {
//     name: 'Apple Inc.',
//     ticker: 'AAPL',
//     exchange: 'Nasdaq',
//     industry: 'Electronic Computers',
//     description: '',
//     cik: '0000320193'
//   }
//
// Errors:
//   404 — ticker not found in tickers.json
//   503 — SEC EDGAR is unreachable
const getProfileHandler = async (req, res, next) => {
  try {
    const { ticker } = req.params
    const profile = await getStockProfile(ticker)
    res.status(200).json(profile)
  } catch (err) {
    next(err)
  }
}

// getCandlesHandler
//
// Handles: GET /api/market/candles/:ticker
//
// Returns 90 days of daily OHLCV candle data from Stooq.
// Used by the Quote page price chart (Step 6.11/6.12).
//
// service.js checks Redis first (candles:TICKER, 1h TTL).
// On a cache miss, stooqProvider.getHistorical() is called:
//   Builds a date range (today minus 90 days)
//   Fetches historical CSV from Stooq
//   Parses into array sorted oldest to newest (required by recharts)
// Result is stored in Redis for 1 hour before being returned.
//
// Why 1h TTL:
//   Daily candle data does not change intraday — a new candle is only
//   added at market close. Caching for 1 hour avoids redundant fetches
//   while keeping the data reasonably fresh.
//
// Example response:
//   {
//     candles: [
//       { time: '2026-01-10', open: 185.00, high: 186.00,
//         low: 184.00, close: 185.50, volume: 50000000 },
//       ...
//     ]
//   }
//
// Errors:
//   404 — no historical data found for ticker
//   503 — Stooq is unreachable
const getCandlesHandler = async (req, res, next) => {
  try {
    const { ticker } = req.params
    const candles = await getCandles(ticker)
    res.status(200).json({ candles })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getPriceHandler,
  getQuoteHandler,
  search,
  getStatus,
  getProfileHandler,
  getCandlesHandler,
}