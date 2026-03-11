/**
 * market/workers/priceUpdater.js — Background Price Updater Worker
 *
 * Responsibility:
 *  Runs every 60 seconds during market hours only.
 *  Fetches all tracked tickers in a single Stooq batch request.
 *  Writes fresh price:TICKER keys to Redis.
 *
 * Ticker sources (merged, deduplicated):
 *  1. Position.distinct('ticker') — tickers users currently hold
 *     Always included. Permanent until position is closed.
 *
 *  2. watched:tickers Redis set   — tickers any user has viewed today
 *     Added by service.js getQuote() on cache miss during market hours.
 *     Expires at next market open — clean slate each trading day.
 *
 * Why batch:
 *  Sequential: 100 tickers × 390 min = 39,000 Stooq calls/day
 *  Batch:      1 request   × 390 min =    390 Stooq calls/day
 *  98% reduction regardless of ticker count.
 *
 * Why watched:tickers:
 *  User visits NVDA quote page but does not buy.
 *  Without watched: NVDA cache misses every 90s for every user.
 *  With watched: NVDA added to batch after first visit,
 *  stays warm in Redis for all subsequent users that day.
 *
 * Market hours check:
 *  Worker skips entirely outside 9:30 AM - 4:00 PM ET.
 *  Zero Stooq calls after close — prices cached until next open.
 *
 * What is written:
 *  price:TICKER only — 90s TTL.
 *  quote:TICKER is NOT written here — requires prevClose derivation
 *  which lives in service.js. Writing incomplete data here would
 *  overwrite correctly calculated quotes.
 */

const stooq    = require('../providers/stooqProvider')
const { set, smembers } = require('../cache/redisClient')
const Position = require('../../position/model')
const { isMarketOpen: calcMarketOpen } = require('../utils/marketHours')

const INTERVAL_MS = 60000 // 60 seconds
const PRICE_TTL   = 90    // 60s interval + 30s buffer

const runUpdate = async () => {
  try {
    // Skip entirely outside market hours — zero Stooq calls after close.
    // Prices cached until next market open via dynamic TTL in service.js.
    const marketOpen = await calcMarketOpen()
    if (!marketOpen) return

    // Source 1 — tickers users currently hold positions in
    const heldTickers = await Position.distinct('ticker')

    // Source 2 — tickers any user has viewed on QuotePage today
    // Added by service.js getQuote() on every cache miss during market hours
    // Expires at next market open automatically — no manual cleanup needed
    const watchedTickers = await smembers('watched:tickers')

    // Merge and deduplicate both sources
    const allTickers = [...new Set([...heldTickers, ...watchedTickers])]

    if (allTickers.length === 0) {
      console.log('Price updater: no tickers to update')
      return
    }

    // Single Stooq batch request — all tickers in one HTTP call.
    // Returns Map of ticker → { price, high, low, open, timestamp }
    const priceMap = await stooq.getPriceBatch(allTickers)

    let updated = 0
    for (const [ticker, raw] of priceMap) {
      try {
        await set(`price:${ticker}`, raw.price, PRICE_TTL)
        updated++
      } catch (err) {
        console.error(`Price updater: failed to cache ${ticker}:`, err.message)
      }
    }

    console.log(
      `Price updater: updated ${updated}/${allTickers.length} tickers` +
      ` (held: ${heldTickers.length}, watched: ${watchedTickers.length})` +
      ` — 1 Stooq batch request`
    )

  } catch (err) {
    console.error('Price updater: error:', err.message)
  }
}

const startPriceUpdater = () => {
  console.log('Price updater: starting (interval: 60s, batch mode)')
  runUpdate()
  setInterval(runUpdate, INTERVAL_MS)
}

module.exports = { startPriceUpdater }