/**
 * market/data/transformTickers.js — One-Time SEC EDGAR Ticker Transform Script
 *
 * Run this script manually to regenerate tickers.json.
 * It downloads the official SEC EDGAR company ticker list,
 * transforms it into a clean flat array, and writes it to tickers.json.
 *
 * Why this script exists:
 *  Stooq has no search endpoint. The SEC EDGAR company_tickers_exchange.json
 *  file is the most comprehensive free source of NYSE and Nasdaq listed
 *  companies. It includes ticker symbol, company name, exchange, and CIK.
 *  CIK is the SEC's internal company identifier — needed later by
 *  secProvider.js to call the SEC EDGAR submissions API for company profiles.
 *
 * Why committed to the repo:
 *  tickers.json is static reference data, not a secret.
 *  Committing it means the app works immediately on any machine without
 *  running this script first. Refresh it manually a few times per year
 *  when new tickers are listed or delistings occur.
 *
 * Run with:
 *  node server/modules/market/data/transformTickers.js
 *
 * Output:
 *  server/modules/market/data/tickers.json
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// SEC EDGAR company_tickers_exchange.json
// Contains: cik, name, ticker, exchange for all listed companies
// No API key required — US government public data
const SEC_URL = 'https://www.sec.gov/files/company_tickers_exchange.json'

const OUTPUT_PATH = path.join(__dirname, 'tickers.json')

console.log('Downloading SEC EDGAR ticker list...')

https.get(SEC_URL, {
  // SEC requires a User-Agent header identifying your application.
  // Requests without it are rejected with a 403.
  // Format: AppName/Version contact@email.com
  headers: {
    'User-Agent': 'RookieBulls/1.0 dev@rookiebulls.com',
    'Accept': 'application/json',
  }
}, (res) => {
  let raw = ''

  // Data arrives in chunks — concatenate them all before parsing
  res.on('data', (chunk) => { raw += chunk })

  res.on('end', () => {
    const parsed = JSON.parse(raw)

    // SEC format: { fields: ['cik','name','ticker','exchange'], data: [[...],[...]] }
    // Each entry in data[] maps positionally to fields[]
    // Transform each array entry into a named object for clarity
    const tickers = parsed.data
      .filter(entry => {
        const exchange = entry[3]
        // Only include NYSE and Nasdaq listed companies
        // Filters out OTC, pink sheets, and other non-standard listings
        // that Stooq may not carry price data for
        return exchange === 'NYSE' || exchange === 'Nasdaq'
      })
      .map(entry => ({
        cik: String(entry[0]).padStart(10, '0'), // Zero-pad CIK to 10 digits
                                                  // SEC EDGAR API requires this format
                                                  // e.g. 320193 → "0000320193"
        companyName: entry[1],
        ticker: entry[2],
        exchange: entry[3],
      }))

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(tickers, null, 2))
    console.log(`Done. ${tickers.length} tickers written to tickers.json`)
  })

}).on('error', (err) => {
  console.error('Failed to download ticker list:', err.message)
  process.exit(1)
})