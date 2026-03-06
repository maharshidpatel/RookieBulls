/**
 * MANUAL TESTS — market module
 *
 * Verifies price lookup, quote, ticker search, market status,
 * company profile, and candle data endpoints.
 *
 * No authentication required — all market endpoints are public.
 *
 * Prerequisites:
 *  - Docker running (MongoDB + Redis containers up)
 *  - Server running: cd server && npm run dev
 *  - Active internet connection (Stooq and SEC EDGAR calls)
 *
 * Data disclaimer:
 *  All prices are delayed approximately 15 minutes and are provided
 *  for simulation purposes only.
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 1 — Price lookup: valid ticker
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/price/AAPL
 *
 * Expected:
 * Status: 200
 * { "ticker": "AAPL", "price": <number greater than 0> }
 *
 * What to confirm:
 *  - price is a non-zero number
 *  - ticker is uppercased in the response
 *  - after this call, price:AAPL key appears in RedisInsight
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 2 — Price lookup: lowercase ticker
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/price/aapl
 *
 * Expected:
 * Status: 200
 * { "ticker": "AAPL", "price": <number> }
 *
 * What to confirm:
 *  - lowercase input is normalized to uppercase
 *  - same price returned as TEST 1 (served from Redis cache)
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 3 — Price lookup: unknown ticker
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/price/INVALIDTICKER
 *
 * Expected:
 * Status: 404
 * { "status": "error", "message": "Ticker not found or no data available: INVALIDTICKER" }
 *
 * What to confirm:
 *  - Returns 404 not 500
 *  - Error message references the ticker that was not found
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 4 — Full quote: valid ticker
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/quote/AAPL
 *
 * Expected:
 * Status: 200
 * {
 *   "ticker": "AAPL",
 *   "price": <number>,
 *   "change": <number>,
 *   "changePercent": <number>,
 *   "high": <number>,
 *   "low": <number>,
 *   "open": <number>,
 *   "prevClose": <number>,
 *   "timestamp": "<ISO string>"
 * }
 *
 * What to confirm:
 *  - All fields are present and are numbers (except timestamp)
 *  - after this call, quote:AAPL key appears in RedisInsight
 *  - TTL on quote:AAPL is approximately 90 seconds
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 5 — Ticker search: valid query
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/search?q=APP
 *
 * Expected:
 * Status: 200
 * {
 *   "results": [
 *     { "ticker": "AAPL", "companyName": "Apple Inc.", "exchange": "Nasdaq" },
 *     ...
 *   ]
 * }
 *
 * What to confirm:
 *  - results is an array
 *  - each result has ticker, companyName, exchange
 *  - exchange is NYSE or Nasdaq (not 'US')
 *  - maximum 10 results returned
 *  - no external API call made (in-memory search)
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 6 — Ticker search: empty query
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/search?q=
 *
 * Expected:
 * Status: 400
 * { "status": "error", "message": "Search query is required" }
 *
 * What to confirm:
 *  - Empty query rejected before any processing
 *  - Returns 400 not 500
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 7 — Ticker search: no results
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/search?q=ZZZZZZZZZ
 *
 * Expected:
 * Status: 200
 * { "results": [] }
 *
 * What to confirm:
 *  - No match returns empty array, not an error
 *  - Status is 200 not 404
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 8 — Market status
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/status
 *
 * Expected (NODE_ENV=development — always open):
 * Status: 200
 * { "isOpen": true, "message": "Market is open" }
 *
 * What to confirm:
 *  - isOpen is a boolean (true/false) not a string
 *  - message matches the isOpen value
 *  - In development, always returns true regardless of time of day
 *  - NODE_ENV=development replaces the old BYPASS_MARKET_HOURS flag
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 9 — Company profile: valid ticker
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/profile/AAPL
 *
 * Expected:
 * Status: 200
 * {
 *   "name": "Apple Inc.",
 *   "ticker": "AAPL",
 *   "exchange": "Nasdaq",
 *   "industry": "Electronic Computers",
 *   "description": "",
 *   "cik": "0000320193"
 * }
 *
 * What to confirm:
 *  - name, ticker, exchange, industry, cik are populated
 *  - description may be empty string — that is acceptable
 *  - after this call, profile:AAPL key appears in RedisInsight
 *  - TTL on profile:AAPL is approximately 24 hours
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 10 — Company profile: unknown ticker
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/profile/INVALIDTICKER
 *
 * Expected:
 * Status: 404
 * { "status": "error", "message": "Ticker not found in ticker list: INVALIDTICKER" }
 *
 * What to confirm:
 *  - Returns 404 not 500
 *  - No SEC EDGAR call is made (CIK lookup fails in memory first)
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 11 — Candle data: valid ticker
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/candles/AAPL
 *
 * Expected:
 * Status: 200
 * {
 *   "candles": [
 *     { "time": "YYYY-MM-DD", "open": <number>, "high": <number>,
 *       "low": <number>, "close": <number>, "volume": <number> },
 *     ...
 *   ]
 * }
 *
 * What to confirm:
 *  - candles is an array of objects
 *  - each candle has time, open, high, low, close, volume
 *  - time is a YYYY-MM-DD string
 *  - array is sorted oldest to newest
 *  - approximately 60-65 entries (90 calendar days minus weekends)
 *  - after this call, candles:AAPL key appears in RedisInsight
 *  - TTL on candles:AAPL is approximately 1 hour
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 12 — Redis cache hit confirmation
 * ─────────────────────────────────────────────────────────────
 * Run TEST 1 (price/AAPL) twice in quick succession.
 *
 * What to confirm:
 *  - Second call returns immediately (sub-millisecond)
 *  - No new Stooq call is made (verify via server terminal —
 *    no axios log or Stooq-related output on second call)
 *  - RedisInsight shows price:AAPL TTL counting down from 90
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 13 — Background worker verification
 * ─────────────────────────────────────────────────────────────
 * Prerequisites: at least one open position exists in the database.
 *
 * Watch the server terminal after startup.
 *
 * Expected every 60 seconds:
 *   Price updater: updated N/N tickers
 *
 * What to confirm:
 *  - Worker logs appear on a consistent 60s interval
 *  - N matches the number of unique tickers held across all positions
 *  - RedisInsight keys for held tickers reset their TTL every 60s
 */