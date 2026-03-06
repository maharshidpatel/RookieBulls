/**
 * market/service.js — Market Data Service
 *
 * Responsibility:
 *  The single point of contact between the rest of the application
 *  and all external market data sources.
 *
 *  Every module that needs a stock price, quote, profile, or candles
 *  calls this service. No other file in the project knows that Stooq,
 *  SEC EDGAR, or Redis exist.
 *
 * THE MIDDLEMAN PATTERN:
 *   Trade Service / Portfolio Service / Controllers
 *                 │
 *                 ▼
 *       market/service.js        ← only file that knows about providers
 *                 │
 *          ┌──────┴──────┐
 *          ▼             ▼
 *        Redis       stooqProvider / secProvider / marketHours / tickerSearch
 *                        │
 *                        ▼
 *               Stooq / SEC EDGAR / date.nager.at
 *
 *  Redis is checked first on every external call.
 *  Providers are only called on a cache miss.
 *  Results are stored in Redis before being returned.
 *
 * WHAT CHANGED FROM PREVIOUS VERSION:
 *  - Finnhub removed entirely
 *  - getPrice()    → Redis check → stooqProvider.getPrice()
 *  - getQuote()    → Redis check → stooqProvider.getPrice()
 *  - searchTickers() → delegates to tickerSearch (in-memory, no API call)
 *  - isMarketOpen()  → delegates to marketHours (local calculation)
 *  - getStockProfile() → Redis check → secProvider.getStockProfile() (new)
 *  - getCandles()      → Redis check → stooqProvider.getHistorical()   (new)
 *
 * WHAT DOES NOT BELONG HERE:
 *  - Buy or sell logic
 *  - Wallet operations
 *  - HTTP request or response handling (req/res)
 *  - Direct axios calls — those belong in the provider files
 */

const { get, set } = require('./cache/redisClient')
const stooq = require('./providers/stooqProvider')
const { isMarketOpen: calcMarketOpen } = require('./utils/marketHours')
const { searchTickers: searchInMemory } = require('./utils/tickerSearch')

// TTL constants — how long each key type lives in Redis
// These are defined here so they are visible alongside the logic that uses them
const TTL_PRICE = 90        // 90 seconds — worker refreshes every 60s, 30s buffer
const TTL_CANDLES = 60 * 60 // 1 hour — daily candle data does not change intraday
const TTL_PROFILE = 60 * 60 * 24 // 24 hours — company profiles rarely change

// ── getPrice(ticker) ──────────────────────────────────────────────────────
//
// Returns the current delayed price as a number (e.g. 182.10).
// Used by trade/service.js to price buy and sell orders,
// and by portfolio/service.js to calculate market value.
//
// Flow:
//  1. Check Redis for key: price:TICKER
//  2. Cache hit  → return cached number immediately
//  3. Cache miss → call stooqProvider.getPrice()
//               → store result in Redis with 90s TTL
//               → return number
//
// Why a separate price key alongside the quote key:
//  trade/service.js and portfolio/service.js only need a number.
//  Storing price separately avoids parsing the full quote JSON
//  object every time only a number is needed.
const getPrice = async (ticker) => {
  const normalized = ticker.toUpperCase()
  const cacheKey = `price:${normalized}`

  // Step 1: Redis check
  const cached = await get(cacheKey)
  if (cached) {
    // parseFloat because Redis stores everything as a string
    return parseFloat(cached)
  }

  // Step 2: cache miss — call Stooq
  // stooqProvider.getPrice() returns the full quote object.
  // We store the full object under quote:TICKER as well so that
  // getQuote() can reuse it without a second Stooq call.
  const quote = await stooq.getPrice(normalized)

  // Store full quote object for getQuote() to reuse
  await set(`quote:${normalized}`, JSON.stringify(quote), TTL_PRICE)

  // Store just the price number for getPrice() callers
  await set(cacheKey, quote.price, TTL_PRICE)

  return quote.price
}

// ── getQuote(ticker) ──────────────────────────────────────────────────────
//
// Returns a full quote object for a single ticker.
// Used by portfolio/service.js for day change calculations,
// the GetQuotePopup component, and the Quote page.
//
// Flow:
//  1. Check Redis for key: quote:TICKER
//  2. Cache hit  → parse and return JSON object
//  3. Cache miss → call stooqProvider.getPrice()
//               → store both quote and price in Redis
//               → return quote object
//
// Return shape (unchanged from previous Finnhub version):
//  { ticker, price, change, changePercent, high, low, open, prevClose, timestamp }
const getQuote = async (ticker) => {
  const normalized = ticker.toUpperCase()
  const cacheKey = `quote:${normalized}`

  // Step 1: Redis check
  const cached = await get(cacheKey)
  if (cached) {
    // JSON.parse because the object was stored with JSON.stringify
    const quote = JSON.parse(cached)
    // Always ensure ticker is on the returned object
    return { ticker: normalized, ...quote }
  }

  // Step 2: cache miss — call Stooq
  const quote = await stooq.getPrice(normalized)

  // Store full quote and price separately so both getQuote() and
  // getPrice() benefit from this single Stooq call
  await set(cacheKey, JSON.stringify(quote), TTL_PRICE)
  await set(`price:${normalized}`, quote.price, TTL_PRICE)

  return { ticker: normalized, ...quote }
}

// ── searchTickers(query) ──────────────────────────────────────────────────
//
// Returns up to 10 matching tickers from the in-memory tickers.json list.
// No external API call. No Redis. Sub-millisecond response.
//
// Delegates entirely to tickerSearch.js which loaded tickers.json into
// memory at server startup.
//
// Return shape (unchanged from previous Finnhub version):
//  [{ ticker, companyName, exchange }]
const searchTickers = async (query) => {
  // searchInMemory is synchronous but wrapped in async to keep the
  // interface consistent with the rest of this service
  return searchInMemory(query)
}

// ── isMarketOpen() ────────────────────────────────────────────────────────
//
// Returns true if the NYSE is currently open, false otherwise.
// Delegates entirely to marketHours.js which handles:
//  - Development bypass (NODE_ENV !== 'production' → always true)
//  - Weekend check
//  - Federal holiday check (Redis cached, date.nager.at on miss)
//  - Early close days
//  - EST trading hours window (9:30am–4:00pm)
const isMarketOpen = async () => {
  return calcMarketOpen()
}

// ── getStockProfile(ticker) ───────────────────────────────────────────────
//
// Returns company profile information for a ticker.
// Used by the Quote page (Step 6.11/6.12) to display company details
// alongside the price chart.
//
// Flow:
//  1. Check Redis for key: profile:TICKER (24h TTL)
//  2. Cache hit  → parse and return JSON object
//  3. Cache miss → call secProvider.getStockProfile()
//               → store in Redis with 24h TTL
//               → return object
//
// Return shape:
//  { name, ticker, exchange, industry, description, cik }
//
// secProvider.js is required here lazily (inside the function) rather
// than at the top of this file. Reason: secProvider reads tickers.json
// via the tickerSearch module. Both are already loaded at startup.
// No circular dependency issue — just keeping the require visible
// next to the code that uses it.
const getStockProfile = async (ticker) => {
  const normalized = ticker.toUpperCase()
  const cacheKey = `profile:${normalized}`

  // Step 1: Redis check
  const cached = await get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // Step 2: cache miss — call SEC EDGAR
  const secProvider = require('./providers/secProvider')
  const profile = await secProvider.getStockProfile(normalized)

  await set(cacheKey, JSON.stringify(profile), TTL_PROFILE)

  return profile
}

// ── getCandles(ticker, days) ──────────────────────────────────────────────
//
// Returns daily OHLCV candle data for the last N days.
// Used by the Quote page chart (Step 6.11/6.12).
//
// Flow:
//  1. Check Redis for key: candles:TICKER (1h TTL)
//  2. Cache hit  → parse and return JSON array
//  3. Cache miss → call stooqProvider.getHistorical()
//               → store in Redis with 1h TTL
//               → return array
//
// Return shape:
//  [{ time, open, high, low, close, volume }]
//  Sorted oldest to newest (required by recharts time axis)
const getCandles = async (ticker, days = 90) => {
  const normalized = ticker.toUpperCase()
  const cacheKey = `candles:${normalized}`

  // Step 1: Redis check
  const cached = await get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // Step 2: cache miss — call Stooq
  const candles = await stooq.getHistorical(normalized, days)

  await set(cacheKey, JSON.stringify(candles), TTL_CANDLES)

  return candles
}

module.exports = { getPrice, getQuote, searchTickers, isMarketOpen, getStockProfile, getCandles }