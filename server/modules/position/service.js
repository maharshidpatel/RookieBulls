/*
 * position/service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   All database operations for Position documents.
 *   Called by trade/service.js after a buy or sell executes.
 *   Never called directly from a controller or route.
 *
 * RESPONSIBILITIES:
 *   - Create a new position on first buy of a ticker
 *   - Update quantity and avgBuyPrice on subsequent buys
 *   - Reduce quantity on sell
 *   - Delete the position document when quantity reaches zero
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Trade execution logic (belongs in trade/service.js)
 *   - Price retrieval (belongs in market/service.js)
 *   - Wallet operations (belongs in wallet/service.js)
 *   - HTTP handling (belongs in trade/controller.js)
 *   - PnL calculations (belongs in portfolio/service.js)
 */

const Position = require('./model');

// createOrUpdatePosition(userId, ticker, quantity, price)
//
// Called after a successful buy.
// Two outcomes depending on whether a position already exists:
//
//   No existing position:
//     Creates a new Position document.
//     avgBuyPrice = the price paid in this trade.
//
//   Existing position:
//     Recalculates avgBuyPrice using weighted average formula:
//       newAvg = ((currentQty × currentAvg) + (newQty × newPrice))
//                ─────────────────────────────────────────────────
//                           (currentQty + newQty)
//
//     Example:
//       Existing: 5 shares at $180 avg
//       New buy:  5 shares at $200
//       newAvg = ((5 × 180) + (5 × 200)) / (5 + 5)
//              = (900 + 1000) / 10
//              = $190
//
// Returns the saved position document.
const createOrUpdatePosition = async (userId, ticker, quantity, price) => {
  // Look for an existing position for this user + ticker combination.
  const existing = await Position.findOne({ userId, ticker });

  if (!existing) {
    // No position exists yet. Create one.
    // avgBuyPrice is simply the price paid — no averaging needed.
    const position = await Position.create({
      userId,
      ticker,
      quantity,
      avgBuyPrice: price,
    });
    return position;
  }

  // Position exists. Calculate the new weighted average buy price.
  // This formula weights each purchase by its quantity so larger
  // purchases have proportionally more influence on the average.
  const totalShares = existing.quantity + quantity;
  const newAvgBuyPrice =
    (existing.quantity * existing.avgBuyPrice + quantity * price) / totalShares;

  existing.quantity = totalShares;
  existing.avgBuyPrice = newAvgBuyPrice;

  await existing.save();
  return existing;
};

// reduceOrClosePosition(userId, ticker, quantity)
//
// Called after a successful sell.
// Reduces the position quantity by the sold amount.
// If quantity reaches zero, the position document is deleted entirely.
//
// Does NOT recalculate avgBuyPrice on sell.
// Selling shares does not change the cost basis of remaining shares.
//
// Returns the updated position, or null if the position was closed.
//
// NOTE: This function is called in Step 4.5 (sell logic).
//       It is defined here alongside createOrUpdatePosition
//       because both operations belong to the same concern: position mutation.
const reduceOrClosePosition = async (userId, ticker, quantity) => {
  const position = await Position.findOne({ userId, ticker });

  // If no position exists, the sell should have been blocked earlier
  // in the trade service. This is a safety check.
  if (!position) {
    const err = new Error(`No position found for ${ticker}`);
    err.statusCode = 404;
    throw err;
  }

  const remainingQuantity = position.quantity - quantity;

  if (remainingQuantity === 0) {
    // User sold all their shares. Delete the position document.
    // A position with zero quantity should not exist in the database.
    await Position.deleteOne({ _id: position._id });
    return null;
  }

  // User still holds some shares. Update quantity.
  // avgBuyPrice is unchanged — selling does not affect cost basis.
  position.quantity = remainingQuantity;
  await position.save();
  return position;
};

// getPosition(userId, ticker)
//
// Returns the position for a given user and ticker.
// Returns null if no position exists (user does not hold this stock).
// Used by trade/service.js to validate a sell request.
const getPosition = async (userId, ticker) => {
  return await Position.findOne({ userId, ticker });
};

// getAllPositions(userId)
//
// Returns all open positions for a user.
// Used by portfolio/service.js in Step 4.7.
const getAllPositions = async (userId) => {
  return await Position.find({ userId });
};

module.exports = {
  createOrUpdatePosition,
  reduceOrClosePosition,
  getPosition,
  getAllPositions,
};