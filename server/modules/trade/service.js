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
 *   1. Get price
 *   2. Calculate total cost
 *   3. Debit wallet     ← if this fails, nothing is written to DB
 *   4. Save trade record
 *   5. Create or update position
 *
 * EXECUTION ORDER FOR SELL:
 *   1. Get price
 *   2. Validate position exists and quantity is sufficient
 *   3. Calculate total return
 *   4. Save trade record  ← captures trade._id for wallet referenceId
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
        ├── market/service.js     getPrice('AAPL')          → 180
        │
        ├── wallet/service.js     debitCredits(userId, 900)  → wallet saved
        │
        ├── trade/model.js        Trade.create(...)          → trade document
        │
        └── position/service.js   createOrUpdatePosition()  → position saved
 */

/**
   executeBuy(userId, ticker, quantity)
    │
    ├── 1. getPrice(ticker)
    │       market/service.js returns 180
    │       If ticker unknown → 404 thrown, buy stops
    │
    ├── 2. totalCost = quantity × price
    │       5 shares × $180 = $900
    │
    ├── 3. debitCredits(userId, totalCost, 'trade_buy', null)
    │       wallet/service.js deducts $900 from balance
    │       If insufficient credits → 400 thrown, buy stops
    │       Wallet is debited before the trade is recorded.
    │       If anything after this fails, that is a post-MVP concern (noted below).
    │
    ├── 4. Trade.create({ userId, ticker, quantity, priceAtExecution, ... })
    │       Permanent record written to trades collection
    │
    └── 5. createOrUpdatePosition(userId, ticker, quantity, price)
            position/service.js creates or updates the holding
 */

/**
   The full sell scenario end to end

    User holds: { ticker: 'AAPL', quantity: 5, avgBuyPrice: 180 }
    User sells: 3 shares

    executeSell(userId, 'AAPL', 3)
    │
    ├── getPrice('AAPL')                  → 180
    ├── getPosition(userId, 'AAPL')       → { quantity: 5, avgBuyPrice: 180 }
    ├── position.quantity (5) >= 3        → pass
    ├── totalReturn = 3 × 180             → 540
    ├── Trade.create({ action: 'sell' })  → trade._id = 'abc123'
    ├── creditCredits(userId, 540, 'trade_sell', 'abc123')
    │     wallet.balance: 99,100 → 99,640
    │     transaction: { type: 'credit', reason: 'trade_sell', referenceId: 'abc123' }
    └── reduceOrClosePosition(userId, 'AAPL', 3)
            position.quantity: 5 → 2
            avgBuyPrice: 180 (unchanged)

    Result: { ticker: 'AAPL', quantity: 2, avgBuyPrice: 180 }




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
    ├── 1. getPrice(ticker)
    │       market/service.js returns current mock price
    │       If ticker unknown → 404 thrown, sell stops
    │
    ├── 2. getPosition(userId, ticker)
    │       position/service.js returns current holding
    │       If no position exists → 400 thrown (user owns nothing)
    │       If position.quantity < requested quantity → 400 thrown
    │
    ├── 3. totalReturn = quantity × price
    │       5 shares × $180 = $900
    │
    ├── 4. Trade.create({ action: 'sell', ... })
    │       Permanent record written first
    │       On sell the wallet credit is low-risk to do after —
    │       explained below
    │
    └── 5. creditCredits(userId, totalReturn, 'trade_sell', trade._id)
            wallet/service.js adds credits back
            trade._id is now available as referenceId
            
    └── 6. reduceOrClosePosition(userId, ticker, quantity)
            position/service.js reduces or deletes holding
 */

const Trade = require('./model');
const { getPrice } = require('../market/service');
const { debitCredits, creditCredits } = require('../wallet/service');
const {
  createOrUpdatePosition,
  reduceOrClosePosition,
  getPosition,
} = require('../position/service');

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
// Throws on invalid ticker, insufficient credits, or DB failure.
const executeBuy = async (userId, ticker, quantity) => {
  // Step 1: Get the current mock price for this ticker.
  // getPrice() throws 404 if the ticker is not in the mock price table.
  const price = getPrice(ticker);

  // Step 2: Calculate the total cost of this purchase.
  const totalCost = quantity * price;

  // Step 3: Debit the user's wallet.
  // debitCredits() throws 400 if balance is insufficient.
  // If it throws, nothing is written to the DB.
  // referenceId is null — trade._id does not exist yet at this point.
  await debitCredits(userId, totalCost, 'trade_buy', null);

  // Step 4: Record the trade permanently.
  const trade = await Trade.create({
    userId,
    ticker,
    action: 'buy',
    quantity,
    priceAtExecution: price,
  });

  // Step 5: Create or update the position.
  await createOrUpdatePosition(userId, ticker, quantity, price);

  return trade;
};

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
// Throws if ticker is invalid, position does not exist,
// or user attempts to sell more shares than they own.
const executeSell = async (userId, ticker, quantity) => {
  // Step 1: Get the current mock price for this ticker.
  // Uses the same price source as buy — market/service.js.
  // In a real platform this would be the live bid price.
  // At MVP it is the same hardcoded number.
  const price = getPrice(ticker);

  // Step 2: Validate that the user owns this stock and has enough shares.
  // getPosition() returns the current Position document or null.
  const position = await getPosition(userId, ticker);

  // If no position exists, the user owns zero shares of this ticker.
  // They cannot sell something they do not own.
  if (!position) {
    const err = new Error(`You do not hold any shares of ${ticker}`);
    err.statusCode = 400;
    throw err;
  }

  // If the user owns fewer shares than they are trying to sell, reject.
  // No short selling — users can only sell what they actually hold.
  if (position.quantity < quantity) {
    const err = new Error(
      `Insufficient shares. You own ${position.quantity} share(s) of ${ticker} but attempted to sell ${quantity}`
    );
    err.statusCode = 400;
    throw err;
  }

  // Step 3: Calculate the total return from this sale.
  // quantity × current mock price.
  const totalReturn = quantity * price;

  // Step 4: Record the trade permanently.
  // trade._id is captured here so it can be passed to creditCredits
  // as the referenceId — linking the wallet credit to this specific trade.
  const trade = await Trade.create({
    userId,
    ticker,
    action: 'sell',
    quantity,
    priceAtExecution: price,
  });

  // Step 5: Credit the user's wallet.
  // Passes trade._id as referenceId — the wallet transaction record
  // will reference exactly which trade caused this credit.
  await creditCredits(userId, totalReturn, 'trade_sell', trade._id);

  // Step 6: Reduce or close the position.
  // If quantity sold equals quantity held, the position document is deleted.
  // If shares remain, quantity is reduced and avgBuyPrice is unchanged.
  await reduceOrClosePosition(userId, ticker, quantity);

  return trade;
};

module.exports = { executeBuy, executeSell };