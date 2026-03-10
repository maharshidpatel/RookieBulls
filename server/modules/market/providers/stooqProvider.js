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
 * Stooq endpoints used:
 *  Single quote:
 *    https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv
 *  Historical daily (full history, no date range):
 *    https://stooq.com/q/d/l/?s=aapl.us&i=d
 *
 * Ticker format:
 *  Stooq requires lowercase ticker with .us suffix — AAPL → aapl.us
 *
 * Request strategy — strictly 1 Stooq request per function per call:
 *
 *  getPrice(ticker):
 *    Single quote request only.
 *    Returns raw OHLC fields — no prevClose, no change, no changePercent.
 *    All derived fields (prevClose, change, changePercent) are calculated
 *    in service.js using the candles cache — no second Stooq call needed.
 *
 *  getHistorical(ticker):
 *    Full history request — no date range, Stooq returns all available data.
 *    Called by service.js only on cache miss.
 *    Cache TTL is set to expire at next market open so the graph is always
 *    fresh at the start of each trading session.
 *    After caching, all chart ranges (5D/1M/3M/6M/1Y/2Y/5Y/All) are served
 *    from Redis — zero additional Stooq calls per trading day per ticker.
 *
 * Rate limit handling:
 *  Stooq returns plain text "Exceeded the daily hits limit" when the IP
 *  has made too many requests. Both functions detect this and throw 429.
 *  The Redis cache strategy ensures getHistorical is called at most once
 *  per ticker per trading day, keeping total requests well within limits.
 *
 * Data disclaimer:
 *  Stooq provides delayed data (~15 minutes behind exchange).
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
 * Returns true if Stooq returned a rate limit message instead of CSV.
 */
const isRateLimited = (data) =>
  typeof data === 'string' && data.includes('Exceeded')

// ── getPrice(ticker) ──────────────────────────────────────────────────────
//
// Fetches the current delayed quote for a single ticker.
// One Stooq request per call — quote endpoint only.
//
// Does NOT calculate prevClose, change, or changePercent.
// Those are derived in service.js using the candles Redis cache,
// which avoids any additional Stooq requests.
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
// Fetches the complete daily OHLCV history for a ticker from Stooq.
// No date range parameters — Stooq returns all available data.
//
// This is called by service.js only on a Redis cache miss.
// The result is cached until the next market open (9:30 AM ET).
// All chart ranges are sliced from this single cached dataset:
//   5D  → last 7 calendar days of rows
//   1M  → last 30 calendar days of rows
//   3M  → last 90 calendar days of rows
//   6M  → last 180 calendar days of rows
//   1Y  → last 365 calendar days of rows
//   2Y  → last 730 calendar days of rows
//   5Y  → last 1825 calendar days of rows
//   All → entire array
//
// The second-to-last row's close is also used by service.js as prevClose
// when the market is open — no separate history request needed for that.
//
// Returns:
//  Array of candle objects, oldest first (Stooq's natural order):
//  [{ time, open, high, low, close, volume }]
//  time is YYYY-MM-DD string.
//
// Throws:
//  429 — Stooq daily request limit exceeded
//  404 — no data found for ticker
//  503 — Stooq unreachable or request timed out
const getHistorical = async (ticker) => {
  const symbol = toStooqSymbol(ticker)

  // No d1/d2 date range — returns full history from IPO to today.
  // Stooq excludes non-trading days (weekends, holidays) automatically.
  const url = `https://stooq.com/q/d/l/?s=${symbol}&i=d`

  try {
    const response = await axios.get(url, { timeout: 20000 })

    // Detect rate limit before attempting CSV parse
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

    // Map to clean candle objects.
    // Stooq returns oldest first — preserved here.
    // QuotePage receives oldest-first and passes directly to recharts.
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

module.exports = { getPrice, getHistorical }