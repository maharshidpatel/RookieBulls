/**
 * market/workers/priceUpdater.js — Background Price Updater Worker
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THREE DISTINCT JOBS:
 *
 *  JOB 1 — Opening job (first tick after 9:45 AM on a trading day):
 *    Runs ONCE per trading day — gated by market:opening:done flag.
 *    No Stooq call — pure Redis key copy.
 *    Copies closingPrice:TICKER → prevClose:TICKER for all held + watched tickers.
 *    prevClose:TICKER = yesterday's closing price = day change baseline all session.
 *    TTL = secondsUntilNextMarketOpen() (~24h until next 9:45 AM).
 *
 *  JOB 2 — Regular tick (every 60s during market hours):
 *    Single Stooq batch request for ALL held + watched tickers.
 *    Reads prevClose:TICKER and closingPrice:TICKER from Redis.
 *    Writes price:TICKER (90s TTL) and quote:TICKER (90s TTL).
 *    quote object includes closingPrice field for QuotePage "Prev Close" display.
 *    Zero Stooq calls from portfolio or QuotePage for held/watched tickers.
 *
 *  JOB 3 — Closing job (first tick after 4:16 PM on a trading day):
 *    Runs ONCE per trading day — gated by market:closing:done flag.
 *    Single Stooq batch request — captures actual closing prices.
 *    Writes closingPrice:TICKER = today's closing price.
 *    Writes quote:TICKER with nextOpen TTL — survives server restarts overnight.
 *    Writes price:TICKER with nextOpen TTL — portfolio reads this after close.
 *    Does NOT update prevClose:TICKER — that stays as yesterday's close
 *    until the opening job runs at 9:45 AM tomorrow.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * REDIS KEY OWNERSHIP:
 *
 *  prevClose:TICKER    written by: opening job (daily at 9:45 AM)
 *                                  resolveQuote() bootstrap only (cold start)
 *                      value:      yesterday's closing price
 *                      TTL:        until next 9:45 AM
 *
 *  closingPrice:TICKER written by: closing job (daily at 4:16 PM)
 *                                  resolveQuote() bootstrap only (cold start)
 *                      value:      today's closing price
 *                      TTL:        until next 4:16 PM (nextOpen + 6.5h)
 *
 *  price:TICKER        written by: regular tick (90s TTL during hours)
 *                                  closing job (nextOpen TTL after close)
 *
 *  quote:TICKER        written by: regular tick (90s TTL during hours)
 *                                  closing job (nextOpen TTL after close)
 *                      shape:      { price, change, changePercent, high,
 *                                    low, open, closingPrice, timestamp }
 *                      NOTE:       no prevClose field — lives in its own key
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DAILY STOOQ CALL ESTIMATE:
 *  Regular ticks:     390 calls  (1 batch/min × 390 market minutes)
 *  Closing job:         1 call
 *  Total:             391 calls/day regardless of ticker count
 *  Opening job:         0 calls  (Redis copy only)
 */

const stooq    = require('../providers/stooqProvider')
const { get, set, smembers } = require('../cache/redisClient')
const Position = require('../../position/model')
const {
  isMarketOpen: calcMarketOpen,
  isTradingDay,
  isPastMarketClose,
  secondsUntilNextMarketOpen,
} = require('../utils/marketHours')

const INTERVAL_MS = 60000 // 60 seconds between ticks
const PRICE_TTL   = 90    // 60s interval + 30s buffer

// closingPrice:TICKER TTL — survives until end of next trading session
// nextOpen (~17.5h from 4:16 PM) + 6.5h (full session) = ~24h = next 4:16 PM
const closingPriceTTL = () => secondsUntilNextMarketOpen() + (6.5 * 3600)

// ── Shared ticker list helper ─────────────────────────────────────────────

const getAllTickers = async () => {
  const heldTickers    = await Position.distinct('ticker')
  const watchedTickers = await smembers('watched:tickers')
  return {
    heldTickers,
    watchedTickers,
    allTickers: [...new Set([...heldTickers, ...watchedTickers])],
  }
}

// ── runUpdate() ───────────────────────────────────────────────────────────

const runUpdate = async () => {
  try {
    const marketOpen = await calcMarketOpen()

    // ── After hours path ─────────────────────────────────────────────────
    if (!marketOpen) {

      // Only run closing job if:
      //  1. Current time is past 4:16 PM (not before-open false)
      //  2. Today is an actual trading day (not weekend or holiday)
      //  3. Closing job has not already run today
      if (!isPastMarketClose()) return // Before open — nothing to do

      const tradingDay = await isTradingDay()
      if (!tradingDay) {
        // Weekend or holiday — set flag so we stop checking until next open
        const closingDone = await get('market:closing:done')
        if (!closingDone) {
          await set('market:closing:done', '1', secondsUntilNextMarketOpen())
        }
        return
      }

      const closingDone = await get('market:closing:done')
      if (closingDone) return // Already ran today

      // ── Closing job ───────────────────────────────────────────────────
      // Final Stooq batch — captures actual closing prices.
      // closingPrice:TICKER becomes tomorrow's prevClose via opening job.
      const { heldTickers, watchedTickers, allTickers } = await getAllTickers()

      if (allTickers.length === 0) {
        await set('market:closing:done', '1', secondsUntilNextMarketOpen())
        return
      }

      const priceMap = await stooq.getPriceBatch(allTickers)

      let written = 0
      const missed = []

      for (const ticker of allTickers) {
        const data = priceMap.get(ticker)
        if (!data) { missed.push(ticker); continue }

        try {
          // Read prevClose:TICKER (set at this morning's open = yesterday's close)
          // Used to calculate today's full day change for the overnight quote
          const prevCloseRaw = await get(`prevClose:${ticker}`)
          const prevClose    = prevCloseRaw ? parseFloat(prevCloseRaw) : null

          const change = prevClose !== null
            ? parseFloat((data.price - prevClose).toFixed(2))
            : null
          const changePercent = prevClose !== null
            ? parseFloat(((data.price - prevClose) / prevClose * 100).toFixed(2))
            : null

          // closingPrice = today's final price = displayed as "Prev Close" on QuotePage
          // Becomes tomorrow's prevClose when opening job runs at 9:45 AM
          const ttlNext = secondsUntilNextMarketOpen()

          await set(`closingPrice:${ticker}`, data.price, closingPriceTTL())

          // Write quote:TICKER with nextOpen TTL so it survives server restarts
          // Portfolio and QuotePage have cache hits all night without Stooq calls
          const quote = {
            price:         data.price,
            change,
            changePercent,
            high:          data.high,
            low:           data.low,
            open:          data.open,
            prevClose: prevClose ?? data.price,
            timestamp:     data.timestamp,
          }
          await set(`quote:${ticker}`, JSON.stringify(quote), ttlNext)

          // price:TICKER with nextOpen TTL — portfolio reads this after close
          await set(`price:${ticker}`, data.price, ttlNext)

          written++
        } catch (err) {
          console.error(`Price updater: closing write failed for ${ticker}:`, err.message)
          missed.push(ticker)
        }
      }

      // Flag expires at next market open — closing job runs once per trading day
      await set('market:closing:done', '1', secondsUntilNextMarketOpen())

      console.log(
        `Price updater: MARKET CLOSED — closing prices captured for ${written}/${allTickers.length} tickers` +
        ` (held: ${heldTickers.length}, watched: ${watchedTickers.length})` +
        ` — 1 Stooq batch request`
      )
      if (missed.length) console.warn(`Price updater: closing missed → ${missed.join(', ')}`)
      return
    }

    // ── Market open path ─────────────────────────────────────────────────

    const { heldTickers, watchedTickers, allTickers } = await getAllTickers()

    // ── Opening job ───────────────────────────────────────────────────────
    // Runs once per trading day on first open tick.
    // Copies closingPrice:TICKER (yesterday's close written at 4:16 PM)
    // into prevClose:TICKER — the day change baseline for today's session.
    // No Stooq call — pure Redis key copy.
    const openingDone = await get('market:opening:done')
    if (!openingDone) {
      let copiedCount = 0

      for (const ticker of allTickers) {
        const closingPriceRaw = await get(`closingPrice:${ticker}`)
        if (closingPriceRaw) {
          // prevClose:TICKER TTL = until next market open (~24h)
          // Opening job will overwrite it again tomorrow
          await set(`prevClose:${ticker}`, closingPriceRaw, secondsUntilNextMarketOpen())
          copiedCount++
        }
        // closingPrice cold (new ticker) — prevClose:TICKER stays cold
        // resolveQuote() handles cold prevClose on QuotePage visit
      }

      // Flag expires at next market open — opening job runs once per trading day
      await set('market:opening:done', '1', secondsUntilNextMarketOpen())

      console.log(
        `Price updater: MARKET OPEN — prevClose copied for ${copiedCount}/${allTickers.length} tickers` +
        ` (closingPrice cold for ${allTickers.length - copiedCount} tickers — will resolve on QuotePage visit)`
      )
    }

    // ── Regular tick ──────────────────────────────────────────────────────

    if (allTickers.length === 0) {
      console.log('Price updater: no tickers to update')
      return
    }

    const priceMap = await stooq.getPriceBatch(allTickers)

    let updated           = 0
    let quotesWithPrev    = 0
    let quotesWithoutPrev = 0
    const missed          = []

    for (const ticker of allTickers) {
      const data = priceMap.get(ticker)
      if (!data) { missed.push(ticker); continue }

      try {
        // price:TICKER — trade engine reads this
        await set(`price:${ticker}`, data.price, PRICE_TTL)
        updated++

        // prevClose:TICKER — set by opening job at 9:45 AM
        // Cold if new ticker or first ever day
        const prevCloseRaw    = await get(`prevClose:${ticker}`)
        const prevClose       = prevCloseRaw ? parseFloat(prevCloseRaw) : null

        // closingPrice:TICKER — set by closing job at 4:16 PM
        // Displayed as "Prev Close" on QuotePage
        // Cold on first day or new ticker — resolveQuote() bootstraps it on QuotePage visit
        const closingPriceRaw = await get(`closingPrice:${ticker}`)
        const closingPrice    = closingPriceRaw ? parseFloat(closingPriceRaw) : null

        const change = prevClose !== null
          ? parseFloat((data.price - prevClose).toFixed(2))
          : null
        const changePercent = prevClose !== null
          ? parseFloat(((data.price - prevClose) / prevClose * 100).toFixed(2))
          : null

        // quote:TICKER — QuotePage reads this
        // closingPrice field = yesterday's close for "Prev Close" stat display
        // change/changePercent = today's movement vs yesterday's close
        // No prevClose field — lives in prevClose:TICKER, read directly by portfolio
        const quote = {
          price:         data.price,
          change,
          changePercent,
          high:          data.high,
          low:           data.low,
          open:          data.open,
          prevClose,
          timestamp:     data.timestamp,
        }

        await set(`quote:${ticker}`, JSON.stringify(quote), PRICE_TTL)

        if (prevClose !== null) quotesWithPrev++
        else quotesWithoutPrev++

      } catch (err) {
        console.error(`Price updater: write failed for ${ticker}:`, err.message)
        missed.push(ticker)
      }
    }

    console.log(
      `Price updater: updated ${updated}/${allTickers.length} tickers` +
      ` (held: ${heldTickers.length}, watched: ${watchedTickers.length})` +
      ` | quotes: ${quotesWithPrev} with prevClose, ${quotesWithoutPrev} cold` +
      ` — 1 Stooq batch request`
    )
    if (missed.length) console.warn(`Price updater: no data for → ${missed.join(', ')}`)

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