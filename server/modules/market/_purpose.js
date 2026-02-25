/**
 * MODULE: /server/modules/market
 *
 * Provides stock price data to the rest of the application.
 * In MVP this is entirely mocked — prices are hardcoded.
 *
 * Responsibilities:
 *  - Expose an endpoint that returns a stock price by ticker
 *  - In MVP: return hardcoded prices (AAPL = $180 etc.)
 *  - Post-MVP: replace hardcoded prices with a real or delayed feed
 *    without changing any other module
 *
 * Why this is its own module:
 *  The trade module needs prices to execute trades.
 *  By isolating price retrieval here, the trade module never
 *  cares where prices come from — it just asks the market module.
 *  When real price data replaces mock data, only this module changes.
 *  The trade module, portfolio module, and frontend are untouched.
 *
 * This is called an abstraction boundary.
 * The market module is the only part of the system that knows
 * how prices are obtained. Everything else just consumes them.
 *
 * MVP scope:
 *  Hardcoded prices only. No external API calls.
 * 
 * * IN PRODUCTION:
 *   Only this module changes when real or delayed data is introduced.
 *   All callers (trade service, portfolio service) continue to call
 *   getPrice(ticker) with no changes required on their end.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - HTTP routes or controllers
 *   - Trade execution logic
 *   - Wallet or balance operations
 *   - MongoDB schemas or queries
 *
 * REQUEST FLOW:
 *   trade/service.js
 *     → market/service.js → getPrice(ticker) → returns number
 */