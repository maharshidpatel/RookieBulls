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
 * How it fits into the request flow:
 *  market/service.js checks Redis first.
 *  On a cache miss, service.js calls stooqProvider.getPrice() or
 *  stooqProvider.getHistorical(), stores the result in Redis,
 *  then returns it to the controller.
 *  This file is never called directly by a controller.
 *
 * Stooq endpoints used:
 *  Single quote:
 *    https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv
 *  Historical daily:
 *    https://stooq.com/q/d/l/?s=aapl.us&d1=YYYYMMDD&d2=YYYYMMDD&i=d
 *
 * Ticker format:
 *  Stooq requires lowercase ticker with .us suffix
 *  AAPL → aapl.us
 *
 * Data disclaimer:
 *  Stooq provides delayed data (approximately 15 minutes behind exchange).
 *  All public-facing pages must display:
 *  "All prices are delayed approximately 15 minutes and are provided
 *   for simulation purposes only."
 */

const axios = require('axios')

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * toStooqSymbol(ticker)
 *
 * Converts a standard uppercase ticker to Stooq's required format.
 * Stooq uses lowercase symbols with a market suffix.
 * .us = US exchange (NYSE and Nasdaq)
 *
 * Example: AAPL → aapl.us
 */
const toStooqSymbol = (ticker) => `${ticker.toLowerCase()}.us`

/**
 * formatDate(date)
 *
 * Formats a JavaScript Date object into YYYYMMDD string.
 * Required by Stooq's historical endpoint date parameters.
 *
 * Example: new Date('2024-01-15') → '20240115'
 */
const formatDate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * parseCSV(csvText)
 *
 * Parses a CSV string into an array of objects.
 * First row is treated as headers.
 * Subsequent rows are mapped to header keys.
 *
 * Why manual parsing instead of a CSV library:
 *  Stooq CSV is simple — no quoted fields, no commas inside values.
 *  A small manual parser avoids an extra dependency.
 *
 * Example input:
 *  Symbol,Date,Time,Open,High,Low,Close,Volume
 *  AAPL,2024-01-15,16:00:00,185.00,186.00,184.00,185.50,50000000
 *
 * Example output:
 *  [{ Symbol: 'AAPL', Date: '2024-01-15', Close: '185.50', ... }]
 */
const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const row = {}
    headers.forEach((header, i) => {
      row[header] = values[i]
    })
    return row
  })
}

// ── Exports ───────────────────────────────────────────────────────────────

/**
 * getPrice(ticker)
 *
 * Fetches the current delayed quote for a single ticker from Stooq.
 *
 * Stooq URL format breakdown:
 *  /q/l/         — quote endpoint (latest price)
 *  ?s=aapl.us    — symbol in Stooq format
 *  &f=sd2t2ohlcv — fields to return:
 *                    s  = symbol
 *                    d2 = date
 *                    t2 = time
 *                    o  = open
 *                    h  = high
 *                    l  = low
 *                    c  = close
 *                    v  = volume
 *  &h            — include header row in CSV
 *  &e=csv        — response format
 *
 * Returns:
 *  {
 *    price,          — current close price (number)
 *    change,         — price change from previous close (number)
 *    changePercent,  — change as a percentage (number)
 *    high,           — session high (number)
 *    low,            — session low (number)
 *    open,           — session open (number)
 *    prevClose,      — previous session close (number)
 *    timestamp,      — ISO string of the quote date and time
 *  }
 *
 * Throws:
 *  404 — ticker not found or no data returned by Stooq
 *  503 — Stooq is unreachable
 */
const getPrice = async (ticker) => {
  const symbol = toStooqSymbol(ticker)
  const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`

  try {
    const response = await axios.get(url, { timeout: 8000 })
    const rows = parseCSV(response.data)

    // Stooq returns a row with 'N/D' values if the ticker does not exist
    // or if markets are closed and no delayed data is available.
    // Treat any row where Close is missing or 'N/D' as not found.
    if (!rows.length || !rows[0].Close || rows[0].Close === 'N/D') {
      const error = new Error(`Ticker not found or no data available: ${ticker}`)
      error.statusCode = 404
      throw error
    }

    const row = rows[0]

    const close = parseFloat(row.Close)
    const open = parseFloat(row.Open)
    const high = parseFloat(row.High)
    const low = parseFloat(row.Low)

    // Stooq does not return previous close directly.
    // We calculate change and changePercent after fetching historical
    // data in getHistorical(). For the single quote endpoint, we
    // derive prevClose from close and open as an approximation.
    // The portfolio service uses getQuote() which calls this function,
    // so dayChange is based on open vs close — acceptable for simulation.
    const change = parseFloat((close - open).toFixed(2))
    const changePercent = parseFloat(((change / open) * 100).toFixed(2))

    return {
      price: close,
      change,
      changePercent,
      high,
      low,
      open,
      prevClose: open, // approximation — Stooq single quote does not return prevClose
      timestamp: new Date(`${row.Date}T${row.Time}`).toISOString(),
    }

  } catch (err) {
    if (err.statusCode) throw err // re-throw our own errors

    // Axios network error — Stooq unreachable
    const error = new Error(`Stooq unreachable for ticker ${ticker}: ${err.message}`)
    error.statusCode = 503
    throw error
  }
}

/**
 * getHistorical(ticker, days)
 *
 * Fetches daily OHLCV candle data for a ticker over the last N days.
 * Used by market/service.js getCandles() which feeds the quote page chart.
 *
 * Stooq historical URL format breakdown:
 *  /q/d/l/           — historical data endpoint
 *  ?s=aapl.us        — symbol
 *  &d1=YYYYMMDD      — start date
 *  &d2=YYYYMMDD      — end date (today)
 *  &i=d              — interval: d = daily
 *
 * Returns:
 *  Array of candle objects sorted oldest to newest (required by recharts):
 *  [{ time, open, high, low, close, volume }]
 *  time is a YYYY-MM-DD string (recharts expects this format for time axes)
 *
 * Throws:
 *  404 — no historical data found for ticker
 *  503 — Stooq is unreachable
 */
const getHistorical = async (ticker, days = 90) => {
  const symbol = toStooqSymbol(ticker)

  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)

  const d1 = formatDate(from)
  const d2 = formatDate(to)

  const url = `https://stooq.com/q/d/l/?s=${symbol}&d1=${d1}&d2=${d2}&i=d`

  try {
    const response = await axios.get(url, { timeout: 8000 })
    const rows = parseCSV(response.data)

    if (!rows.length || !rows[0].Close || rows[0].Close === 'N/D') {
      const error = new Error(`No historical data found for ticker: ${ticker}`)
      error.statusCode = 404
      throw error
    }

    // Map CSV rows to candle objects
    // Sort oldest to newest — Stooq returns newest first
    const candles = rows
      .map(row => ({
        time: row.Date,                    // YYYY-MM-DD string
        open: parseFloat(row.Open),
        high: parseFloat(row.High),
        low: parseFloat(row.Low),
        close: parseFloat(row.Close),
        volume: parseInt(row.Volume, 10),
      }))
      .reverse() // oldest first for recharts time axis

    return candles

  } catch (err) {
    if (err.statusCode) throw err

    const error = new Error(`Stooq unreachable for historical data ${ticker}: ${err.message}`)
    error.statusCode = 503
    throw error
  }
}

module.exports = { getPrice, getHistorical }