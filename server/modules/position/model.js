/*
 * position/model.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Defines the MongoDB schema and model for Position documents.
 *   A Position is a live, mutable record of a user's current holding
 *   in a single stock. It is created on first buy and deleted when
 *   the user sells their last share.
 *
 * KEY CONSTRAINT:
 *   One position per user per ticker.
 *   Enforced by a unique compound index on { userId, ticker }.
 *   Attempting to insert a second AAPL position for the same user
 *   will throw a MongoDB duplicate key error.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic (belongs in position/service.js)
 *   - HTTP handling (belongs in trade/controller.js)
 *   - Trade recording (belongs in trade/model.js)
 *   - PnL calculations (belongs in portfolio/service.js)
 */

const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema(
  {
    // userId: which user owns this position.
    // ref: 'User' enables .populate('userId') in future queries.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ticker: which stock this position is in.
    // Stored uppercase — normalized before saving (e.g. 'AAPL', 'TSLA').
    // Combined with userId in a unique index — one position per user per ticker.
    ticker: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    // quantity: how many shares the user currently holds.
    // Updated on every buy and sell.
    // Never goes below 0 — the service layer enforces this.
    // When quantity reaches 0 the document is deleted, not set to 0.
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    // avgBuyPrice: the weighted average cost per share across all buys.
    // Recalculated by position/service.js on every new buy.
    // Not affected by sells — selling shares does not change the cost basis
    // of the remaining shares.
    //
    // Example:
    //   Buy 5 shares at $180 → avgBuyPrice = 180
    //   Buy 5 shares at $200 → avgBuyPrice = 190  ((900 + 1000) / 10)
    //   Sell 3 shares        → avgBuyPrice = 190  (unchanged)
    avgBuyPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // openedAt: when the position was first created.
    // Set once on document creation. Never updated.
    // Distinct from Mongoose's createdAt — this explicitly represents
    // the business concept of "when did the user first open this position."
    openedAt: {
      type: Date,
      default: Date.now,
    },
  },

  {
    // timestamps: true adds createdAt and updatedAt automatically.
    // updatedAt is useful here — it tells you when the position was
    // last changed (last buy or sell against it).
    timestamps: true,
  }
);

// Unique compound index on userId + ticker.
//
// This is the most important constraint on this collection.
// It enforces the rule: one position per user per ticker.
//
// unique: true means MongoDB will reject any insert that would create
// a duplicate (same userId + same ticker already exists).
//
// This index also serves as the primary lookup path:
// "find the AAPL position for this user" — the most common query
// in the entire position module.
positionSchema.index({ userId: 1, ticker: 1 }, { unique: true });

module.exports = mongoose.model('Position', positionSchema);

// Why selling does not change `avgBuyPrice`
// When a user sells shares, the cost basis of their remaining shares does not change. They originally paid `$190` average for their AAPL shares. Selling 3 of them does not alter what they paid for the remaining 7. The `avgBuyPrice` only recalculates on buys.
// This matters because PnL is calculated as:
// PnL = (currentPrice - avgBuyPrice) × quantity