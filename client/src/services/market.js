/*
 * services/market.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Frontend HTTP calls to the market API endpoints.
 *   All market data the frontend needs flows through this file.
 *
 * WHY A SEPARATE SERVICE FILE:
 *   Components should not contain raw HTTP calls.
 *   If the market API URL or response shape changes, this is the
 *   only file that needs updating — not every component that uses it.
 *
 * WHY PLAIN AXIOS AND NOT axiosInstance:
 *   axiosInstance adds the Authorization header automatically.
 *   Market endpoints are public — no auth header is needed or expected.
 *   Using axiosInstance here would send a token unnecessarily.
 *   Plain axios is the correct choice for public endpoints.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Component state or rendering logic
 *   - Trade or wallet HTTP calls (belong in their own service files)
 */

import axios from 'axios'

// searchTickers(query)
//
// Calls GET /api/market/search?q=query
// Returns an array of matching stocks: [{ ticker, companyName, exchange }]
// Returns an empty array if no results found — never throws on empty.
// Throws if the server returns an error (400, 503, etc.)
export const searchTickers = async (query) => {
  const response = await axios.get('/api/market/search', {
    params: { q: query },
  })
  return response.data.results
}

// getMarketStatus()
//
// Calls GET /api/market/status
// Returns { isOpen: boolean, message: string }
// Used by the market status indicator in Step 5.8.
export const getMarketStatus = async () => {
  const response = await axios.get('/api/market/status')
  return response.data
}

// getFullQuote(ticker)
//
// Calls GET /api/market/quote/:ticker
// Returns the full quote object:
//   { ticker, price, change, changePercent, high, low, open, prevClose, timestamp }
//
// Used by:
//   GetQuotePopup — display quote data after ticker search
//   QuotePage     — initial load and 15s poll
//
// Uses plain axios — market endpoints are public, no auth header needed.
export const getFullQuote = async (ticker) => {
  const response = await axios.get(`/api/market/quote/${ticker}`);
  return response.data;
};

// getStockProfile(ticker)
//
// Calls GET /api/market/profile/:ticker
// Returns { name, ticker, exchange, industry, cik }
// Used by QuotePage to display company header information.
export const getStockProfile = async (ticker) => {
  const response = await axios.get(`/api/market/profile/${ticker}`);
  return response.data;
};

// getCandles(ticker)
//
// Calls GET /api/market/candles/:ticker
// Returns array of { time, open, high, low, close, volume } — oldest first.
// Passed directly to QuotePage chart — no reversal needed.
export const getCandles = async (ticker) => {
  const response = await axios.get(`/api/market/candles/${ticker}`);
  return response.data.candles;
};

// getTickerPrice(ticker)
//
// Calls GET /api/market/price/:ticker
// Returns { ticker, price }
//
// Used by TradePanel only — buy and sell panels need current price only.
// Reads price:TICKER from Redis — always warm after first updater tick.
// Never triggers resolveQuote() or history calls.
export const getTickerPrice = async (ticker) => {
  const response = await axios.get(`/api/market/price/${ticker}`);
  return response.data;
};