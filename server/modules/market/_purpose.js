/**
 * MODULE: /server/modules/market
 *
 * The single point of contact between this application and the
 * external market data provider (Finnhub).
 *
 * No other module in the application knows that Finnhub exists.
 * If the provider changes, only this module changes.
 * This is called the middleman pattern.
 *
 * Responsibilities:
 *  - getPrice(ticker)      — fetch current delayed price from Finnhub
 *  - searchTickers(query)  — search for US-listed common stocks by name or symbol
 *  - isMarketOpen()        — check whether the NYSE is currently open
 *
 * What changed from MVP:
 *  - Hardcoded MOCK_PRICES map removed
 *  - getSupportedTickers() removed (replaced by searchTickers())
 *  - getPrice() is now async — makes a real HTTP call to Finnhub
 *  - routes.js and controller.js added to expose market data via HTTP
 *
 * Why market data has its own module:
 *  The trade module needs prices to execute trades.
 *  The portfolio module needs prices to calculate PnL.
 *  By isolating all price retrieval here, neither module cares
 *  where prices come from — they just call getPrice(ticker).
 *  Swapping Finnhub for another provider = change this module only.
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
 *  - Any direct Finnhub calls outside of service.js
 *
 * REQUEST FLOW:
 *  GET /api/market/price/:ticker
 *    → market/routes.js
 *    → market/controller.js
 *    → market/service.js → Finnhub /quote → returns price as number
 *
 *  GET /api/market/search?q=query
 *    → market/routes.js
 *    → market/controller.js
 *    → market/service.js → Finnhub /search → returns filtered results array
 *
 *  GET /api/market/status
 *    → market/routes.js
 *    → market/controller.js
 *    → market/service.js → Finnhub /stock/market-status → returns isOpen boolean
 *
 *  Internal callers (no HTTP):
 *    trade/service.js     → getPrice(ticker)
 *    portfolio/service.js → getPrice(ticker) via Promise.all()
 */