/*
 * WALLET ROUTES — routes.js
 * ─────────────────────────────────────────────────────────────
 * Responsibility:
 *   Maps HTTP methods and paths to controller functions.
 *   Applies authentication middleware to all wallet routes.
 *
 * All routes here are protected — no wallet data is public.
 *
 * Mounted in server.js as: app.use('/api/wallet', walletRoutes)
 * Full path: GET /api/wallet/me
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const walletController = require('./controller');

router.get('/me', authenticate, walletController.getMyWallet);

module.exports = router;