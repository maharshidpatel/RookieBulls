/*
 * portfolio/service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Calculates the user's current portfolio state.
 *   Reads positions and enriches each one with price and PnL data.
 *   Does not write to the database.
 *
 * WHAT CHANGED IN STEP 6.3:
 *   - Switched from getPrice() to getQuote() for each position.
 *   - getQuote() returns the same Finnhub /quote call but as a full object.
 *   - Added dayChange and dayChangePercent per position.
 *   - Added totalDayChange to the summary.
 *
 * Why getQuote() instead of getPrice() here:
 *   getPrice() returns a number — enough for the trade engine.
 *   getQuote() returns the full object including 'd' (change per share)
 *   and 'dp' (change percent) — needed for dayChange calculations.
 *   Same Finnhub HTTP call either way — no extra API requests.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Trade logic
 *   - Wallet operations
 *   - HTTP handling
 *   - Any database writes
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { getAllPositions } = require('../position/service')
const { getQuote } = require('../market/service')

// getTodayMarketOpen()
//
// Returns a Date object representing 9:30 AM ET today.
// Used to determine if a position was opened before or after today's market open.
// Positions opened before 9:30 AM ET use prevClose as the day change baseline.
// Positions opened at or after 9:30 AM ET use avgBuyPrice as the baseline —
// the prevClose predates their purchase so it is not a valid comparison point.
const getTodayMarketOpen = () => {
  const now = new Date()
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const et = new Date(etString)
  et.setHours(9, 30, 0, 0)
  return et
}

// getPortfolio(userId)
//
// Returns the full portfolio for a user — all open positions enriched
// with current price, cost basis, market value, PnL, day change,
// and portfolio totals.
//
// If the user holds no positions, returns an empty positions array
// and all totals at zero.
const getPortfolio = async (userId) => {
  // Fetch all open Position documents for this user.
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

  // Enrich each position with current quote data and calculated fields.
  // Promise.all() runs all Finnhub calls in parallel — one HTTP request
  // per position, all firing at the same time.
  const enrichedPositions = await Promise.all(
    positions.map(async (position) => {

      // getQuote() returns the full Finnhub quote object.
      // Same HTTP call as getPrice() — no additional API requests.
      const quote = await getQuote(position.ticker)

      // costBasis: total amount the user paid for their current shares.
      const costBasis = position.avgBuyPrice * position.quantity

      // marketValue: current worth of the position.
      const marketValue = quote.price * position.quantity

      // pnl: raw dollar gain or loss since purchase.
      const pnl = marketValue - costBasis

      // pnlPercent: gain or loss as a percentage of cost basis.
      const pnlPercent = parseFloat(((pnl / costBasis) * 100).toFixed(2))

      // Calculate today's market open time once — shared across all positions in this request.
      // Avoids recalculating on every iteration of the map.
      const todayMarketOpen = getTodayMarketOpen()

      // basePrice — the reference point for day change calculation.
      //
      // Two cases:
      //   Position opened today (at or after 9:30 AM ET):
      //     Use avgBuyPrice — the user did not own the stock at yesterday's close.
      //     prevClose predates their purchase and would inflate the day change figure.
      //
      //   Position opened before today:
      //     Use prevClose — the standard day change baseline.
      //     Reflects how much the stock moved since yesterday's close.

      // KNOWN LIMITATION:
      // When a user adds more shares to a position they already held from a previous day,
      // the day change calculation will be slightly overstated on that day only.
      //
      // Why: openedAt stores when the position was first created, not when shares were
      // last added. So a position from yesterday that gets 1 new share today still has
      // openedAt = yesterday, which means prevClose is used as the baseline for all shares
      // including the ones just bought. The new shares had no movement from prevClose to
      // their purchase price — but the formula counts that movement anyway.
      //
      // Example:
      //   Held 1 AAPL from yesterday. prevClose = $210, current = $220.
      //   Buy 1 more AAPL today at $220.
      //   Correct day change:  (220 - 210) * 1 original share = $10
      //   Calculated day change: (220 - 210) * 2 total shares = $20  ← overstated
      //
      // Impact: affects only the day the additional shares are purchased. The next
      // trading day prevClose updates to reflect the full position correctly.
      //
      // Fix post-MVP: add a lastAddedAt field to the Position model and use it
      // instead of openedAt to detect same-day additions.
      const basePrice = new Date(position.openedAt) >= todayMarketOpen
        ? position.avgBuyPrice   // bought today — measure from purchase price
        : quote.prevClose         // held before today — measure from yesterday's close

      // dayChange: dollar value change of this position since basePrice.
      // Positive = position gained value today.
      // Negative = position lost value today.
      const dayChange = parseFloat(
        ((quote.price - basePrice) * position.quantity).toFixed(2)
      )

      // dayChangePercent: percentage change from basePrice to current price.
      // Same baseline as dayChange — avgBuyPrice for today's purchases, prevClose otherwise.
      const dayChangePercent = parseFloat(
        (((quote.price - basePrice) / basePrice) * 100).toFixed(2)
      )

      return {
        ticker:           position.ticker,
        quantity:         position.quantity,
        avgBuyPrice:      position.avgBuyPrice,
        currentPrice:     quote.price,
        costBasis:        parseFloat(costBasis.toFixed(2)),
        marketValue:      parseFloat(marketValue.toFixed(2)),
        pnl:              parseFloat(pnl.toFixed(2)),
        pnlPercent,
        dayChange,
        dayChangePercent,
      }
    })
  )

  // Portfolio-level totals.
  const totalCostBasis = parseFloat(
    enrichedPositions.reduce((sum, p) => sum + p.costBasis, 0).toFixed(2)
  )

  const totalMarketValue = parseFloat(
    enrichedPositions.reduce((sum, p) => sum + p.marketValue, 0).toFixed(2)
  )

  const totalPnl = parseFloat((totalMarketValue - totalCostBasis).toFixed(2))

  const totalPnlPercent =
    totalCostBasis === 0
      ? 0
      : parseFloat(((totalPnl / totalCostBasis) * 100).toFixed(2))

  // totalDayChange: sum of all position dayChange values.
  // How much the entire portfolio's value moved today in dollars.
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