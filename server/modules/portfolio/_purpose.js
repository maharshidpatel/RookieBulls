/*
 * MODULE: portfolio
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Read-only aggregation layer. Tracks what a user currently owns —
 *   their open positions — and combines that data with current market
 *   prices to produce a complete view of holdings including cost basis,
 *   market value, and PnL for each position.
 *
 * RESPONSIBILITIES:
 *   - Fetch all open positions for a user from the position module
 *   - Fetch the current mock price for each ticker from the market module
 *   - Calculate costBasis, marketValue, pnl, and pnlPercent per position
 *   - Calculate portfolio-level totals across all positions
 *   - Expose portfolio summary to the frontend
 *
 * KEY CONCEPT — AVERAGE BUY PRICE:
 *   If a user buys 5 shares of AAPL at $180 then 5 more at $200,
 *   they own 10 shares with an average buy price of $190.
 *   PnL is calculated against this average, not the first price paid.
 *   This is standard portfolio accounting.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Trade execution (belongs in trade/service.js)
 *   - Position mutation (belongs in position/service.js)
 *   - Wallet or credit operations (belongs in wallet/service.js)
 *   - Price storage (belongs in market/service.js)
 *   - Writing anything to the database — this module is read-only
 *
 * RELATIONSHIP TO TRADE MODULE:
 *   Every time a trade executes, the trade module updates the relevant
 *   position via position/service.js. The portfolio module does not
 *   initiate anything — it only reads and enriches existing data.
 *
 * REQUEST FLOW:
 *   GET /api/portfolio/me
 *     → portfolio/routes.js
 *     → portfolio/controller.js
 *     → portfolio/service.js
 *         → position/service.js   (getAllPositions)
 *         → market/service.js     (getPrice per ticker)
 */