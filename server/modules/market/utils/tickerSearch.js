/**
 * market/utils/tickerSearch.js — In-Memory Ticker Search
 *
 * Responsibility:
 *  Loads tickers.json into memory at module load time and exposes
 *  a search function that filters by ticker symbol or company name.
 *
 * What does not belong here:
 *  No Redis, no external API calls, no HTTP logic.
 *  This module only reads from memory.
 *
 * How it fits into the request flow:
 *  market/service.js calls searchTickers(query) which delegates here.
 *  The result is returned directly — no caching needed because the
 *  data is already in memory and the search is sub-millisecond.
 *
 * Why in-memory instead of a database query:
 *  tickers.json is static reference data (~10,000 entries, ~1MB).
 *  Loading it once at startup and filtering in memory is faster than
 *  any database query and uses no external resources.
 *  The data does not change between server restarts.
 */

const path = require('path')

// Load tickers.json once when this module is first required.
// Node.js caches the result of require() — subsequent calls to
// require this module return the same object without re-reading the file.
// This means the file is read from disk exactly once per server start.
const tickers = require(path.join(__dirname, '../data/tickers.json'))

/**
 * searchTickers(query)
 *
 * Searches the in-memory ticker list for matches against ticker symbol
 * or company name. Case-insensitive. Returns a maximum of 10 results.
 *
 * Why max 10:
 *  The frontend search dropdown does not need more than 10 results.
 *  Returning hundreds of matches for a short query like 'A' would
 *  send unnecessary data over the wire.
 *
 * Return shape matches the existing API contract:
 *  [{ ticker, companyName, exchange }]
 *  CIK is intentionally excluded from search results —
 *  it is an internal identifier used only by secProvider.js.
 */
const searchTickers = (query) => {
  if (!query || query.trim() === '') return []

  const q = query.trim().toLowerCase()

  return tickers
    .filter(entry =>
      entry.ticker.toLowerCase().includes(q) ||
      entry.companyName.toLowerCase().includes(q)
    )
    .slice(0, 10)
    .map(entry => ({
      ticker: entry.ticker,
      companyName: entry.companyName,
      exchange: entry.exchange,
    }))
}

module.exports = { searchTickers }