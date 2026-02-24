/*
 * WALLET CONTROLLER — controller.js
 * ─────────────────────────────────────────────────────────────
 * Responsibility:
 *   HTTP layer for wallet operations.
 *   Extracts identity from req.user, calls the wallet service,
 *   and sends the response.
 *
 * What belongs here:
 *   req, res, next handling only.
 *
 * What does not belong here:
 *   Business logic, balance calculations, DB queries.
 *   Those all live in service.js.
 */

const walletService = require('./service');

async function getMyWallet(req, res, next) {
  try {
    // req.user is populated by the authenticate middleware.
    // req.user.sub is the userId encoded in the JWT.
    const wallet = await walletService.getWallet(req.user.sub);

    res.status(200).json({
      success: true,
      data: { wallet },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyWallet };