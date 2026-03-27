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
 * Why results are sorted before slicing:
 *  Without sorting, short queries like 'RS' fill the 10 slots with
 *  unrelated tickers that happen to contain those letters before the
 *  exact RS match appears. Sorting guarantees the most relevant match
 *  is always visible in the dropdown regardless of query length.
 *
 * Sort priority:
 *  1. Exact ticker match       — query is RS, ticker is RS
 *  2. Ticker starts with query — query is RS, ticker is RSG or RSI
 *  3. Everything else          — company name matches, partial ticker
 *
 * Return shape matches the existing API contract:
 *  [{ ticker, companyName, exchange }]
 *  CIK is intentionally excluded from search results —
 *  it is an internal identifier used only by secProvider.js.
 */
const searchTickers = (query) => {
  if (!query || query.trim() === '') return []

  const q = query.trim().toLowerCase()

  const filtered = tickers.filter(entry =>
    entry.ticker.toLowerCase().includes(q) ||
    entry.companyName.toLowerCase().includes(q)
  )

  // Sort by relevance before slicing to 10.
  // Exact ticker match ranks first, ticker starts-with ranks second,
  // all other matches (company name, partial ticker) rank third.
  filtered.sort((a, b) => {
    const aTicker = a.ticker.toLowerCase()
    const bTicker = b.ticker.toLowerCase()

    const aExact = aTicker === q
    const bExact = bTicker === q
    if (aExact && !bExact) return -1
    if (!aExact && bExact) return 1

    const aStarts = aTicker.startsWith(q)
    const bStarts = bTicker.startsWith(q)
    if (aStarts && !bStarts) return -1
    if (!aStarts && bStarts) return 1

    return 0
  })

  return filtered
    .slice(0, 10)
    .map(entry => ({
      ticker: entry.ticker,
      companyName: entry.companyName,
      exchange: entry.exchange,
    }))
}

module.exports = { searchTickers }