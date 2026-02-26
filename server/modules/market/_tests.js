/**
 * MANUAL TESTS — market module
 *
 * These tests verify price lookup, ticker search, and market status.
 * No authentication required — all market endpoints are public.
 *
 * Prerequisites:
 *  - Server running on port 5000
 *  - FINNHUB_API_KEY set in .env
 *  - Active internet connection (calls hit Finnhub)
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 1 — Price lookup: valid ticker
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/price/AAPL
 *
 * Expected:
 * Status: 200
 * {
 *   "ticker": "AAPL",
 *   "price": <number greater than 0>
 * }
 *
 * What to confirm:
 *  - price is a non-zero number
 *  - price is not the old hardcoded value (180)
 *  - ticker is uppercased in the response
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
 *  - same price returned as TEST 1
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 3 — Price lookup: unknown ticker
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/price/INVALIDTICKER
 *
 * Expected:
 * Status: 404
 * {
 *   "status": "error",
 *   "message": "Ticker 'INVALIDTICKER' was not found or has no price data"
 * }
 *
 * What to confirm:
 *  - Returns 404 not 500
 *  - Error message references the ticker that was not found
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 4 — Ticker search: valid query
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/search?q=APP
 *
 * Expected:
 * Status: 200
 * {
 *   "results": [
 *     { "ticker": "AAPL", "companyName": "Apple Inc", "exchange": "US" },
 *     ...
 *   ]
 * }
 *
 * What to confirm:
 *  - results is an array
 *  - each result has ticker, companyName, exchange
 *  - no ticker contains a dot (no foreign cross-listings)
 *  - maximum 10 results returned
 *  - exchange is 'US' for all results
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 5 — Ticker search: empty query
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/search?q=
 *
 * Expected:
 * Status: 400
 * { "status": "error", "message": "Search query is required" }
 *
 * What to confirm:
 *  - Empty query is rejected before hitting Finnhub
 *  - Returns 400 not 500
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 6 — Ticker search: no results
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
 * TEST 7 — Market status
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/market/status
 *
 * Expected when market is open (Mon–Fri 9:30am–4:00pm EST):
 * Status: 200
 * { "isOpen": true, "message": "Market is open" }
 *
 * Expected when market is closed (evenings, weekends, holidays):
 * Status: 200
 * { "isOpen": false, "message": "Market is closed" }
 *
 * What to confirm:
 *  - isOpen is a boolean (true/false) not a string ("true"/"false")
 *  - message matches the isOpen value
 *  - response changes correctly based on time of day
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 8 — Market status with BYPASS_MARKET_HOURS enabled
 * ─────────────────────────────────────────────────────────────
 * In server/.env set: BYPASS_MARKET_HOURS=true
 * Restart the server.
 * Run this test outside of market hours (evening or weekend).
 *
 * GET http://localhost:5000/api/market/status
 *
 * Expected:
 * Status: 200
 * { "isOpen": true, "message": "Market is open" }
 *
 * What to confirm:
 *  - Returns true even though market is actually closed
 *  - Confirms the bypass flag is working correctly
 *
 * After test: set BYPASS_MARKET_HOURS=false and restart server.
 */