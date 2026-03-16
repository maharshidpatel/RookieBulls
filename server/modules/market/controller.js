/*
 * market/controller.js — Market Data HTTP Controller
 *
 * Responsibility:
 *  HTTP layer only. Reads request data, calls market/service.js, sends response.
 *  No business logic. No direct provider calls. No Redis.
 *
 * Endpoints:
 *  GET /api/market/price/:ticker    → getPriceHandler
 *  GET /api/market/quote/:ticker    → getQuoteHandler
 *  GET /api/market/search?q=        → search
 *  GET /api/market/status           → getStatus
 *  GET /api/market/profile/:ticker  → getProfileHandler
 *  GET /api/market/candles/:ticker  → getCandlesHandler
 */

const {
  getPrice,
  resolveQuote,
  searchTickers,
  isMarketOpen,
  getStockProfile,
  getCandles,
} = require('./service')

// getPriceHandler
// GET /api/market/price/:ticker
// Returns current delayed price as a number.
// Used by trade engine — simple number, no OHLC needed.
const getPriceHandler = async (req, res, next) => {
  try {
    const { ticker } = req.params
    const price = await getPrice(ticker)
    res.status(200).json({ ticker: ticker.toUpperCase(), price })
  } catch (err) {
    next(err)
  }
}

// getQuoteHandler
// GET /api/market/quote/:ticker
// Returns full quote object — price, change, changePercent, OHLC, closingPrice.
// Note: prevClose is stored as a separate Redis key (prevClose:TICKER), not in this object.
// Used by QuotePage, TradePanel, GetQuotePopup.
//
// Calls resolveQuote(ticker, trackWatched=true):
//   trackWatched=true — this is a direct user QuotePage visit.
//   On cache miss, ticker is added to watched:tickers so the price
//   updater includes it in subsequent batch requests.
//   Cache hit (held or previously watched ticker) = zero Stooq calls.
const getQuoteHandler = async (req, res, next) => {
  try {
    const { ticker } = req.params
    // trackWatched=true — user is viewing this ticker's quote page
    // price updater will keep it warm from next tick forward
    const quote = await resolveQuote(ticker, true)
    res.status(200).json(quote)
  } catch (err) {
    next(err)
  }
}

// search
// GET /api/market/search?q=query
// In-memory search against tickers.json — no external API, sub-millisecond.
const search = async (req, res, next) => {
  try {
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
// GET /api/market/status
// Returns { isOpen: boolean, message: string }
// marketHours.js handles weekends, holidays, early close, bypass flag.
const getStatus = async (req, res, next) => {
  try {
    const isOpen = await isMarketOpen()
    res.status(200).json({
      isOpen,
      message: isOpen ? 'Market is open' : 'Market is closed',
    })
  } catch (err) {
    next(err)
  }
}

// getProfileHandler
// GET /api/market/profile/:ticker
// Returns company profile from SEC EDGAR.
// Cached until next market open — fresh data each trading session.
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
// GET /api/market/candles/:ticker
// Returns full daily OHLCV history — all chart ranges sliced client-side.
// Cached until next market open — one Stooq call per ticker per day.
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