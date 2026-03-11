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
 * REQUEST STRATEGY — strictly 1 Stooq request per ticker per function call:
 *
 *  getPrice() / getQuote():
 *    Single quote request via stooqProvider.getPrice().
 *    prevClose derived from candles Redis cache — no second Stooq call.
 *    If candles cache is cold, getHistorical() is called once to populate it.
 *
 *  getCandles():
 *    Redis check first. On miss, calls stooqProvider.getHistorical() once.
 *    Cached until next market open (9:30 AM ET next trading day).
 *    All chart ranges (5D/1M/3M/6M/1Y/2Y/5Y/All) sliced client-side.
 *    Zero additional Stooq calls per trading day per ticker after first load.
 *
 * CACHE TTL STRATEGY:
 *  price:TICKER     → 90 seconds (worker refreshes every 60s)
 *  quote:TICKER     → 90 seconds
 *  candles:TICKER   → until next market open (9:30 AM ET)
 *  profile:TICKER   → 24 hours
 *
 * WHAT DOES NOT BELONG HERE:
 *  - Buy or sell logic
 *  - Wallet operations
 *  - HTTP request or response handling (req/res)
 *  - Direct axios calls — those belong in the provider files
 */

const { get, set, sadd, expireat } = require('./cache/redisClient')
const stooq = require('./providers/stooqProvider')
const { isMarketOpen: calcMarketOpen } = require('./utils/marketHours')
const { searchTickers: searchInMemory } = require('./utils/tickerSearch')

// TTL constants
const TTL_PRICE   = 90           // 90 seconds — price updater refreshes every 60s
const TTL_PROFILE = 60 * 60 * 24 // 24 hours — company profiles rarely change

// ── secondsUntilNextMarketOpen() ──────────────────────────────────────────
//
// Returns the number of seconds until 9:30 AM ET on the next trading day.
// Used as the Redis TTL for candles — cache always expires at market open
// so the chart is fresh at the start of every trading session.
//
// Why this matters:
//  A fixed 24h TTL could leave stale candles serving for hours into a new
//  trading day. For example, candles cached at 11:30 AM would expire at
//  11:30 AM the next day — missing the first 2 hours of the new session.
//  Expiring at 9:30 AM guarantees the first request of each session fetches
//  fresh data.
//
// Simplified — does not account for holidays or weekends.
// On a weekend, next market open is Monday 9:30 AM ET.
// On a weekday after close, next market open is tomorrow 9:30 AM ET.
// On a weekday before open, next market open is today 9:30 AM ET.
const secondsUntilNextMarketOpen = () => {
  const nowET = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  )

  const next = new Date(nowET)
  next.setHours(9, 30, 0, 0)

  // If 9:30 AM today has already passed, move to tomorrow
  if (nowET >= next) {
    next.setDate(next.getDate() + 1)
  }

  // Skip to Monday if next open lands on Saturday or Sunday
  const day = next.getDay()
  if (day === 6) next.setDate(next.getDate() + 2) // Saturday → Monday
  if (day === 0) next.setDate(next.getDate() + 1) // Sunday → Monday

  const diffMs  = next.getTime() - nowET.getTime()
  const diffSec = Math.ceil(diffMs / 1000)

  // Minimum 60 seconds — prevents a TTL of 0 right at market open
  return Math.max(diffSec, 60)
}

// ── getPrevCloseFromCandles(normalized) ───────────────────────────────────
//
// Reads the candles Redis cache and returns the second-to-last row's close
// as prevClose. If cache is cold, fetches full history and populates it.
//
// Called by getPrice() and getQuote() when market is open.
// Avoids any additional Stooq quote or history requests for prevClose.
//
// Returns prevClose as a number, or null if unavailable.
const getPrevCloseFromCandles = async (normalized) => {
  const candleKey = `candles:${normalized}`
  let candles

  const cached = await get(candleKey)
  if (cached) {
    candles = JSON.parse(cached)
  } else {
    // Cache cold — fetch full history and cache it
    try {
      candles = await stooq.getHistorical(normalized)
      const ttl = secondsUntilNextMarketOpen()
      await set(candleKey, JSON.stringify(candles), ttl)
    } catch {
      // History unavailable — prevClose will fall back to open in caller
      return null
    }
  }

  // Second-to-last row = previous completed session = prevClose
  if (candles && candles.length >= 2) {
    return candles[candles.length - 2].close
  }

  return null
}

// ── getPrice(ticker) ──────────────────────────────────────────────────────
//
// Returns the current delayed price as a number (e.g. 182.10).
// Used by trade/service.js to price buy and sell orders,
// and by portfolio/service.js to calculate market value.
//
// Flow:
//  1. Check Redis for key: price:TICKER (90s TTL)
//  2. Cache hit  → return cached number immediately
//  3. Cache miss → call stooqProvider.getPrice() — 1 Stooq request
//               → store price and quote in Redis
//               → return number
const getPrice = async (ticker) => {
  const normalized = ticker.toUpperCase()
  const cacheKey   = `price:${normalized}`

  // Step 1: Redis check
  const cached = await get(cacheKey)
  if (cached) {
    return parseFloat(cached)
  }

  // Step 2: cache miss — fetch quote from Stooq (1 request)
  const raw        = await stooq.getPrice(normalized)
  const marketOpen = await calcMarketOpen()

  // Derive prevClose — from candles cache when market is open,
  // current price when market is closed (close price = completed session)
  let prevClose = raw.open // fallback
  if (!marketOpen) {
    prevClose = raw.price
  } else {
    const fromCandles = await getPrevCloseFromCandles(normalized)
    if (fromCandles !== null) prevClose = fromCandles
  }

  const change        = parseFloat((raw.price - prevClose).toFixed(2))
  const changePercent = parseFloat(((change / prevClose) * 100).toFixed(2))

  const quote = {
    price:         raw.price,
    change,
    changePercent,
    high:          raw.high,
    low:           raw.low,
    open:          raw.open,
    prevClose,
    timestamp:     raw.timestamp,
  }

  // After hours: cache until next market open — one Stooq call per ticker per session
  // During hours: 90 second TTL — price updater keeps it fresh
  const ttl = marketOpen ? TTL_PRICE : secondsUntilNextMarketOpen()

  await set(`quote:${normalized}`, JSON.stringify(quote), ttl)
  await set(cacheKey, raw.price, ttl)

  return raw.price
}

// ── getQuote(ticker) ──────────────────────────────────────────────────────
//
// Returns a full quote object for a single ticker.
// Used by portfolio/service.js, TradePanel, and QuotePage.
//
// Flow:
//  1. Check Redis for key: quote:TICKER (90s TTL)
//  2. Cache hit  → return cached object
//  3. Cache miss → call stooqProvider.getPrice() — 1 Stooq request
//               → derive prevClose from candles cache (no extra Stooq call)
//               → store quote and price in Redis
//               → return object
//
// Return shape:
//  { ticker, price, change, changePercent, high, low, open, prevClose, timestamp }
const getQuote = async (ticker) => {
  const normalized = ticker.toUpperCase()
  const cacheKey   = `quote:${normalized}`

  // Step 1: Redis check
  const cached = await get(cacheKey)
  if (cached) {
    return { ticker: normalized, ...JSON.parse(cached) }
  }

  // Step 2: cache miss — fetch quote from Stooq (1 request)
  const raw        = await stooq.getPrice(normalized)
  const marketOpen = await calcMarketOpen()

  // Derive prevClose from candles cache — no additional Stooq call
  let prevClose = raw.open // fallback
  if (!marketOpen) {
    // Market closed — current price is the completed session close
    prevClose = raw.price
  } else {
    // Market open — second-to-last candle row = previous completed session
    const fromCandles = await getPrevCloseFromCandles(normalized)
    if (fromCandles !== null) prevClose = fromCandles
  }

  const change        = parseFloat((raw.price - prevClose).toFixed(2))
  const changePercent = parseFloat(((change / prevClose) * 100).toFixed(2))

  const quote = {
    price:         raw.price,
    change,
    changePercent,
    high:          raw.high,
    low:           raw.low,
    open:          raw.open,
    prevClose,
    timestamp:     raw.timestamp,
  }

  // After hours: cache until next market open — one Stooq call per ticker per session
  // During hours: 90 second TTL — price updater keeps it fresh
  const ttl = marketOpen ? TTL_PRICE : secondsUntilNextMarketOpen()

  await set(cacheKey,              JSON.stringify(quote), ttl)
  await set(`price:${normalized}`, raw.price,             ttl)

  // Add to watched set so price updater includes this ticker in its batch.
  // Any user visiting this quote page warms the ticker for all subsequent users.
  // Set expires at next market open — clean slate each trading day.
  if (marketOpen) {
    await sadd('watched:tickers', normalized)
    await expireat('watched:tickers', secondsUntilNextMarketOpen())
  }

  return { ticker: normalized, ...quote }
}

// ── searchTickers(query) ──────────────────────────────────────────────────
//
// Returns up to 10 matching tickers from the in-memory tickers.json list.
// No external API call. No Redis. Sub-millisecond response.
const searchTickers = async (query) => {
  return searchInMemory(query)
}

// ── isMarketOpen() ────────────────────────────────────────────────────────
//
// Returns true if the NYSE is currently open, false otherwise.
// Delegates to marketHours.js which handles weekends, holidays,
// early close days, and the development bypass.
const isMarketOpen = async () => {
  return calcMarketOpen()
}

// ── getStockProfile(ticker) ───────────────────────────────────────────────
//
// Returns company profile information for a ticker.
// Used by QuotePage to display company name, exchange, industry.
//
// Flow:
//  1. Check Redis for key: profile:TICKER (24h TTL)
//  2. Cache hit  → return cached object
//  3. Cache miss → call secProvider.getStockProfile()
//               → store in Redis with 24h TTL
//               → return object
//
// Return shape:
//  { name, ticker, exchange, industry, description, cik }
const getStockProfile = async (ticker) => {
  const normalized = ticker.toUpperCase()
  const cacheKey   = `profile:${normalized}`

  const cached = await get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  const secProvider = require('./providers/secProvider')
  const profile     = await secProvider.getStockProfile(normalized)

  await set(cacheKey, JSON.stringify(profile), TTL_PROFILE)

  return profile
}

// ── getCandles(ticker) ────────────────────────────────────────────────────
//
// Returns the full daily OHLCV history for a ticker.
// Used by QuotePage chart — all ranges sliced client-side.
//
// Flow:
//  1. Check Redis for key: candles:TICKER
//  2. Cache hit  → return cached array (TTL set to next market open)
//  3. Cache miss → call stooqProvider.getHistorical() — 1 Stooq request
//               → store in Redis until next market open (9:30 AM ET)
//               → return array
//
// Cache expires at next market open — not a fixed TTL.
// This guarantees chart data is always fresh at the start of each session
// regardless of when the cache was first populated.
//
// Return shape:
//  [{ time, open, high, low, close, volume }] — oldest first
const getCandles = async (ticker) => {
  const normalized = ticker.toUpperCase()
  const cacheKey   = `candles:${normalized}`

  const cached = await get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // Cache miss — fetch full history from Stooq (1 request)
  const candles = await stooq.getHistorical(normalized)

  // TTL = seconds until 9:30 AM ET next trading day
  const ttl = secondsUntilNextMarketOpen()
  await set(cacheKey, JSON.stringify(candles), ttl)

  return candles
}

module.exports = {
  getPrice,
  getQuote,
  searchTickers,
  isMarketOpen,
  getStockProfile,
  getCandles,
}