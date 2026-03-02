/*
 * trade/controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   HTTP layer for trade operations.
 *   Reads from req, calls the service, writes to res.
 *   Contains no business logic.
 *
 * RESPONSIBILITIES:
 *   - Extract userId, ticker, quantity from the request
 *   - Call the appropriate service function
 *   - Return the correct HTTP response
 *   - Pass errors to next(err) for the global error handler
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Price retrieval
 *   - Wallet operations
 *   - Position logic
 *   - Any conditional logic beyond reading req and writing res
 */

/**
API contracts
    POST /api/trade/buy
    Header:   Authorization: Bearer <accessToken>
    Request:  { ticker: 'AAPL', quantity: 5 }
    201:      { success: true, message: 'Buy order executed', data: { trade } }
    400:      { message: 'Insufficient credits' }
    404:      { message: "Ticker 'XYZ' is not available" }
    422:      { success: false, errors: [{ field, message }] }

    POST /api/trade/sell
    Header:   Authorization: Bearer <accessToken>
    Request:  { ticker: 'AAPL', quantity: 3 }
    200:      { success: true, message: 'Sell order executed', data: { trade } }
    400:      { message: 'You do not hold any shares of AAPL' }
    400:      { message: 'Insufficient shares. You own 2 share(s)...' }
    404:      { message: "Ticker 'XYZ' is not available" }
    422:      { success: false, errors: [{ field, message }] }
 */

const { executeBuy, executeSell, getTradeHistory } = require('./service');

// buy(req, res, next)
//
// Handles POST /api/trade/buy
//
// req.user.sub  — userId from the verified JWT (set by authenticate middleware)
// req.body      — { ticker, quantity } validated and sanitized by validateTrade
//
// On success: 201 with the trade document
// On failure: passes error to global error handler via next(err)
const buy = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { ticker, quantity } = req.body;

    const trade = await executeBuy(userId, ticker, quantity);

    return res.status(201).json({
      success: true,
      message: 'Buy order executed',
      data: { trade },
    });
  } catch (err) {
    next(err);
  }
};

// sell(req, res, next)
//
// Handles POST /api/trade/sell
//
// req.user.sub  — userId from the verified JWT
// req.body      — { ticker, quantity } validated and sanitized by validateTrade
//
// On success: 200 with the trade document
// On failure: passes error to global error handler via next(err)
const sell = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { ticker, quantity } = req.body;

    const trade = await executeSell(userId, ticker, quantity);

    return res.status(200).json({
      success: true,
      message: 'Sell order executed',
      data: { trade },
    });
  } catch (err) {
    next(err);
  }
};

// history(req, res, next)
//
// Handles GET /api/trade/history
//
// Returns all trades for the authenticated user, newest first.
// req.user.sub — userId from the verified JWT.
//
// 200: { success: true, data: { trades: [] } }
const history = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const trades = await getTradeHistory(userId);

    return res.status(200).json({
      success: true,
      data: { trades },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { buy, sell, history };