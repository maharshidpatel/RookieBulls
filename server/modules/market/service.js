/*
 * market/service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   The single point of contact between this application and the external
 *   market data provider (Finnhub).
 *
 *   Every module that needs a stock price calls getPrice(ticker) here.
 *   No other file in the project knows that Finnhub exists.
 *
 * THE MIDDLEMAN PATTERN:
 *   Frontend / Trade Service / Portfolio Service
 *                 │
 *                 ▼
 *       market/service.js        ← only file that knows about Finnhub
 *                 │
 *                 ▼
 *            Finnhub API
 *
 *   If Finnhub is replaced with another provider in the future,
 *   this is the only file that changes. Nothing else in the project
 *   is affected.
 *
 * WHAT CHANGED FROM MVP:
 *   - MOCK_PRICES hardcoded map removed
 *   - getSupportedTickers() removed (replaced by searchTickers() in Step 5.3)
 *   - getPrice() is now async — it makes a real HTTP call to Finnhub
 *   - searchTickers() added — Step 5.3
 *   - isMarketOpen() added — Step 5.4
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Buy or sell logic
 *   - Wallet operations
 *   - HTTP request or response handling (req/res)
 *   - Any business logic beyond fetching and returning market data
 */

const axios = require('axios')
const { env } = require('../../config/env')

// FINNHUB_BASE_URL is the root URL for all Finnhub API calls.
// Defined once here so that if Finnhub changes their URL structure,
// there is a single place to update it.
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

// getPrice(ticker)
//
// Accepts a ticker string (e.g. 'AAPL').
// Returns the current delayed price as a number (e.g. 175.50).
//
// How it works:
//   1. Normalizes ticker to uppercase so 'aapl' and 'AAPL' behave identically
//   2. Calls Finnhub's quote endpoint: GET /quote?symbol=AAPL&token=...
//   3. Finnhub returns an object — we read the 'c' field (current price)
//   4. If 'c' is 0 or missing, the ticker is not recognized by Finnhub
//      (Finnhub returns { c: 0, ... } for unknown symbols, not an error)
//   5. If the Finnhub call itself fails (network, outage), throws 503
//
// Why async:
//   This function now makes a real HTTP request to an external server.
//   HTTP calls take time and can fail. async/await lets the rest of the
//   application wait for the result without blocking the entire server.
//   Every caller of getPrice() must use await.
const getPrice = async (ticker) => {
  const normalized = ticker.toUpperCase()

  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}/quote`, {
      params: {
        symbol: normalized,
        token: env.FINNHUB_API_KEY,
      },
    })

    const price = response.data.c

    if (!price || price === 0) {
      const err = new Error(`Ticker '${normalized}' was not found or has no price data`)
      err.statusCode = 404
      throw err
    }

    return price

  } catch (err) {
    if (err.statusCode) {
      throw err
    }

    console.error('Finnhub getPrice failed:', err.message)
    const serviceErr = new Error('Market data is temporarily unavailable')
    serviceErr.statusCode = 503
    throw serviceErr
  }
}

// getQuote(ticker)
//
// Returns a full quote object for a single ticker.
// Used by portfolio service, GetQuotePopup, and the Quote page.
//
// Why separate from getPrice():
//   getPrice() returns a number — simple interface for the trade engine.
//   getQuote() returns a full object — richer data for UI and portfolio math.
//   Both call the same Finnhub /quote endpoint. No extra API requests.
//
// Finnhub /quote response fields used:
//   c  → current price
//   d  → change in price since previous close (dollar amount per share)
//   dp → change percent since previous close
//   h  → day high
//   l  → day low
//   o  → day open
//   pc → previous close
//   t  → timestamp (unix seconds)
//
// Returns:
//   { ticker, price, change, changePercent, high, low, open, prevClose, timestamp }
//
// Throws 404 if the ticker is not found (c === 0).
// Throws 503 if the Finnhub call fails.
const getQuote = async (ticker) => {
  const normalized = ticker.toUpperCase()

  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}/quote`, {
      params: {
        symbol: normalized,
        token: env.FINNHUB_API_KEY,
      },
    })

    const data = response.data

    // Finnhub returns c: 0 for unknown tickers — treat as not found.
    if (!data.c || data.c === 0) {
      const err = new Error(`Ticker '${normalized}' was not found or has no price data`)
      err.statusCode = 404
      throw err
    }

    return {
      ticker:        normalized,
      price:         data.c,   // current price
      change:        data.d,   // dollar change per share since prev close
      changePercent: data.dp,  // percent change since prev close
      high:          data.h,   // day high
      low:           data.l,   // day low
      open:          data.o,   // day open
      prevClose:     data.pc,  // previous close
      timestamp:     data.t,   // unix timestamp of last quote
    }

  } catch (err) {
    if (err.statusCode) {
      throw err
    }

    console.error('Finnhub getQuote failed:', err.message)
    const serviceErr = new Error('Market data is temporarily unavailable')
    serviceErr.statusCode = 503
    throw serviceErr
  }
}

// searchTickers(query)
//
// Accepts a search string (e.g. 'APP') and returns a list of matching
// NYSE and Nasdaq listed stocks.
//
// How it works:
//   1. Calls Finnhub's symbol search endpoint: GET /search?q=APP&token=...
//   2. Finnhub returns an array of matches across all global exchanges
//   3. Two filters are applied to isolate US-listed common stocks:
//
//      Filter 1 — type === 'Common Stock'
//        Excludes ETFs, indices, warrants, preferred shares, and
//        other instrument types that appear in Finnhub's search results.
//        We only want tradeable common stocks.
//
//      Filter 2 — !symbol.includes('.')
//        Finnhub includes cross-listings of US stocks on foreign exchanges
//        (e.g. AAPL.SW for Swiss exchange, AAPL.DE for Germany).
//        US-listed stocks on NYSE and Nasdaq never contain a dot in their
//        symbol. Excluding any result with a dot removes foreign listings
//        without needing an explicit exchange filter.
//
//   4. Results are capped at 10 — a search box does not need more than
//      10 suggestions and returning hundreds of results wastes bandwidth.
//
//   5. Each result is mapped to a consistent shape:
//      { ticker, companyName, exchange }
//      exchange is set to 'US' for all results.
//
// Returns an empty array if no results match — not an error.
// Throws 503 if the Finnhub call fails.
const searchTickers = async (query) => {
  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}/search`, {
      params: {
        q: query,
        token: env.FINNHUB_API_KEY,
      },
    })

    const results = response.data.result || []

    const filtered = results
      .filter((item) => item.type === 'Common Stock')
      .filter((item) => !item.symbol.includes('.'))
      .slice(0, 10)
      .map((item) => ({
        ticker: item.symbol,
        companyName: item.description,
        exchange: 'US',
      }))

    return filtered

  } catch (err) {
    if (err.statusCode) {
      throw err
    }

    console.error('Finnhub searchTickers failed:', err.message)
    const serviceErr = new Error('Ticker search is temporarily unavailable')
    serviceErr.statusCode = 503
    throw serviceErr
  }
}

// isMarketOpen()
//
// Returns true if the US market (NYSE) is currently open, false otherwise.
// Accounts for weekends, public holidays, early closes, and timezone
// differences automatically — Finnhub handles all of that logic server-side.
//
// How it works:
//   1. Checks the BYPASS_MARKET_HOURS flag first.
//      If true, returns true immediately without calling Finnhub.
//      This allows trades to be tested at any time during development.
//      This flag must never be true in production.
//
//   2. Calls Finnhub's market status endpoint:
//      GET /stock/market-status?exchange=US&token=...
//      Finnhub returns { isOpen: true/false, ... }
//
//   3. Returns the isOpen boolean directly.
//
// Why Finnhub handles this instead of local calculation:
//   Calculating market open/close correctly requires knowing:
//   - Current time in EST/EDT (daylight saving changes twice a year)
//   - All NYSE public holidays for the current year
//   - Early close days (e.g. day before Thanksgiving, Christmas Eve)
//   Writing and maintaining that logic locally is error-prone.
//   Finnhub's endpoint is authoritative and always current.
//
// Throws 503 if the Finnhub call fails.
// In that case the trade engine in trade/service.js will block the trade
// rather than allowing it through on a failed status check.
const isMarketOpen = async () => {
  // Development bypass — skip the Finnhub call entirely.
  // env.BYPASS_MARKET_HOURS is a boolean (converted from string in env.js).
  // If true, return true immediately so trades can be tested at any hour.
  if (env.BYPASS_MARKET_HOURS) {
    return true
  }

  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}/stock/market-status`, {
      params: {
        exchange: 'US',
        token: env.FINNHUB_API_KEY,
      },
    })

    // response.data.isOpen is the only field we need.
    // true  = market is currently open, trades are allowed
    // false = market is closed, trades are blocked
    return response.data.isOpen

  } catch (err) {
    if (err.statusCode) {
      throw err
    }

    // If Finnhub's market status endpoint is unreachable, we cannot
    // confirm whether the market is open. The safe choice is to block
    // trades rather than allow them through on an unknown status.
    // Throwing 503 lets the trade engine surface a clear error to the user.
    console.error('Finnhub isMarketOpen failed:', err.message)
    const serviceErr = new Error('Unable to verify market status. Please try again.')
    serviceErr.statusCode = 503
    throw serviceErr
  }
}

module.exports = { getPrice, getQuote, searchTickers, isMarketOpen }