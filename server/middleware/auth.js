/*
 * FILE: server/middleware/auth.js
 *
 * RESPONSIBILITY:
 *   Verifies the JWT access token on every protected route.
 *   Attaches the decoded user identity to req.user if valid.
 *   Rejects the request with 401 if the token is missing,
 *   invalid, or expired.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic
 *   - Database queries (token payload is trusted after verification)
 *   - Role checks (that is a separate middleware — authorize.js, future)
 *
 * HOW IT FITS:
 *   Applied to any route that requires a logged-in user.
 *   Sits between the route definition and the controller function.
 *
 *   Example usage in a routes file:
 *     const { authenticate } = require('../../middleware/auth')
 *     router.get('/portfolio', authenticate, controller.getPortfolio)
 *
 * REQUEST FLOW:
 *   Request arrives
 *     → authenticate runs
 *     → token verified
 *     → req.user populated
 *     → controller runs
 */

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

/*
 * AUTHENTICATE
 *
 * Middleware function that protects routes requiring a logged-in user.
 *
 * What it does:
 *   1. Reads the Authorization header
 *   2. Extracts the token from "Bearer <token>"
 *   3. Verifies the token signature and expiry using the access secret
 *   4. Attaches decoded payload to req.user
 *   5. Calls next() to allow the request to continue
 */
function authenticate(req, res, next) {
  /*
   * Read the Authorization header.
   * Expected format: "Bearer eyJhbGci..."
   * If the header is missing, authHeader is undefined.
   */
  const authHeader = req.headers['authorization'];

  /*
   * Extract the token from the header.
   * authHeader.split(' ') produces: ['Bearer', 'eyJhbGci...']
   * [1] takes the second element — the token itself.
   * If authHeader is undefined, token is also undefined.
   */
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required',
    });
  }

  /*
   * jwt.verify(token, secret)
   *   Checks two things:
   *     1. The signature — was this token signed with our secret?
   *        If someone tampered with the payload, the signature will not match.
   *     2. The expiry — is the token still within its valid time window?
   *
   *   If both pass, returns the decoded payload object.
   *   If either fails, throws an error caught by the catch block below.
   */
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    /*
     * Attach the decoded payload to req.user.
     * decoded contains: { sub: userId, role: 'user', iat: ..., exp: ... }
     *
     * sub = subject = the user's _id (set when the token was created)
     * role = the user's role (used for authorization checks later)
     * iat = issued at timestamp
     * exp = expiry timestamp
     *
     * Controllers on protected routes can now read req.user.sub
     * to know which user made the request — without hitting the database.
     */
    req.user = decoded;

    next();
  } catch (err) {
    /*
     * JsonWebTokenError — token was tampered with or malformed
     * TokenExpiredError — token is past its expiry time
     *
     * Both cases return 401. The client must log in again
     * or use the refresh token to get a new access token.
     */
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired access token',
    });
  }
}

module.exports = { authenticate };