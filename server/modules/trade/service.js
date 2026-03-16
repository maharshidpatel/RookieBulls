/*
 * trade/service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Business logic for trade execution.
 *   Coordinates market, wallet, position, and trade model
 *   to complete a buy or sell operation.
 *
 * RESPONSIBILITIES:
 *   - executeBuy(userId, ticker, quantity)
 *   - executeSell(userId, ticker, quantity)
 *
 * WHAT DOES NOT BELONG HERE:
 *   - HTTP request or response handling (belongs in trade/controller.js)
 *   - Price data (belongs in market/service.js)
 *   - Wallet balance operations (belongs in wallet/service.js)
 *   - Position mutation (belongs in position/service.js)
 *   - PnL calculations (belongs in portfolio/service.js)
 *
 * EXECUTION ORDER FOR BUY:
 *   0. Check market is open  ← throws 403 if closed
 *   1. Get price
 *   2. Calculate total cost
 *   3. Debit wallet          ← if this fails, nothing is written to DB
 *   4. Save trade record
 *   5. Create or update position
 *
 * EXECUTION ORDER FOR SELL:
 *   0. Check market is open  ← throws 403 if closed
 *   1. Get price
 *   2. Validate position exists and quantity is sufficient
 *   3. Calculate total return
 *   4. Save trade record     ← captures trade._id for wallet referenceId
 *   5. Credit wallet
 *   6. Reduce or close position
 *
 * NOTE ON ATOMICITY:
 *   Steps across both flows involve multiple separate DB operations.
 *   They are not wrapped in a transaction at MVP.
 *   If a later step fails after an earlier one succeeds, the state
 *   will be inconsistent. This is an accepted MVP limitation.
 *   Fix: wrap operations in a MongoDB session transaction (post-MVP).
 */

/**
The full Buy scenario end to end

POST /api/trade/buy  { ticker: 'AAPL', quantity: 5 }
        │
        ▼
trade/service.js → executeBuy(userId, 'AAPL', 5)
        │
        ├── market/service.js     isMarketOpen()            → true/false
        │       If false → 403 thrown, buy stops
        │
        ├── market/service.js     getPrice('AAPL')          → 175.50
        │
        ├── wallet/service.js     debitCredits(userId, 877.50) → wallet saved
        │
        ├── trade/model.js        Trade.create(...)          → trade document
        │
        └── position/service.js   createOrUpdatePosition()  → position saved
*/

/**
  executeBuy(userId, ticker, quantity)
   │
   ├── 0. isMarketOpen()
   │       market/service.js checks NYSE market hours (Stooq 15-min delay applied)
   │       If false → 403 thrown, buy stops immediately
   │       No price lookup, no wallet debit, nothing happens
   │
   ├── 1. getPrice(ticker)
   │       market/service.js returns delayed Stooq price
   │       If ticker unknown → 404 thrown, buy stops
   │
   ├── 2. totalCost = quantity × price
   │       5 shares × $175.50 = $877.50
   │
   ├── 3. debitCredits(userId, totalCost, 'trade_buy', null)
   │       wallet/service.js deducts $877.50 from balance
   │       If insufficient credits → 400 thrown, buy stops
   │       Wallet is debited before the trade is recorded.
   │       If anything after this fails, that is a post-MVP concern (noted above).
   │
   ├── 4. Trade.create({ userId, ticker, quantity, priceAtExecution, ... })
   │       Permanent record written to trades collection
   │
   └── 5. createOrUpdatePosition(userId, ticker, quantity, price)
           position/service.js creates or updates the holding
*/

/**
  The full sell scenario end to end

   User holds: { ticker: 'AAPL', quantity: 5, avgBuyPrice: 175.50 }
   User sells: 3 shares

   executeSell(userId, 'AAPL', 3)
   │
   ├── isMarketOpen()                    → true
   ├── getPrice('AAPL')                  → 175.50
   ├── getPosition(userId, 'AAPL')       → { quantity: 5, avgBuyPrice: 175.50 }
   ├── position.quantity (5) >= 3        → pass
   ├── totalReturn = 3 × 175.50          → 526.50
   ├── Trade.create({ action: 'sell' })  → trade._id = 'abc123'
   ├── creditCredits(userId, 526.50, 'trade_sell', 'abc123')
   │     wallet.balance: 99,100 → 99,626.50
   │     transaction: { type: 'credit', reason: 'trade_sell', referenceId: 'abc123' }
   └── reduceOrClosePosition(userId, 'AAPL', 3)
           position.quantity: 5 → 2
           avgBuyPrice: 175.50 (unchanged on partial sell)

   Result: { ticker: 'AAPL', quantity: 2, avgBuyPrice: 175.50 }


   Full close scenario

   User holds: { ticker: 'AAPL', quantity: 3 }
   User sells: 3 shares

   reduceOrClosePosition(userId, 'AAPL', 3)
   remainingQuantity = 3 - 3 = 0
   → Position.deleteOne({ _id: position._id })
   → returns null

   Position document is gone from the database.
*/

/**
  executeSell(userId, ticker, quantity)
   │
   ├── 0. isMarketOpen()
   │       market/service.js checks NYSE market hours (Stooq 15-min delay applied)
   │       If false → 403 thrown, sell stops immediately
   │
   ├── 1. getPrice(ticker)
   │       market/service.js returns delayed Stooq price
   │       If ticker unknown → 404 thrown, sell stops
   │
   ├── 2. getPosition(userId, ticker)
   │       position/service.js returns current holding
   │       If no position exists → 400 thrown (user owns nothing)
   │       If position.quantity < requested quantity → 400 thrown
   │
   ├── 3. totalReturn = quantity × price
   │       3 shares × $175.50 = $526.50
   │
   ├── 4. Trade.create({ action: 'sell', ... })
   │       Permanent record written first
   │       trade._id captured here for use as wallet referenceId
   │
   ├── 5. creditCredits(userId, totalReturn, 'trade_sell', trade._id)
   │       wallet/service.js adds credits back
   │       trade._id passed as referenceId — links wallet credit to this trade
   │
   └── 6. reduceOrClosePosition(userId, ticker, quantity)
           position/service.js reduces or deletes holding
*/

const Trade = require('./model')
const { getPrice, isMarketOpen } = require('../market/service')
const { debitCredits, creditCredits } = require('../wallet/service')
const {
  createOrUpdatePosition,
  reduceOrClosePosition,
  getPosition,
} = require('../position/service')

// executeBuy(userId, ticker, quantity)
//
// Executes a simulated market buy order.
//
// Parameters:
//   userId   — the authenticated user's _id (from req.user.sub)
//   ticker   — stock symbol string (e.g. 'AAPL')
//   quantity — number of shares to buy (positive integer)
//
// Returns the saved Trade document on success.
// Throws on closed market, invalid ticker, insufficient credits, or DB failure.
const executeBuy = async (userId, ticker, quantity) => {
  // Step 0: Check market hours before doing anything else.
  // isMarketOpen() checks NYSE market hours (Stooq 15-min delay applied).
  // If the market is closed, the trade is rejected immediately.
  // No price lookup, no wallet debit, no DB write happens.
  // This must be the first check — there is no point fetching a price
  // or debiting a wallet for a trade that cannot be executed.
  const marketOpen = await isMarketOpen()

  if (!marketOpen) {
    const err = new Error('Market is currently closed')
    err.statusCode = 403
    throw err
  }

  // Step 1: Get the current delayed price for this ticker from Stooq (via Redis cache).
  // getPrice() throws 404 if the ticker is not recognized.
  const price = await getPrice(ticker)

  // Step 2: Calculate the total cost of this purchase.
  const totalCost = quantity * price

  // Step 3: Debit the user's wallet.
  // debitCredits() throws 400 if balance is insufficient.
  // If it throws, nothing is written to the DB.
  // referenceId is null — trade._id does not exist yet at this point.
  await debitCredits(userId, totalCost, 'trade_buy', null)

  // Step 4: Record the trade permanently.
  const trade = await Trade.create({
    userId,
    ticker,
    action: 'buy',
    quantity,
    priceAtExecution: price,
  })

  // Step 5: Create or update the position.
  await createOrUpdatePosition(userId, ticker, quantity, price)

  return trade
}

// executeSell(userId, ticker, quantity)
//
// Executes a simulated market sell order.
//
// Parameters:
//   userId   — the authenticated user's _id (from req.user.sub)
//   ticker   — stock symbol string (e.g. 'AAPL')
//   quantity — number of shares to sell (positive integer)
//
// Returns the saved Trade document on success.
// Throws if market is closed, ticker is invalid, position does not exist,
// or user attempts to sell more shares than they own.
const executeSell = async (userId, ticker, quantity) => {
  // Step 0: Check market hours before doing anything else.
  // Same reasoning as executeBuy — reject closed-market trades immediately.
  const marketOpen = await isMarketOpen()

  if (!marketOpen) {
    const err = new Error('Market is currently closed')
    err.statusCode = 403
    throw err
  }

  // Step 1: Get the current delayed price for this ticker from Stooq (via Redis cache).
  const price = await getPrice(ticker)

  // Step 2: Validate that the user owns this stock and has enough shares.
  // getPosition() returns the current Position document or null.
  const position = await getPosition(userId, ticker)

  // If no position exists, the user owns zero shares of this ticker.
  // They cannot sell something they do not own.
  if (!position) {
    const err = new Error(`You do not hold any shares of ${ticker}`)
    err.statusCode = 400
    throw err
  }

  // If the user owns fewer shares than they are trying to sell, reject.
  // No short selling — users can only sell what they actually hold.
  if (position.quantity < quantity) {
    const err = new Error(
      `Insufficient shares. You own ${position.quantity} share(s) of ${ticker} but attempted to sell ${quantity}`
    )
    err.statusCode = 400
    throw err
  }

  // Step 3: Calculate the total return from this sale.
  const totalReturn = quantity * price

  // Step 4: Record the trade permanently.
  // trade._id is captured here so it can be passed to creditCredits
  // as the referenceId — linking the wallet credit to this specific trade.
  const trade = await Trade.create({
    userId,
    ticker,
    action: 'sell',
    quantity,
    priceAtExecution: price,
  })

  // Step 5: Credit the user's wallet.
  // Passes trade._id as referenceId — the wallet transaction record
  // will reference exactly which trade caused this credit.
  await creditCredits(userId, totalReturn, 'trade_sell', trade._id)

  // Step 6: Reduce or close the position.
  // If quantity sold equals quantity held, the position document is deleted.
  // If shares remain, quantity is reduced and avgBuyPrice is unchanged.
  await reduceOrClosePosition(userId, ticker, quantity)

  return trade
}

// getTradeHistory(userId)
//
// Returns all trades for a user, sorted newest first.
// No pagination at Step 6 — full history returned in one response.
// Pagination added post-deployment when real volume warrants it (noted in post-MVP).
//
// Returns an empty array if the user has made no trades.
const getTradeHistory = async (userId) => {
  // Trade.find() queries by userId — returns only this user's trades.
  // .sort({ createdAt: -1 }) — -1 = descending, so newest trades appear first.
  // .lean() returns plain JS objects instead of Mongoose documents.
  // Plain objects are lighter — no Mongoose methods attached, faster to serialize.
  const trades = await Trade.find({ userId }).sort({ createdAt: -1 }).lean()
  return trades
}

module.exports = { executeBuy, executeSell, getTradeHistory }