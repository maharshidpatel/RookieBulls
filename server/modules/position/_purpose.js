/*
 * MODULE: position
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Tracks the current state of a user's holdings.
 *   A Position document represents how many shares of a given ticker
 *   a user currently owns and what they paid for them on average.
 *
 * RESPONSIBILITIES:
 *   - Create a new position when a user buys a stock they do not yet hold
 *   - Update quantity and avgBuyPrice when a user buys more of the same stock
 *   - Reduce quantity when a user sells
 *   - Delete the position document when quantity reaches zero (position closed)
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Trade execution logic (belongs in trade/service.js)
 *   - Wallet or credit operations (belongs in wallet/service.js)
 *   - PnL calculations (belongs in portfolio/service.js)
 *   - HTTP handling (belongs in trade/controller.js)
 *
 * RELATIONSHIP TO TRADE:
 *   A Trade is a permanent record of what happened.
 *   A Position is the live running total of what the user currently holds.
 *   Every trade mutates a position. Trades are never modified.
 *
 * REQUEST FLOW:
 *   trade/service.js
 *     → position/service.js  (create, update, or close position)
 *     → position/model.js    (MongoDB read and write)
 */