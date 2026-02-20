/**
 * MODULE: /server/modules/wallet
 *
 * Manages the virtual credit system that powers all trading in Rookie Bulls.
 * Credits are the simulated currency users trade with.
 * No real money exists anywhere in this system.
 *
 * Responsibilities:
 *  - Store current credit balance per user
 *  - Record every credit change as a transaction (full ledger history)
 *  - Deduct credits when a trade is executed
 *  - Return credits when a position is sold
 *  - Grant credits from ad rewards or daily bonuses (post-MVP)
 *
 * What a ledger means:
 *  Instead of just storing a balance number and updating it,
 *  every single change is recorded as a transaction entry.
 *  The current balance is the sum of all transactions.
 *  This means you can always audit exactly why a balance is
 *  what it is — every deduction and addition is traceable.
 *
 * MVP scope:
 *  - 100,000 credits granted automatically on registration
 *  - Credits deduct on buy, return on sell
 *  - No ad rewards or daily bonuses yet
 */