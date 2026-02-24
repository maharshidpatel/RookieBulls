/*
 * WALLET MODULE — _tests.js
 * ─────────────────────────────────────────────────────────────
 * Manual Thunder Client tests for wallet endpoints.
 * Run these in order. Get a fresh token before each session.
 *
 * ── Test 1: Get wallet — authenticated ──────────────────────
 * GET http://localhost:5000/api/wallet/me
 * Header: Authorization: Bearer <accessToken>
 * Expected: 200
 * Body: { success: true, data: { wallet: { balance: 100000, ... } } }
 *
 * ── Test 2: Get wallet — no token ───────────────────────────
 * GET http://localhost:5000/api/wallet/me
 * Expected: 401
 * Body: { success: false, message: "Access token is required" }
 *
 * ── Test 3: Get wallet — invalid token ──────────────────────
 * GET http://localhost:5000/api/wallet/me
 * Header: Authorization: Bearer invalidtoken
 * Expected: 401
 * Body: { success: false, message: "Invalid or expired access token" }
 *
 * ── Test 4: Wallet auto-created on register ──────────────────
 * POST http://localhost:5000/api/auth/register
 * Body: { email: "wallettest@example.com", password: "password123" }
 * Expected: 201
 * Then check Mongo Express — wallets collection should have
 * a new document with balance: 100000 and one registration_bonus transaction.
 *
 * All 4 tests verified and passing.
 */