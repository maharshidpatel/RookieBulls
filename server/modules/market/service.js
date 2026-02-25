/*
 * market/service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Exposes getPrice(ticker) — the single function all other modules call
 *   when they need to know what a stock currently costs.
 *
 * AT MVP:
 *   Prices are stored in a plain JavaScript object (a map).
 *   A ticker string is the key. The price in dollars is the value.
 *   If the ticker is not in the map, an error is thrown.
 *
 * WHY A PLAIN OBJECT AND NOT A DATABASE:
 *   Prices change frequently. At MVP we have no real data source.
 *   A hardcoded map is the simplest implementation that satisfies the contract.
 *   When a real data source is added, this file is replaced — nothing else changes.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Buy or sell logic
 *   - Wallet operations
 *   - HTTP request or response handling
 */

// MOCK_PRICES is the in-memory price table.
// Key:   ticker symbol (uppercase string)
// Value: simulated price in US dollars (number)
//
// These values are intentionally hardcoded for MVP.
// They will be replaced by a live or delayed data feed in a future step.
const MOCK_PRICES = {
  AAPL: 180,
  TSLA: 250,
  MSFT: 420,
  NVDA: 900,
  AMZN: 190,
};

// getPrice(ticker)
//
// Accepts a ticker string (e.g. 'AAPL').
// Returns the mock price as a number (e.g. 180).
//
// Throws a 404 error if the ticker is not in the mock price table.
// Using statusCode (not status) — consistent with the error handling
// convention established in auth and wallet services.
//
// Normalizes the ticker to uppercase before lookup so that 'aapl',
// 'Aapl', and 'AAPL' all resolve to the same entry.
const getPrice = (ticker) => {
  const normalized = ticker.toUpperCase();
  const price = MOCK_PRICES[normalized];

  if (price === undefined) {
    const err = new Error(`Ticker '${normalized}' is not available`);
    err.statusCode = 404;
    throw err;
  }

  return price;
};

// getSupportedTickers()
//
// Returns the list of tickers the mock service supports.
// Used by the frontend to know what symbols are valid to trade.
// When a real data source is introduced, this becomes a live query.
const getSupportedTickers = () => {
  return Object.keys(MOCK_PRICES);
};

module.exports = { getPrice, getSupportedTickers };