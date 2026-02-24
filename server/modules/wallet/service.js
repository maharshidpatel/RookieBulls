/*
 * WALLET SERVICE — service.js
 * ─────────────────────────────────────────────────────────────
 * Responsibility:
 *   All business logic for the virtual credit wallet.
 *   Called by the wallet controller. Calls the wallet model.
 *
 * What belongs here:
 *   Wallet creation, balance reads, credit and debit operations.
 *   Insufficient funds check.
 *   Transaction ledger entries.
 *
 * What does not belong here:
 *   req, res, next — no HTTP concerns allowed.
 *   Trade logic — that belongs in /trade.
 */

const Wallet = require('./model');

const REGISTRATION_BONUS = 100000;

// ─── createWallet ─────────────────────────────────────────────
// Creates a new wallet for a user with the registration bonus.
// Called internally by the auth service after user creation.
// Should never be called manually after registration.

async function createWallet(userId) {
  const wallet = await Wallet.create({
    userId,
    balance: REGISTRATION_BONUS,
    transactions: [
      {
        type: 'credit',
        amount: REGISTRATION_BONUS,
        reason: 'registration_bonus',
        referenceId: null,
      },
    ],
  });

  return wallet;
}

// ─── getWallet ────────────────────────────────────────────────
// Returns the wallet document for a given user.
// Throws 404 if no wallet exists (should never happen in normal flow).

async function getWallet(userId) {
  const wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    const err = new Error('Wallet not found');
    err.statusCode = 404;
    throw err;
  }

  return wallet;
}

// ─── creditCredits ────────────────────────────────────────────
// Adds credits to the wallet and records a transaction entry.
// Used for: sell trades, ad rewards, bonuses (post-MVP).

async function creditCredits(userId, amount, reason, referenceId = null) {
  const wallet = await getWallet(userId);

  wallet.balance += amount;
  wallet.transactions.push({
    type: 'credit',
    amount,
    reason,
    referenceId,
  });

  await wallet.save();
  return wallet;
}

// ─── debitCredits ─────────────────────────────────────────────
// Removes credits from the wallet and records a transaction entry.
// Used for: buy trades.
// Throws 400 if the user does not have enough credits.
// This is the primary insufficient funds guard for the platform.

async function debitCredits(userId, amount, reason, referenceId = null) {
  const wallet = await getWallet(userId);

  if (wallet.balance < amount) {
    const err = new Error('Insufficient credits');
    err.statusCode = 400;
    throw err;
  }

  wallet.balance -= amount;
  wallet.transactions.push({
    type: 'debit',
    amount,
    reason,
    referenceId,
  });

  await wallet.save();
  return wallet;
}

module.exports = { createWallet, getWallet, creditCredits, debitCredits };