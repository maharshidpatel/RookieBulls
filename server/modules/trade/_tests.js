/*
 * trade/_tests.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual test sequences for the trade module.
 * Run these in order using a REST client (Thunder Client, Postman, curl).
 * Complete each group before moving to the next.
 *
 * PRE-CONDITION:
 *   Docker is running (docker compose up -d)
 *   Server is running (npm run dev)
 *   A registered user exists with a wallet balance of 100,000
 *   You have a valid accessToken from POST /api/auth/login
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GROUP 1 — Authentication guard
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TEST 1.1 — Buy without token
 *   POST /api/trade/buy
 *   Body: { "ticker": "AAPL", "quantity": 1 }
 *   No Authorization header
 *   Expected: 401
 *
 * TEST 1.2 — Sell without token
 *   POST /api/trade/sell
 *   Body: { "ticker": "AAPL", "quantity": 1 }
 *   No Authorization header
 *   Expected: 401
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GROUP 2 — Input validation
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TEST 2.1 — Missing ticker
 *   POST /api/trade/buy
 *   Body: { "quantity": 5 }
 *   Expected: 422, errors[0].field = 'ticker'
 *
 * TEST 2.2 — Missing quantity
 *   POST /api/trade/buy
 *   Body: { "ticker": "AAPL" }
 *   Expected: 422, errors[0].field = 'quantity'
 *
 * TEST 2.3 — Quantity of zero
 *   POST /api/trade/buy
 *   Body: { "ticker": "AAPL", "quantity": 0 }
 *   Expected: 422
 *
 * TEST 2.4 — Decimal quantity
 *   POST /api/trade/buy
 *   Body: { "ticker": "AAPL", "quantity": 2.5 }
 *   Expected: 422
 *
 * TEST 2.5 — Unknown ticker (passes validation, fails in service)
 *   POST /api/trade/buy
 *   Body: { "ticker": "FAKE", "quantity": 1 }
 *   Expected: 404, message contains 'FAKE'
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GROUP 3 — Buy flow
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TEST 3.1 — Valid buy
 *   POST /api/trade/buy
 *   Body: { "ticker": "AAPL", "quantity": 5 }
 *   Expected: 201
 *   Verify in response:
 *     trade.action     = 'buy'
 *     trade.ticker     = 'AAPL'
 *     trade.quantity   = 5
 *     trade.priceAtExecution = 180
 *     trade.status     = 'executed'
 *   Verify in Mongo Express:
 *     trades collection — one document created
 *     positions collection — one document: { ticker: 'AAPL', quantity: 5, avgBuyPrice: 180 }
 *     wallet — balance reduced by 900 (100000 → 99100)
 *     wallet.transactions — last entry: { type: 'debit', reason: 'trade_buy' }
 *
 * TEST 3.2 — Buy more of the same ticker (avgBuyPrice recalculation)
 *   POST /api/trade/buy
 *   Body: { "ticker": "AAPL", "quantity": 5 }
 *   Expected: 201
 *   Verify in Mongo Express:
 *     positions — same document updated: { quantity: 10, avgBuyPrice: 180 }
 *     (price is still 180 so avg stays 180 — this confirms update not insert)
 *     wallet — balance reduced by another 900 (99100 → 98200)
 *
 * TEST 3.3 — Buy a different ticker
 *   POST /api/trade/buy
 *   Body: { "ticker": "TSLA", "quantity": 2 }
 *   Expected: 201
 *   Verify in Mongo Express:
 *     positions — now two documents: AAPL and TSLA
 *     wallet — balance reduced by 500 (TSLA = 250, 2 × 250)
 *
 * TEST 3.4 — Insufficient credits
 *   (Use a fresh account or calculate remaining balance)
 *   POST /api/trade/buy
 *   Body: { "ticker": "NVDA", "quantity": 1000 }  ← 1000 × 900 = 900,000 > balance
 *   Expected: 400, message contains 'Insufficient'
 *   Verify in Mongo Express:
 *     No new trade document created
 *     No position created or changed
 *     Wallet balance unchanged
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GROUP 4 — Sell flow
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * (Assumes GROUP 3 tests ran — user holds 10 AAPL and 2 TSLA)
 *
 * TEST 4.1 — Sell stock not held
 *   POST /api/trade/sell
 *   Body: { "ticker": "MSFT", "quantity": 1 }
 *   Expected: 400, message contains 'do not hold'
 *
 * TEST 4.2 — Sell more than held
 *   POST /api/trade/sell
 *   Body: { "ticker": "AAPL", "quantity": 99 }
 *   Expected: 400, message contains 'Insufficient shares'
 *
 * TEST 4.3 — Valid partial sell
 *   POST /api/trade/sell
 *   Body: { "ticker": "AAPL", "quantity": 3 }
 *   Expected: 200
 *   Verify in response:
 *     trade.action   = 'sell'
 *     trade.quantity = 3
 *     trade.priceAtExecution = 180
 *   Verify in Mongo Express:
 *     positions — AAPL quantity reduced: 10 → 7
 *     wallet — balance increased by 540 (3 × 180)
 *     wallet.transactions — last entry: { type: 'credit', reason: 'trade_sell', referenceId: <trade._id> }
 *
 * TEST 4.4 — Full close (sell all remaining shares)
 *   POST /api/trade/sell
 *   Body: { "ticker": "AAPL", "quantity": 7 }
 *   Expected: 200
 *   Verify in Mongo Express:
 *     positions — AAPL document deleted entirely
 *     wallet — balance increased by 1260 (7 × 180)
 *
 * TEST 4.5 — Sell after close (position no longer exists)
 *   POST /api/trade/sell
 *   Body: { "ticker": "AAPL", "quantity": 1 }
 *   Expected: 400, message contains 'do not hold'
 */

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 5.6 TESTS — Market hours enforcement
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Prerequisites:
 *  - BYPASS_MARKET_HOURS=false in .env
 *  - Server restarted after changing the flag
 *  - Run these tests outside of market hours (evening, weekend, or holiday)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST — Buy blocked when market is closed
 * ─────────────────────────────────────────────────────────────────────────────
 * POST http://localhost:5000/api/trade/buy
 * Header: Authorization: Bearer <access_token>
 * Body:   { "ticker": "AAPL", "quantity": 1 }
 *
 * Expected:
 * Status: 403
 * { "status": "error", "message": "Market is currently closed" }
 *
 * What to confirm:
 *  - Trade is rejected before any price lookup or wallet debit
 *  - Status is 403 not 400 or 500
 *  - Wallet balance is unchanged
 *  - No trade record created in DB
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST — Sell blocked when market is closed
 * ─────────────────────────────────────────────────────────────────────────────
 * POST http://localhost:5000/api/trade/sell
 * Header: Authorization: Bearer <access_token>
 * Body:   { "ticker": "AAPL", "quantity": 1 }
 *
 * Expected:
 * Status: 403
 * { "status": "error", "message": "Market is currently closed" }
 *
 * What to confirm:
 *  - Sell is rejected at the same first step as buy
 *  - No position changes occur
 *  - No trade record created in DB
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST — Buy succeeds when bypass is enabled
 * ─────────────────────────────────────────────────────────────────────────────
 * In server/.env set: BYPASS_MARKET_HOURS=true
 * Restart the server.
 * Run outside of market hours.
 *
 * POST http://localhost:5000/api/trade/buy
 * Header: Authorization: Bearer <access_token>
 * Body:   { "ticker": "AAPL", "quantity": 1 }
 *
 * Expected:
 * Status: 201 with trade document
 *
 * What to confirm:
 *  - Trade executes normally with bypass enabled
 *  - priceAtExecution is a real Finnhub price, not hardcoded
 *  - Wallet balance reduced by quantity × priceAtExecution
 *
 * NOTE: BYPASS_MARKET_HOURS=true is kept on during development.
 *       Set to false before deploying to production.
 */