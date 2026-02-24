/*
 * WALLET MODEL — model.js
 * ─────────────────────────────────────────────────────────────
 * Responsibility:
 *   Defines the MongoDB schema for the wallets collection.
 *   Each user has exactly one wallet document.
 *   Transactions are embedded as a subdocument array (ledger).
 *
 * What belongs here:
 *   Schema definition, data types, constraints, defaults.
 *
 * What does not belong here:
 *   Business logic, HTTP handling, auth logic.
 */

const mongoose = require('mongoose');

// ─── Transaction Subdocument Schema ───────────────────────────
// Every credit change is stored as an entry here.
// type    → direction of the change (credit = in, debit = out)
// amount  → always a positive number, direction comes from type
// reason  → human-readable label for audit and display
// referenceId → links to a Trade _id when relevant, null otherwise

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      // Examples: 'registration_bonus', 'buy_trade', 'sell_trade'
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

// ─── Wallet Schema ────────────────────────────────────────────

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      // One wallet per user, enforced at the DB index level.
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      // Service layer checks balance before any debit.
      // This min: 0 is a last-resort DB constraint, not the primary guard.
    },
    transactions: {
      type: [transactionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;