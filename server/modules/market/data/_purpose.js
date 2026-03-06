/**
 * FOLDER: /server/modules/market/data
 *
 * Contains static reference data files used by the market module.
 * Files in this folder are committed to the repository.
 *
 * Why committed to the repo:
 *  These are not secrets or generated build artifacts.
 *  They are static reference data that the application depends on
 *  at runtime. Committing them means the app works immediately on
 *  any machine without running any setup scripts first.
 *
 * FILES:
 *  tickers.json
 *    Source:   https://www.sec.gov/files/company_tickers_exchange.json
 *    Contents: flat array of NYSE and Nasdaq listed companies
 *              each entry: { cik, companyName, ticker, exchange }
 *    Used by:  tickerSearch.js (in-memory search)
 *              secProvider.js (CIK lookup for SEC EDGAR API calls)
 *    Refresh:  manually, a few times per year
 *              run: node server/modules/market/data/transformTickers.js
 *              then commit the updated tickers.json
 *    Size:     approximately 7,500 entries
 *
 *  transformTickers.js
 *    Purpose:  one-time script to download and transform the SEC EDGAR
 *              company ticker list into the flat array format used by
 *              tickers.json
 *    Run with: node server/modules/market/data/transformTickers.js
 *    Output:   overwrites server/modules/market/data/tickers.json
 *    Frequency: run manually when tickers.json needs refreshing
 *               not run automatically — not part of the server startup
 */