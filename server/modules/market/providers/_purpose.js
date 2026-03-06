/**
 * FOLDER: /server/modules/market/providers
 *
 * Contains one file per external data source.
 * Each provider is responsible for communicating with its source
 * and returning clean JavaScript objects.
 *
 * Providers know nothing about:
 *  - Redis or caching
 *  - Express, req, or res
 *  - Business logic or trade rules
 *  - Any other module in the application
 *
 * Providers only know how to:
 *  - Build the correct URL for their data source
 *  - Make the HTTP request
 *  - Parse the response into a clean object
 *  - Throw a typed error (statusCode 404 or 503) on failure
 *
 * All caching decisions are made by market/service.js, not here.
 * Providers are called by service.js only — never directly by
 * controllers or other modules.
 *
 * FILES:
 *  stooqProvider.js
 *    Source:   stooq.com
 *    Exports:  getPrice(ticker), getHistorical(ticker, days)
 *    Data:     delayed US stock prices and 90-day OHLCV history
 *    Auth:     none — no API key required
 *
 *  secProvider.js
 *    Source:   data.sec.gov (SEC EDGAR)
 *    Exports:  getStockProfile(ticker)
 *    Data:     company name, exchange, industry, CIK
 *    Auth:     none — US government public API
 *    Note:     requires User-Agent header on every request
 */