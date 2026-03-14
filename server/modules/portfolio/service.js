/*
 * portfolio/service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Calculates the user's current portfolio state.
 *   Reads positions and enriches each with price, PnL, and day change.
 *   Does not write to the database.
 *
 * PRICE DATA STRATEGY:
 *   Reads price:TICKER and prevClose:TICKER directly from Redis.
 *   No quote object needed — portfolio only needs two numbers per ticker.
 *   Zero dependency on quote:TICKER.
 *
 *   price:TICKER    — written every 60s by updater during market hours
 *                     written by closing job with nextOpen TTL after close
 *                     always warm in normal operation
 *
 *   prevClose:TICKER — written by opening job at 9:45 AM each trading day
 *                      = yesterday's closing price
 *                      used as dayChange baseline for positions held overnight
 *
 *   Fallback chain (cold start / first day only):
 *     1. price:TICKER cold → try closingPrice:TICKER (after-hours fallback)
 *     2. both cold         → resolveQuote() as absolute last resort
 *        resolveQuote() fetches history → bootstraps all Redis keys
 *        This path should not occur after first full trading day
 *
 * DAY CHANGE BASELINE:
 *   Position touched today (bought/added today) → avgBuyPrice
 *     prevClose predates the purchase — not a meaningful comparison
 *   Position held from previous day            → prevClose:TICKER
 *     Standard day change calculation
 *   prevClose:TICKER cold                      → avgBuyPrice fallback
 *     Graceful degradation on first day / new ticker
 *
 * WHAT DOES NOT BELONG HERE:
 *   Trade logic, wallet operations, HTTP handling, database writes
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { getAllPositions }  = require('../position/service')
const { resolveQuote }     = require('../market/service')
const { get }              = require('../market/cache/redisClient')

const getTodayMarketOpen = () => {
  const now      = new Date()
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const et       = new Date(etString)
  et.setHours(9, 45, 0, 0)
  return et
}

const getPortfolio = async (userId) => {
  const positions = await getAllPositions(userId)

  if (positions.length === 0) {
    return {
      positions: [],
      summary: {
        totalCostBasis:   0,
        totalMarketValue: 0,
        totalPnl:         0,
        totalPnlPercent:  0,
        totalDayChange:   0,
      },
    }
  }

  const todayMarketOpen = getTodayMarketOpen()

  const enrichedPositions = await Promise.all(
    positions.map(async (position) => {

      // ── Step 1: get current price ────────────────────────────────────────
      //
      // Primary: price:TICKER
      //   Warm during market hours (90s TTL, updater every 60s)
      //   Warm after close (nextOpen TTL, written by closing job)
      //
      // Fallback 1: closingPrice:TICKER
      //   Used when price:TICKER expired before closing job ran
      //   Should not occur in normal operation
      //
      // Fallback 2: resolveQuote()
      //   Absolute cold start — triggers 1 history call per cold ticker
      //   Bootstraps all Redis keys — subsequent loads are cache hits
      //   trackWatched=false — held ticker already in Position.distinct()
      let currentPrice = null

      const priceRaw = await get(`price:${position.ticker}`)
      if (priceRaw) {
        currentPrice = parseFloat(priceRaw)
      } else {
        const closingPriceRaw = await get(`closingPrice:${position.ticker}`)
        if (closingPriceRaw) {
          currentPrice = parseFloat(closingPriceRaw)
        }
      }

      if (currentPrice === null) {
        // Last resort — should only hit on absolute first run
        const resolved = await resolveQuote(position.ticker, false)
        currentPrice   = resolved.price
      }

      // ── Step 2: get prevClose for dayChange baseline ─────────────────────
      //
      // prevClose:TICKER = yesterday's closing price
      // Written by opening job at 9:45 AM each trading day
      // Cold on first day or for new tickers → fall back to avgBuyPrice
      const prevCloseRaw  = await get(`prevClose:${position.ticker}`)
      const prevClosePrice = prevCloseRaw ? parseFloat(prevCloseRaw) : null

      // ── Calculations ─────────────────────────────────────────────────────

      const costBasis   = position.avgBuyPrice * position.quantity
      const marketValue = currentPrice * position.quantity
      const pnl         = marketValue - costBasis
      const pnlPercent  = parseFloat(((pnl / costBasis) * 100).toFixed(2))

      // basePrice for dayChange:
      //   null prevClose OR position touched today → avgBuyPrice
      //   position held overnight with valid prevClose → prevClose
      const basePrice = (prevClosePrice === null || new Date(position.updatedAt) >= todayMarketOpen)
        ? position.avgBuyPrice
        : prevClosePrice

      const dayChange = parseFloat(
        ((currentPrice - basePrice) * position.quantity).toFixed(2)
      )
      const dayChangePercent = parseFloat(
        (((currentPrice - basePrice) / basePrice) * 100).toFixed(2)
      )

      return {
        ticker:          position.ticker,
        quantity:        position.quantity,
        avgBuyPrice:     position.avgBuyPrice,
        currentPrice,
        costBasis:       parseFloat(costBasis.toFixed(2)),
        marketValue:     parseFloat(marketValue.toFixed(2)),
        pnl:             parseFloat(pnl.toFixed(2)),
        pnlPercent,
        dayChange,
        dayChangePercent,
      }
    })
  )

  const totalCostBasis = parseFloat(
    enrichedPositions.reduce((sum, p) => sum + p.costBasis, 0).toFixed(2)
  )
  const totalMarketValue = parseFloat(
    enrichedPositions.reduce((sum, p) => sum + p.marketValue, 0).toFixed(2)
  )
  const totalPnl = parseFloat((totalMarketValue - totalCostBasis).toFixed(2))
  const totalPnlPercent = totalCostBasis === 0
    ? 0
    : parseFloat(((totalPnl / totalCostBasis) * 100).toFixed(2))
  const totalDayChange = parseFloat(
    enrichedPositions.reduce((sum, p) => sum + p.dayChange, 0).toFixed(2)
  )

  return {
    positions: enrichedPositions,
    summary: {
      totalCostBasis,
      totalMarketValue,
      totalPnl,
      totalPnlPercent,
      totalDayChange,
    },
  }
}

module.exports = { getPortfolio }