/*
 * trade/model.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Defines the MongoDB schema and model for Trade documents.
 *   A Trade is a permanent, immutable record of a single execution event.
 *   One document is written per buy or sell action. It is never modified.
 *
 * WHY TRADES ARE NEVER MODIFIED:
 *   A trade record is financial history. Modifying it would be equivalent
 *   to altering a receipt after purchase. Even if a position is later closed,
 *   the individual trade records that built it remain unchanged.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic (belongs in trade/service.js)
 *   - HTTP handling (belongs in trade/controller.js)
 *   - Price retrieval (belongs in market/service.js)
 *   - Wallet operations (belongs in wallet/service.js)
 */

const mongoose = require('mongoose');

// The Trade schema captures everything about a single execution event.
// All fields are required — a trade with missing data should never be saved.
const tradeSchema = new mongoose.Schema(
  {
    // userId: which user placed this trade.
    // ref: 'User' tells Mongoose this ObjectId points to a User document.
    // This enables .populate('userId') in future queries if needed.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ticker: the stock symbol this trade is against.
    // Stored in uppercase — normalized before saving (e.g. 'AAPL', 'TSLA').
    ticker: {
      type: String,
      required: true,
      uppercase: true,  // Mongoose will auto-uppercase on save
      trim: true,
    },

    // action: whether this trade is a buy or a sell.
    // enum restricts the value to exactly these two strings.
    // Any other value will cause a Mongoose validation error before DB write.
    action: {
      type: String,
      enum: ['buy', 'sell'],
      required: true,
    },

    // quantity: how many shares were traded.
    // min: 1 — fractional shares and zero-quantity trades are not allowed at MVP.
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // priceAtExecution: the price per share at the moment this trade ran.
    // This value is locked in at write time and never changes.
    // Historical trades always reflect the price they actually ran at.
    priceAtExecution: {
      type: Number,
      required: true,
      min: 0,
    },

    // feesSimulated: a simulated commission or fee amount.
    // Always 0 at MVP — the field exists so the schema is production-ready.
    // When fee logic is added, this field is already in place on every trade.
    feesSimulated: {
      type: Number,
      default: 0,
    },

    // status: the current state of this trade.
    // 'executed' is the only valid status at MVP.
    // 'pending' and 'cancelled' are reserved for future order-book mechanics
    // where trades might not fill immediately.
    status: {
      type: String,
      enum: ['executed', 'pending', 'cancelled'],
      default: 'executed',
    },
  },

  {
    // timestamps: true tells Mongoose to automatically add two fields:
    //   createdAt — when the document was first saved
    //   updatedAt — when it was last modified
    //
    // For trades, createdAt serves as the execution timestamp.
    // This replaces the manually defined 'timestamp' field in the domain model
    // because Mongoose's built-in timestamps are more reliable and consistent.
    timestamps: true,
  }
);

// Indexes improve query performance by letting MongoDB locate documents
// without scanning the entire collection.
//
// Index on userId: the most common query will be "get all trades for this user."
// Without an index, MongoDB reads every trade document to find matches.
// With an index, it jumps directly to the right documents.
//
// Index on ticker: supports future queries like "all AAPL trades" for analytics.
tradeSchema.index({ userId: 1 });
tradeSchema.index({ ticker: 1 });

// compound index on userId + createdAt:
// Supports the query "get all trades for this user, sorted by time."
// The 1 means ascending order (oldest first).
// Use -1 for descending (newest first) if that becomes the more common query.
tradeSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Trade', tradeSchema);