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

      // dayChange: how much this position's total value changed today.
      // quote.change is the per-share dollar change since previous close.
      // Multiply by quantity to get the total position dollar change.
      // Example: AAPL up $1.50/share, user holds 10 shares → dayChange = $15.00
      const dayChange = parseFloat((quote.change * position.quantity).toFixed(2))

      // dayChangePercent: the percentage change for this stock today.
      // Same value regardless of quantity — it is a per-share percentage.
      // Rounded to 2 decimal places.
      const dayChangePercent = parseFloat(quote.changePercent.toFixed(2))

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