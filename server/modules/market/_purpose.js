/**
 * MODULE: /server/modules/market
 *
 * The single point of contact between this application and all
 * external market data sources (Stooq, SEC EDGAR, date.nager.at).
 *
 * No other module in the application knows these providers exist.
 * If a provider changes, only the relevant provider file changes.
 * This is called the middleman pattern.
 *
 * Responsibilities:
 *  - getPrice(ticker)        — current delayed price (number)
 *  - getQuote(ticker)        — full quote object (price, change, high, low, etc.)
 *  - searchTickers(query)    — in-memory search against tickers.json
 *  - isMarketOpen()          — local calculation, no external API call
 *  - getStockProfile(ticker) — company profile from SEC EDGAR
 *  - getCandles(ticker)      — 90-day daily OHLCV data from Stooq
 *
 * Why market data has its own module:
 *  The trade module needs prices to execute trades.
 *  The portfolio module needs prices to calculate PnL.
 *  By isolating all price retrieval here, neither module cares
 *  where prices come from — they just call getPrice(ticker).
 *  Swapping a provider = change the provider file only.
 *  Trade, portfolio, and frontend are completely unaffected.
 *
 * Why no auth is required on market routes:
 *  Stock prices and market status are public information.
 *  Authentication is enforced at the trade level, not the price level.
 *
 * WHAT DOES NOT BELONG HERE:
 *  - Trade execution logic (belongs in trade/service.js)
 *  - Wallet or balance operations (belongs in wallet/service.js)
 *  - Portfolio calculations (belongs in portfolio/service.js)
 *  - Direct axios calls outside of provider files
 *  - Redis operations outside of service.js and redisClient.js
 *
 * INTERNAL STRUCTURE:
 *  service.js          — public interface, Redis cache layer
 *  controller.js       — HTTP handlers, reads req, calls service, sends res
 *  routes.js           — URL definitions, maps routes to controller functions
 *  model.js            — exists but unused, left in place intentionally
 *  validators.js       — exists but unused, left in place intentionally
 *  /providers
 *    stooqProvider.js  — fetches prices and historical data from Stooq
 *    secProvider.js    — fetches company profiles from SEC EDGAR
 *  /cache
 *    redisClient.js    — Redis connection and get/set/del wrappers
 *  /workers
 *    priceUpdater.js   — background worker, refreshes prices every 60s
 *  /utils
 *    marketHours.js    — isMarketOpen() local calculation
 *    tickerSearch.js   — in-memory ticker search against tickers.json
 *  /data
 *    tickers.json      — static NYSE/Nasdaq ticker list from SEC EDGAR
 *    transformTickers.js — one-time script to regenerate tickers.json
 *
 * DATA SOURCES:
 *  Stooq (stooq.com)
 *    Delayed US stock prices and historical OHLCV data.
 *    No API key required. Permits educational redistribution.
 *
 *  SEC EDGAR (sec.gov)
 *    Company profiles and CIK mapping.
 *    US government public API. No key. No restrictions.
 *
 *  date.nager.at
 *    US federal holiday list for market hours calculation.
 *    Free, no key. Cached in Redis for 24 hours.
 *
 * CACHE STRATEGY (Redis):
 *  All external data passes through Redis.
 *  price:TICKER     → number,      TTL 90s
 *  quote:TICKER     → JSON object, TTL 90s
 *  candles:TICKER   → JSON array,  TTL 1h
 *  profile:TICKER   → JSON object, TTL 24h
 *  market:holidays  → JSON array,  TTL 24h
 *
 *  Background worker (priceUpdater.js) writes price and quote keys
 *  every 60 seconds for all tickers with active user positions.
 *  User requests read from Redis — external providers are rarely called
 *  directly by user-triggered requests.
 *
 * REQUEST FLOW:
 *  GET /api/market/price/:ticker
 *    → routes.js → controller.js → service.js
 *    → Redis check → hit: return | miss: stooqProvider → Redis → return
 *
 *  GET /api/market/quote/:ticker
 *    → routes.js → controller.js → service.js
 *    → Redis check → hit: return | miss: stooqProvider → Redis → return
 *
 *  GET /api/market/search?q=query
 *    → routes.js → controller.js → service.js
 *    → tickerSearch.js (in-memory, no external call)
 *
 *  GET /api/market/status
 *    → routes.js → controller.js → service.js
 *    → marketHours.js (local calculation, Redis for holiday list)
 *
 *  GET /api/market/profile/:ticker
 *    → routes.js → controller.js → service.js
 *    → Redis check → hit: return | miss: secProvider → Redis → return
 *
 *  GET /api/market/candles/:ticker
 *    → routes.js → controller.js → service.js
 *    → Redis check → hit: return | miss: stooqProvider → Redis → return
 *
 *  Internal callers (no HTTP):
 *    trade/service.js     → getPrice(ticker)
 *    portfolio/service.js → getPrice(ticker) via Promise.all()
 */