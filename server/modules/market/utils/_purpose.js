/**
 * FOLDER: /server/modules/market/utils
 *
 * Contains utility modules that support the market module
 * without making external API calls.
 *
 * Utilities are pure logic — they receive input, apply rules,
 * and return output. They do not depend on providers or controllers.
 *
 * FILES:
 *  marketHours.js
 *    Exports:  isMarketOpen()
 *    Logic:    determines whether NYSE is currently open
 *              checks in order:
 *                1. NODE_ENV !== 'production' → always true (dev bypass)
 *                2. weekend check
 *                3. federal holiday check (Redis cached, date.nager.at on miss)
 *                4. early close day check (Black Friday, Christmas Eve)
 *                5. EST trading hours window (9:45am–4:15pm)
 *    External: date.nager.at for holiday list (cached 24h in Redis)
 *    Called by: market/service.js → isMarketOpen()
 *
 *  tickerSearch.js
 *    Exports:  searchTickers(query)
 *    Logic:    loads tickers.json into memory at module load time
 *              filters by ticker symbol or company name (case-insensitive)
 *              returns max 10 results
 *    External: none — entirely in-memory, sub-millisecond response
 *    Called by: market/service.js → searchTickers()
 *               market/providers/secProvider.js → getCIK()
 */