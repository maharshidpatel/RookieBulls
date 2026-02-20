/**
 * MODULE: /server/modules/trade
 *
 * The simulation engine. Handles buy and sell operations.
 * This is the core feature of Rookie Bulls.
 *
 * Responsibilities:
 *  - Validate a buy or sell request
 *  - Get current price from the market module
 *  - Check the user has sufficient credits for a buy
 *  - Check the user has sufficient shares for a sell
 *  - Execute the trade: deduct/return credits via wallet module
 *  - Record the trade in the Trade collection
 *  - Update the user's position via the portfolio module
 *
 * What this module does NOT handle:
 *  - Storing the actual position (portfolio module)
 *  - Adjusting the wallet balance (wallet module)
 *  - Getting the price (market module)
 *  The trade module coordinates these — it does not own them.
 *
 * Important concept — simulated execution:
 *  In real trading, orders go to an exchange and may not fill
 *  immediately. In Rookie Bulls, every order fills instantly
 *  at the current mocked price. There is no order book,
 *  no partial fills, no market impact. This is intentional
 *  for the educational simulation scope.
 *
 * MVP scope:
 *  Market buy and market sell only.
 *  Limit orders, stop losses, and options are out of scope.
 */