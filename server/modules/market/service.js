/**
 * market/service.js — Market Data Service
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RESPONSIBILITY:
 *  Single point of contact between the application and all market data.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * REDIS KEY REFERENCE:
 *
 *  price:TICKER         number    90s / nextOpen TTL
 *                                 written every tick + closing job
 *
 *  quote:TICKER         object    90s / nextOpen TTL
 *                                 shape: { price, change, changePercent,
 *                                          high, low, open, closingPrice,
 *                                          timestamp }
 *                                 NOTE: no prevClose field in quote object
 *                                 change/changePercent = price vs prevClose:TICKER
 *                                 closingPrice = yesterday's close (display only)
 *
 *  prevClose:TICKER     number    nextOpen TTL
 *                                 written by opening job at 9:45 AM
 *                                 = yesterday's closing price
 *                                 used by portfolio for dayChange calculation
 *
 *  closingPrice:TICKER  number    nextOpen + 6.5h TTL
 *                                 written by closing job at 4:16 PM
 *                                 = today's closing price
 *                                 displayed as "Prev Close" on QuotePage
 *                                 becomes tomorrow's prevClose via opening job
 *
 *  candles:TICKER       array     nextOpen TTL
 *                                 written by resolveQuote() on first visit
 *                                 read by getCandles() for chart
 *
 *  profile:TICKER       object    nextOpen TTL
 *
 * ─────────────────────────────────────────────────────────────────────────
 * resolveQuote() — THREE PATHS:
 *
 *  Path A — cache hit, change !== null:
 *    Returns immediately — 0 Stooq calls
 *    Normal case from day 2 onward for held/watched tickers
 *
 *  Path B — cache hit, change === null (prevClose was cold on last write):
 *    Fetches candles — 1 history call
 *    Extracts prevClose (second-to-last entry) and closingPrice (last entry)
 *    Rewrites quote:TICKER with accurate change/changePercent/closingPrice
 *    Writes prevClose:TICKER if cold (bootstrap only — opening job owns this)
 *    Writes closingPrice:TICKER if cold (bootstrap — closing job owns this)
 *    Runs at most once per ticker per session
 *
 *  Path C — cache miss (brand new ticker):
 *    Same 1 history call — builds quote from scratch
 *    Bootstraps prevClose:TICKER and closingPrice:TICKER if cold
 */

const { get, set, sadd, expireat } = require('./cache/redisClient')
const stooq = require('./providers/stooqProvider')
const {
  isMarketOpen: calcMarketOpen,
  secondsUntilNextMarketOpen,
} = require('./utils/marketHours')
const { searchTickers: searchInMemory } = require('./utils/tickerSearch')

const TTL_PRICE = 90

// closingPrice:TICKER bootstrap TTL — matches closing job TTL
const closingPriceTTL = () => secondsUntilNextMarketOpen() + (6.5 * 3600)

// ── getPrice(ticker) ──────────────────────────────────────────────────────
//
// Returns current delayed price as a number.
// Used by trade/service.js only.
// Redis hit always after first updater tick.
// Cold start fallback: stooq.getPrice() — near never reached in production.
const getPrice = async (ticker) => {
  const normalized = ticker.toUpperCase()
  const cached     = await get(`price:${normalized}`)
  if (cached) return parseFloat(cached)

  const raw = await stooq.getPrice(normalized)
  await set(`price:${normalized}`, raw.price, TTL_PRICE)
  return raw.price
}

// ── resolveQuote(ticker, trackWatched) ────────────────────────────────────
//
// Returns full quote object for a single ticker.
//
// Quote object shape:
//  { ticker, price, change, changePercent, high, low, open, closingPrice, timestamp }
//
//  change/changePercent  — price movement vs yesterday's close
//  closingPrice          — yesterday's closing price (QuotePage "Prev Close" display)
//
// trackWatched (default false):
//  true  — called from QuotePage endpoint, adds to watched:tickers
//  false — portfolio fallback, held tickers already in Position.distinct()
const resolveQuote = async (ticker, trackWatched = false) => {
  const normalized = ticker.toUpperCase()
  const cacheKey   = `quote:${normalized}`

  const cached = await get(cacheKey)
  if (cached) {
    const parsed = JSON.parse(cached)

    // Path A — change is valid, return immediately
    if (parsed.change !== null) {
      return { ticker: normalized, ...parsed }
    }

    // Path B — change is null, prevClose was cold when this was written
    // Fetch candles to get prevClose and closingPrice, fix the quote
    try {
      const candles = await stooq.getHistorical(normalized)

      if (candles && candles.length >= 2) {
        const last         = candles[candles.length - 1]
        const prevClose    = candles[candles.length - 2].close

        const marketOpen = await calcMarketOpen()
        const quoteTTL   = marketOpen ? TTL_PRICE : secondsUntilNextMarketOpen()
        
        const closingPrice = marketOpen
        ? candles[candles.length - 2].close   // yesterday's close
        : last.close                          // today's confirmed final close

        const price         = parsed.price // keep updater's fresher price
        const change        = parseFloat((price - prevClose).toFixed(2))
        const changePercent = parseFloat(((change / prevClose) * 100).toFixed(2))

        const updatedQuote = { ...parsed, change, changePercent, prevClose }

        const candleTTL  = secondsUntilNextMarketOpen()

        await set(cacheKey, JSON.stringify(updatedQuote), quoteTTL)
        await set(`candles:${normalized}`, JSON.stringify(candles), candleTTL)

        // Bootstrap prevClose:TICKER only if cold
        // Opening job owns this key — do not overwrite if it already exists
        const existingPrevClose = await get(`prevClose:${normalized}`)
        if (!existingPrevClose) {
          await set(`prevClose:${normalized}`, prevClose, secondsUntilNextMarketOpen())
        }

        // Bootstrap closingPrice:TICKER only if cold
        // Closing job owns this key — do not overwrite if it already exists
        const existingClosingPrice = await get(`closingPrice:${normalized}`)
        if (!existingClosingPrice) {
          await set(`closingPrice:${normalized}`, closingPrice, closingPriceTTL())
        }

        if (marketOpen && trackWatched) {
          await sadd('watched:tickers', normalized)
          await expireat('watched:tickers', candleTTL)
        }

        return { ticker: normalized, ...updatedQuote }
      }
    } catch {
      // Candles fetch failed — return cached quote with null change
      // Frontend displays '--' via null guards
    }

    return { ticker: normalized, ...parsed }
  }

  // Path C — cache miss, brand new ticker
  // One history call gives everything: price, OHLC, prevClose, candles for chart
  const candles = await stooq.getHistorical(normalized)

  if (!candles || candles.length < 2) {
    const err = new Error(`Insufficient data for ticker: ${normalized}`)
    err.statusCode = 404
    throw err
  }

  const candleTTL    = secondsUntilNextMarketOpen()
  await set(`candles:${normalized}`, JSON.stringify(candles), candleTTL)

  const last         = candles[candles.length - 1]
  const prevClose    = candles[candles.length - 2].close

  const marketOpen = await calcMarketOpen()
  
  const closingPrice = marketOpen
  ? candles[candles.length - 2].close   // yesterday's close
  : last.close                          // today's confirmed final close

  const price         = last.close
  const change        = parseFloat((price - prevClose).toFixed(2))
  const changePercent = parseFloat(((change / prevClose) * 100).toFixed(2))

  const quote = {
    price,
    change,
    changePercent,
    high:         last.high,
    low:          last.low,
    open:         last.open,
    prevClose,
    timestamp:    new Date().toISOString(),
  }

  const quoteTTL   = marketOpen ? TTL_PRICE : candleTTL

  await set(cacheKey,              JSON.stringify(quote), quoteTTL)
  await set(`price:${normalized}`, price,                 quoteTTL)

  // Bootstrap prevClose:TICKER and closingPrice:TICKER only if cold
  // These keys are owned by the updater jobs — never overwrite existing values
  const existingPrevClose = await get(`prevClose:${normalized}`)
  if (!existingPrevClose) {
    await set(`prevClose:${normalized}`, prevClose, secondsUntilNextMarketOpen())
  }

  const existingClosingPrice = await get(`closingPrice:${normalized}`)
  if (!existingClosingPrice) {
    await set(`closingPrice:${normalized}`, closingPrice, closingPriceTTL())
  }

  if (marketOpen && trackWatched) {
    await sadd('watched:tickers', normalized)
    await expireat('watched:tickers', candleTTL)
  }

  return { ticker: normalized, ...quote }
}

// ── searchTickers(query) ──────────────────────────────────────────────────
const searchTickers = async (query) => searchInMemory(query)

// ── isMarketOpen() ────────────────────────────────────────────────────────
const isMarketOpen = async () => calcMarketOpen()

// ── getStockProfile(ticker) ───────────────────────────────────────────────
//
// Returns company profile from SEC EDGAR.
// Cached until next market open — refreshed each trading session.
const getStockProfile = async (ticker) => {
  const normalized = ticker.toUpperCase()
  const cacheKey   = `profile:${normalized}`

  const cached = await get(cacheKey)
  if (cached) return JSON.parse(cached)

  const secProvider = require('./providers/secProvider')
  const profile     = await secProvider.getStockProfile(normalized)

  await set(cacheKey, JSON.stringify(profile), secondsUntilNextMarketOpen())
  return profile
}

// ── getCandles(ticker) ────────────────────────────────────────────────────
//
// Returns full OHLCV history for QuotePage chart.
// resolveQuote() caches candles before QuotePage calls this — always a hit.
// Only reaches Stooq if candles expired and resolveQuote() not yet called.
const getCandles = async (ticker) => {
  const normalized = ticker.toUpperCase()
  const cacheKey   = `candles:${normalized}`

  const cached = await get(cacheKey)
  if (cached) return JSON.parse(cached)

  const candles = await stooq.getHistorical(normalized)
  await set(cacheKey, JSON.stringify(candles), secondsUntilNextMarketOpen())
  return candles
}

module.exports = {
  getPrice,
  resolveQuote,
  searchTickers,
  isMarketOpen,
  getStockProfile,
  getCandles,
}