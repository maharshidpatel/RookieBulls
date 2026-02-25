/*
 * MODULE: trade
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   The simulation engine. Handles buy and sell operations.
 *   This is the core feature of Rookie Bulls.
 *
 * RESPONSIBILITIES:
 *   - Validate a buy or sell request
 *   - Get current price from the market module
 *   - Check the user has sufficient credits for a buy
 *   - Check the user has sufficient shares for a sell
 *   - Execute the trade: deduct/return credits via wallet module
 *   - Record the trade in the Trade collection
 *   - Update the user's position via the position module
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Position storage (belongs in position/service.js)
 *   - Wallet balance operations (belongs in wallet/service.js)
 *   - Price retrieval (belongs in market/service.js)
 *   - Portfolio calculations or PnL (belongs in portfolio/service.js)
 *   - Authentication or token handling
 *   The trade module coordinates these — it does not own them.
 *
 * IMPORTANT CONCEPT — SIMULATED EXECUTION:
 *   In real trading, orders go to an exchange and may not fill
 *   immediately. In Rookie Bulls, every order fills instantly
 *   at the current mocked price. There is no order book,
 *   no partial fills, no market impact. This is intentional
 *   for the educational simulation scope.
 *
 * REQUEST FLOW:
 *   POST /api/trade/buy  or  POST /api/trade/sell
 *     → trade/routes.js
 *     → trade/validators.js
 *     → trade/controller.js
 *     → trade/service.js
 *         → market/service.js     (get price)
 *         → wallet/service.js     (debit or credit)
 *         → position/service.js   (create or update holding)
 *         → trade/model.js        (record the trade)
 *
 * MVP SCOPE:
 *   Market buy and market sell only.
 *   Limit orders, stop losses, and options are out of scope.
 */