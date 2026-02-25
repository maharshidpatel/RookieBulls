/*
 * portfolio/controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   HTTP layer for portfolio endpoints.
 *   Reads userId from req, calls the service, writes to res.
 *   Contains no business logic.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - PnL calculations
 *   - Price lookups
 *   - Any conditional logic beyond reading req and writing res
 */

const { getPortfolio } = require('./service');

// getMyPortfolio(req, res, next)
//
// Handles GET /api/portfolio/me
//
// req.user.sub — userId from the verified JWT
//
// On success: 200 with enriched positions and portfolio summary
// On failure: passes error to global error handler via next(err)
const getMyPortfolio = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const portfolio = await getPortfolio(userId);

    return res.status(200).json({
      success: true,
      data: { portfolio },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyPortfolio };