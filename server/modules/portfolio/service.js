/*
 * portfolio/service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Calculates the user's current portfolio state.
 *   Reads positions and enriches each one with price and PnL data.
 *   Does not write to the database.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Trade logic
 *   - Wallet operations
 *   - HTTP handling
 *   - Any database writes
 */

const { getAllPositions } = require('../position/service')
const { getPrice } = require('../market/service')

// getPortfolio(userId)
//
// Returns the full portfolio for a user — all open positions enriched
// with current price, cost basis, market value, PnL, and portfolio totals.
//
// If the user holds no positions, returns an empty positions array
// and all totals at zero.
const getPortfolio = async (userId) => {
  // Fetch all open Position documents for this user.
  // Returns an empty array if the user holds nothing.
  const positions = await getAllPositions(userId)

  // If the user has no open positions, return a zeroed summary.
  // No price lookups needed.
  if (positions.length === 0) {
    return {
      positions: [],
      summary: {
        totalCostBasis:   0,
        totalMarketValue: 0,
        totalPnl:         0,
        totalPnlPercent:  0,
      },
    }
  }

  // Enrich each position with current price and calculated fields.
  //
  // Why Promise.all() instead of a plain .map():
  //   getPrice() is now async — it makes a real HTTP call to Finnhub.
  //   A plain .map() is not async-aware. Writing await inside .map()
  //   makes each callback return a Promise, not a value — the outer
  //   .map() does not wait for them and returns an array of Promises.
  //
  //   Promise.all() accepts that array of Promises and waits for every
  //   one to resolve before continuing. It also runs all the Finnhub
  //   calls in parallel rather than one after another — if a user holds
  //   10 positions, all 10 price lookups fire at the same time.
  const enrichedPositions = await Promise.all(
    positions.map(async (position) => {
      // Each getPrice() call fires a real HTTP request to Finnhub.
      // All calls across the .map() run in parallel via Promise.all().
      const currentPrice = await getPrice(position.ticker)

      // costBasis: total amount the user paid for their current shares.
      // avgBuyPrice × quantity — this is what they are "in for."
      const costBasis = position.avgBuyPrice * position.quantity

      // marketValue: what those shares are worth at the current price.
      // currentPrice × quantity — this is what they could get if they sold now.
      const marketValue = currentPrice * position.quantity

      // pnl: the raw dollar gain or loss.
      // Positive = gain. Negative = loss.
      const pnl = marketValue - costBasis

      // pnlPercent: gain or loss expressed as a percentage of cost basis.
      // Example: paid $1000, now worth $1200 → pnlPercent = 20
      // Rounded to 2 decimal places to avoid floating point noise
      // like 19.999999999 instead of 20.
      const pnlPercent = parseFloat(((pnl / costBasis) * 100).toFixed(2))

      return {
        ticker:      position.ticker,
        quantity:    position.quantity,
        avgBuyPrice: position.avgBuyPrice,
        currentPrice,
        costBasis:   parseFloat(costBasis.toFixed(2)),
        marketValue: parseFloat(marketValue.toFixed(2)),
        pnl:         parseFloat(pnl.toFixed(2)),
        pnlPercent,
      }
    })
  )

  // Calculate portfolio-level totals by summing across all positions.
  const totalCostBasis = parseFloat(
    enrichedPositions
      .reduce((sum, p) => sum + p.costBasis, 0)
      .toFixed(2)
  )

  const totalMarketValue = parseFloat(
    enrichedPositions
      .reduce((sum, p) => sum + p.marketValue, 0)
      .toFixed(2)
  )

  const totalPnl = parseFloat((totalMarketValue - totalCostBasis).toFixed(2))

  // totalPnlPercent: overall portfolio gain or loss as a percentage.
  // Guard against division by zero if totalCostBasis is somehow 0.
  const totalPnlPercent =
    totalCostBasis === 0
      ? 0
      : parseFloat(((totalPnl / totalCostBasis) * 100).toFixed(2))

  return {
    positions: enrichedPositions,
    summary: {
      totalCostBasis,
      totalMarketValue,
      totalPnl,
      totalPnlPercent,
    },
  }
}

module.exports = { getPortfolio }