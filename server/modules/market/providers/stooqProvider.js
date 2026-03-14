/**
 * market/providers/stooqProvider.js — Stooq Data Provider
 *
 * Responsibility:
 *  Fetches delayed stock price data from Stooq and returns clean
 *  JavaScript objects. This is the only file in the application
 *  that communicates with Stooq.
 *
 * What does not belong here:
 *  No Redis, no caching, no business logic, no HTTP handlers.
 *  This file only knows how to call Stooq and parse the response.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THREE FUNCTIONS — THREE DIFFERENT PURPOSES:
 *
 *  getPrice(ticker) — CSV, single ticker
 *    Cold start fallback only.
 *    Called by service.js getPrice() when price:TICKER is cold.
 *    Only reached on absolute first server run with zero positions.
 *    After first price updater tick, price:TICKER is always warm
 *    and this function is never called again in normal operation.
 *    Returns: { price, high, low, open, timestamp }
 *
 *  getHistorical(ticker) — CSV, full history
 *    Primary data source for resolveQuote().
 *    Called on QuotePage visit when quote:TICKER is cold or prevClose: null.
 *    Returns complete daily OHLCV array (IPO to today).
 *    Last entry = current delayed price (Stooq updates in real time).
 *    Second-to-last entry = prevClose (yesterday's close).
 *    One call provides: current price, OHLC, prevClose, full chart data.
 *    Cached until next market open — called at most once per ticker per day.
 *    Returns: [{ time, open, high, low, close, volume }] oldest first
 *
 *  getPriceBatch(tickers) — JSON, multiple tickers
 *    Called by priceUpdater.js every 60 seconds during market hours.
 *    Single HTTP request for ALL held + watched tickers combined.
 *    390 calls/day regardless of ticker count.
 *    JSON format used (not CSV) — confirmed working with + separator.
 *    CSV batch was unreliable — crammed all tickers into one row.
 *    Returns: Map of ticker → { price, high, low, open, timestamp }
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STOOQ ENDPOINTS:
 *
 *  Single quote (CSV):
 *    https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv
 *
 *  Full history (CSV):
 *    https://stooq.com/q/d/l/?s=aapl.us&i=d
 *    No date range — Stooq returns all available data from IPO.
 *    Excludes weekends and holidays automatically.
 *
 *  Batch quote (JSON):
 *    https://stooq.com/q/l/?s=aapl.us+msft.us+tsla.us&f=sd2t2ohlcv&h&e=json
 *    + separator confirmed working. Comma separator does not work.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TICKER FORMAT:
 *  Stooq requires lowercase with .us suffix — AAPL → aapl.us
 *
 * RATE LIMIT HANDLING:
 *  Stooq returns plain text "Exceeded the daily hits limit" on IP ban.
 *  All three functions detect this and throw 429.
 *  Cache strategy keeps total daily calls well within limits:
 *    getHistorical: at most once per ticker per trading day
 *    getPriceBatch: 390 fixed calls/day regardless of ticker count
 *    getPrice:      near zero in production
 *
 * DATA DISCLAIMER:
 *  Stooq provides delayed data (~15 minutes behind exchange).
 *  Platform adjusted to 9:45 AM open / 4:15 PM close to match.
 *  All public-facing pages must label data as delayed.
 */

const axios = require('axios')

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * toStooqSymbol(ticker)
 * Converts uppercase ticker to Stooq format.
 * Example: AAPL → aapl.us
 */
const toStooqSymbol = (ticker) => `${ticker.toLowerCase()}.us`

/**
 * parseCSV(csvText)
 * Parses Stooq CSV response into array of row objects.
 * First row is headers. Stooq CSV has no quoted fields or embedded commas.
 */
const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const row = {}
    headers.forEach((header, i) => { row[header] = values[i] })
    return row
  })
}

/**
 * isValidRow(row)
 * Returns false if Stooq returned N/D — ticker not found or no data.
 */
const isValidRow = (row) =>
  row && row.Close && row.Close !== 'N/D' && row.Open && row.Open !== 'N/D'

/**
 * isRateLimited(responseData)
 * Returns true if Stooq returned a rate limit message instead of data.
 * Applies to both CSV and JSON responses.
 */
const isRateLimited = (data) =>
  typeof data === 'string' && data.includes('Exceeded')

// ── Request counters ──────────────────────────────────────────────────────
//
// Tracks Stooq calls since server start — resets on restart.
// Two counters:
//   quote   — getPrice() + getPriceBatch() calls
//   history — getHistorical() calls
//
// Expected daily values in normal operation:
//   quote:   390  (1 batch/min × 390 market minutes)
//   history: ~10  (1 per unique ticker, QuotePage first visit only)
//   total:   ~400
//
// If quote counter grows beyond 395/day — investigate unexpected getPrice() calls.
// If history counter grows beyond unique ticker count — cache TTL may be wrong.
const counters = {
  quote:   0,
  history: 0,
}

const logCounters = () => {
  console.log(
    `Stooq counters — quotes: ${counters.quote}, history: ${counters.history}` +
    ` (total: ${counters.quote + counters.history})`
  )
}

// ── getPrice(ticker) ──────────────────────────────────────────────────────
//
// Fetches current delayed quote for a single ticker via CSV.
// Cold start fallback only — called by service.js getPrice() when
// price:TICKER is cold (first ever run, zero positions in DB).
// After first price updater tick, price:TICKER is warm and this
// function is never reached again in normal operation.
//
// Does NOT calculate prevClose, change, or changePercent.
// resolveQuote() uses getHistorical() for all derived fields.
//
// Returns:
//  { price, high, low, open, timestamp }
//
// Throws:
//  404 — ticker not found or N/D returned
//  503 — Stooq unreachable or request timed out
const getPrice = async (ticker) => {
  const symbol   = toStooqSymbol(ticker)
  const quoteUrl = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`

  try {
    counters.quote++
    logCounters()

    const response  = await axios.get(quoteUrl, { timeout: 8000 })
    const quoteRows = parseCSV(response.data)

    if (!quoteRows.length || !isValidRow(quoteRows[0])) {
      const error = new Error(`Ticker not found or no data available: ${ticker}`)
      error.statusCode = 404
      throw error
    }

    const row = quoteRows[0]

    return {
      price:     parseFloat(row.Close),
      high:      parseFloat(row.High),
      low:       parseFloat(row.Low),
      open:      parseFloat(row.Open),
      timestamp: new Date(`${row.Date}T${row.Time}`).toISOString(),
    }

  } catch (err) {
    if (err.statusCode) throw err
    const error = new Error(`Stooq unreachable for ticker ${ticker}: ${err.message}`)
    error.statusCode = 503
    throw error
  }
}

// ── getHistorical(ticker) ─────────────────────────────────────────────────
//
// Fetches complete daily OHLCV history for a ticker via CSV.
// Primary data source for resolveQuote() in service.js.
//
// Why one call covers everything:
//   Last entry     = current delayed price, OHLC (updates in real time)
//   Second-to-last = prevClose (yesterday's completed session)
//   Full array     = cached for chart, all ranges sliced client-side
//
// Called by resolveQuote() in two situations:
//   1. quote:TICKER cold (new ticker, cache miss)
//   2. quote:TICKER exists but prevClose: null (first day, new position)
//
// Cached until next market open (9:45 AM ET with 15min delay applied).
// At most 1 call per ticker per trading day.
//
// Chart ranges served from this single cached dataset:
//   5D → 7 calendar days, 1M → 30, 3M → 90, 6M → 180,
//   1Y → 365, 2Y → 730, 5Y → 1825, All → entire array
//
// Returns:
//  [{ time, open, high, low, close, volume }] — oldest first (Stooq natural order)
//  time is YYYY-MM-DD string
//
// Throws:
//  429 — Stooq daily request limit exceeded
//  404 — no data found for ticker
//  503 — Stooq unreachable or request timed out
const getHistorical = async (ticker) => {
  const symbol = toStooqSymbol(ticker)
  const url    = `https://stooq.com/q/d/l/?s=${symbol}&i=d`

  try {
    counters.history++
    logCounters()

    const response = await axios.get(url, { timeout: 20000 })

    if (isRateLimited(response.data)) {
      const error = new Error('Stooq daily request limit reached. Try again at next market open.')
      error.statusCode = 429
      throw error
    }

    const rows = parseCSV(response.data)

    if (!rows.length || !isValidRow(rows[0])) {
      const error = new Error(`No historical data found for ticker: ${ticker}`)
      error.statusCode = 404
      throw error
    }

    return rows
      .filter(isValidRow)
      .map(row => ({
        time:   row.Date,
        open:   parseFloat(row.Open),
        high:   parseFloat(row.High),
        low:    parseFloat(row.Low),
        close:  parseFloat(row.Close),
        volume: parseInt(row.Volume, 10),
      }))

  } catch (err) {
    if (err.statusCode) throw err
    const error = new Error(`Stooq unreachable for historical data ${ticker}: ${err.message}`)
    error.statusCode = 503
    throw error
  }
}

// ── getPriceBatch(tickers) ────────────────────────────────────────────────
//
// Fetches current delayed quotes for multiple tickers in a single request.
// Called by priceUpdater.js every 60 seconds during market hours.
//
// Uses JSON format with + separator (CSV batch was unreliable —
// Stooq crammed all tickers into a single row).
// JSON returns a clean array with one object per ticker.
//
// Single HTTP request regardless of ticker count:
//   10 tickers  = 1 request
//   100 tickers = 1 request
//   Fixed 390 calls/day (1 per minute × 390 market minutes)
//
// Returns:
//   Map of ticker → { price, high, low, open, timestamp }
//   Missing tickers (no data from Stooq) are excluded from the map.
//
// Throws:
//   429 — Stooq daily request limit reached
//   503 — Stooq unreachable or unexpected response format
const getPriceBatch = async (tickers) => {
  if (!tickers.length) return new Map()

  const symbols = tickers.map(toStooqSymbol).join('+')
  const url     = `https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcv&h&e=json`

  try {
    counters.quote++
    logCounters()

    const response = await axios.get(url, { timeout: 15000 })
    const data     = response.data

    // Rate limit returns plain text even on JSON endpoint
    if (typeof data === 'string' && isRateLimited(data)) {
      const error = new Error('Stooq daily request limit reached.')
      error.statusCode = 429
      throw error
    }

    if (!data.symbols || !Array.isArray(data.symbols)) {
      const error = new Error('Stooq batch returned unexpected format')
      error.statusCode = 503
      throw error
    }

    const result = new Map()

    for (const item of data.symbols) {
      if (!item.close || item.close === 0) continue

      // Strip .US suffix — AAPL.US → AAPL
      const ticker = item.symbol?.replace(/\.us$/i, '').toUpperCase()
      if (!ticker) continue

      const rawTimestamp = new Date(`${item.date}T${item.time}`)
      const timestamp    = isNaN(rawTimestamp.getTime())
        ? new Date().toISOString()
        : rawTimestamp.toISOString()

      result.set(ticker, {
        price:     item.close,
        high:      item.high,
        low:       item.low,
        open:      item.open,
        timestamp,
      })
    }

    return result

  } catch (err) {
    if (err.statusCode) throw err
    const error = new Error(`Stooq batch fetch failed: ${err.message}`)
    error.statusCode = 503
    throw error
  }
}

module.exports = { getPrice, getHistorical, getPriceBatch, counters }