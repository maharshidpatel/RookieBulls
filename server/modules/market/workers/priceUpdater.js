/**
 * market/workers/priceUpdater.js — Background Price Updater Worker
 *
 * Responsibility:
 *  Runs on a fixed interval and proactively writes fresh prices into
 *  Redis for every ticker that any user currently holds a position in.
 *
 * What does not belong here:
 *  No HTTP handlers, no business logic, no trade or wallet operations.
 *  This file only reads positions from MongoDB, fetches prices from
 *  Stooq, and writes results to Redis.
 *
 * How it fits into the system:
 *  Without this worker, prices are only fetched on demand when a user
 *  makes a request. Under load, 100 simultaneous portfolio requests
 *  would trigger 100 × N Stooq calls. This worker inverts that:
 *  prices are always warm in Redis, user requests never hit Stooq.
 *
 *  server.js calls startPriceUpdater() once after MongoDB and Redis
 *  connect. The worker then runs indefinitely until the server stops.
 *
 * Interval: every 60 seconds
 * Redis TTL: 90 seconds (30 second buffer — cache never expires between ticks)
 *
 * What this worker writes to Redis:
 *  price:TICKER only — just the number (e.g. 182.10)
 *
 * What this worker does NOT write:
 *  quote:TICKER — intentionally excluded.
 *  The quote object requires prevClose, change, and changePercent which
 *  are derived in service.js using the candles cache. The worker does not
 *  have access to that logic. Writing an incomplete quote here would
 *  overwrite a properly calculated one and break portfolio and QuotePage.
 *
 * Why query Position.distinct('ticker') instead of a hardcoded list:
 *  Only tickers with at least one active user position need live prices.
 *  This scales naturally — if 1000 users hold 50 unique tickers,
 *  the worker makes exactly 50 Stooq calls per tick regardless of
 *  how many users there are. No hardcoded list to maintain.
 *  If no positions exist, the worker makes 0 external calls.
 */

const stooq = require('../providers/stooqProvider')
const { set } = require('../cache/redisClient')
const Position = require('../../position/model')

// How often the worker runs in milliseconds
const INTERVAL_MS = 60000 // 60 seconds

// How long each Redis price key lives before expiring
// 90 seconds = 60s interval + 30s buffer
// The buffer ensures the cache never expires between ticks under
// normal conditions. If the worker is delayed slightly, the 30s
// buffer means users still get cached data rather than a cache miss.
const PRICE_TTL = 90

/**
 * runUpdate()
 *
 * Single execution of the price update cycle.
 * Called immediately on startup, then every 60 seconds.
 *
 * Steps:
 *  1. Query MongoDB for all unique tickers with open positions
 *  2. For each ticker: fetch raw quote from Stooq (price only, no history)
 *  3. Write price:TICKER into Redis
 *  4. Log how many tickers were updated
 *
 * Errors are caught per-ticker so one bad ticker (e.g. a delisted
 * stock) does not stop the rest of the batch from updating.
 */
const runUpdate = async () => {
  try {
    const tickers = await Position.distinct('ticker')

    if (tickers.length === 0) {
      console.log('Price updater: no positions found, 0 tickers updated')
      return
    }

    let updated = 0

    // Process each ticker sequentially to avoid hammering Stooq
    // with simultaneous requests. Sequential is safer for a free
    // data source with no published rate limit.
    for (const ticker of tickers) {
      try {
        // stooqProvider.getPrice(ticker) — single quote request only.
        // No history, no prevClose derivation. Just the current price.
        const raw = await stooq.getPrice(ticker)

        // Write price number only — trade engine and portfolio service
        // read this key. quote:TICKER is NOT written here — see header comment.
        await set(`price:${ticker}`, raw.price, PRICE_TTL)

        updated++
      } catch (err) {
        console.error(`Price updater: failed to update ${ticker}:`, err.message)
      }
    }

    console.log(`Price updater: updated ${updated}/${tickers.length} tickers`)

  } catch (err) {
    console.error('Price updater: failed to read positions from MongoDB:', err.message)
  }
}

/**
 * startPriceUpdater()
 *
 * Starts the background worker.
 * Called once from server.js after MongoDB and Redis are connected.
 *
 * Runs immediately on call so Redis is populated before the first
 * user request arrives — no cold start gap.
 * Then repeats every INTERVAL_MS milliseconds.
 */
const startPriceUpdater = () => {
  console.log('Price updater: starting (interval: 60s)')
  runUpdate()
  setInterval(runUpdate, INTERVAL_MS)
}

module.exports = { startPriceUpdater }