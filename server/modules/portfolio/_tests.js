/**
 * MANUAL TESTS — portfolio module
 *
 * These tests verify the portfolio endpoint returns correct
 * position data, PnL calculations, and summary totals.
 *
 * Prerequisites:
 *  - Server running on port 5000
 *  - Docker running (MongoDB available)
 *  - A registered and logged-in user with a valid access token
 *  - At least one open position (buy a stock first via trade module)
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 1 — Empty portfolio
 * ─────────────────────────────────────────────────────────────
 * Use a fresh account with no trades.
 *
 * GET http://localhost:5000/api/portfolio/me
 * Header: Authorization: Bearer <access_token>
 *
 * Expected response:
 * {
 *   "positions": [],
 *   "summary": {
 *     "totalCostBasis": 0,
 *     "totalMarketValue": 0,
 *     "totalPnl": 0,
 *     "totalPnlPercent": 0
 *   }
 * }
 *
 * What to confirm:
 *  - positions is an empty array
 *  - all summary values are 0
 *  - no errors thrown
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 2 — Portfolio with one open position
 * ─────────────────────────────────────────────────────────────
 * First buy some shares via:
 * POST http://localhost:5000/api/trade/buy
 * Body: { "ticker": "AAPL", "quantity": 2 }
 *
 * Then fetch portfolio:
 * GET http://localhost:5000/api/portfolio/me
 * Header: Authorization: Bearer <access_token>
 *
 * Expected response shape:
 * {
 *   "positions": [
 *     {
 *       "ticker": "AAPL",
 *       "quantity": 2,
 *       "avgBuyPrice": <price at time of buy>,
 *       "currentPrice": <live delayed price from Finnhub>,
 *       "costBasis": <avgBuyPrice × 2>,
 *       "marketValue": <currentPrice × 2>,
 *       "pnl": <marketValue - costBasis>,
 *       "pnlPercent": <pnl / costBasis × 100>
 *     }
 *   ],
 *   "summary": {
 *     "totalCostBasis": <sum of all costBasis>,
 *     "totalMarketValue": <sum of all marketValue>,
 *     "totalPnl": <totalMarketValue - totalCostBasis>,
 *     "totalPnlPercent": <totalPnl / totalCostBasis × 100>
 *   }
 * }
 *
 * What to confirm:
 *  - currentPrice differs from avgBuyPrice (live vs buy price)
 *  - pnl = marketValue - costBasis (verify manually)
 *  - pnlPercent = (pnl / costBasis) × 100 (verify manually)
 *  - summary totals match the sum of position values
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 3 — Portfolio with multiple positions
 * ─────────────────────────────────────────────────────────────
 * Buy shares of two different tickers:
 * POST /api/trade/buy  { "ticker": "AAPL", "quantity": 2 }
 * POST /api/trade/buy  { "ticker": "MSFT", "quantity": 1 }
 *
 * Then fetch portfolio:
 * GET http://localhost:5000/api/portfolio/me
 *
 * What to confirm:
 *  - positions array contains two entries
 *  - summary totals are the sum across both positions
 *  - each position has its own currentPrice from Finnhub
 *
 * ─────────────────────────────────────────────────────────────
 * TEST 4 — Unauthorized request
 * ─────────────────────────────────────────────────────────────
 * GET http://localhost:5000/api/portfolio/me
 * No Authorization header
 *
 * Expected:
 * Status: 401
 * { "status": "error", "message": "..." }
 *
 * What to confirm:
 *  - Request is rejected without a valid token
 *  - Status code is 401 not 500
 */