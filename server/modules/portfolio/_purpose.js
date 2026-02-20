/**
 * MODULE: /server/modules/portfolio
 *
 * Tracks what a user currently owns — their open positions.
 * A position is a holding in a specific stock.
 *
 * Responsibilities:
 *  - Store and update positions (ticker, quantity, average buy price)
 *  - Calculate current profit and loss per position
 *  - Calculate total portfolio value
 *  - Expose portfolio summary to the frontend
 *
 * Key concept — average buy price:
 *  If a user buys 5 shares of AAPL at $180 then 5 more at $200,
 *  they own 10 shares. The average buy price is $190.
 *  Profit/Loss is calculated against this average, not the first price paid.
 *  This is standard portfolio accounting.
 *
 * What this module does NOT handle:
 *  - Executing trades (trade module)
 *  - Credit balance (wallet module)
 *  - Historical trade records (trade module stores those)
 *
 * Relationship to trade module:
 *  Every time a trade executes, the trade module tells the
 *  portfolio module to update the relevant position.
 *  Portfolio module does not initiate anything — it only responds.
 */