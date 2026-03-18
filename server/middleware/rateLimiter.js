/*
 * FILE: server/middleware/rateLimiter.js
 *
 * RESPONSIBILITY:
 *   Defines rate limiting middleware for sensitive endpoints.
 *   Prevents abuse by capping how many requests a single IP
 *   can make to a given endpoint within a time window.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Business logic
 *   - Authentication checks (that is middleware/auth.js)
 *   - Input validation (that is validators.js)
 *
 * HOW IT FITS:
 *   Limiters are imported in routes.js files and attached directly
 *   to the routes they protect, before the controller runs.
 *
 *   Example:
 *     router.post('/resend-verification', resendVerificationLimiter, ...validators, controller.fn)
 *
 * WHY RATE LIMIT:
 *   Without limits, a single bad actor can:
 *     - Exhaust your Resend email quota (100/day free tier) in seconds
 *     - Brute force login credentials by trying thousands of passwords
 *   Rate limiting caps the damage any single IP can do.
 *
 * HOW express-rate-limit WORKS:
 *   It tracks request counts per IP address in memory.
 *   When an IP exceeds the limit within the window, it returns 429.
 *   The counter resets automatically after the window expires.
 *
 *   windowMs — the time window in milliseconds
 *   limit    — max requests allowed per IP within that window
 *   message  — the response body sent when the limit is exceeded
 *
 * STORAGE NOTE:
 *   The default store is in-memory (inside the Node process).
 *   This is fine for a single-server deployment.
 *   If the app ever runs on multiple servers, counters would not
 *   be shared across instances — a Redis store would be needed then.
 *   That is a post-MVP concern.
 */

const rateLimit = require('express-rate-limit');

/*
 * RESEND VERIFICATION LIMITER
 *
 * Applied to: POST /api/auth/resend-verification
 *
 * Allows 3 resend attempts per IP per hour.
 * Resend's free tier allows 100 emails/day total.
 * Without this, one IP could exhaust the daily quota in a single loop.
 *
 * Why 3 per hour:
 *   A legitimate user who lost their email might retry once or twice.
 *   Three attempts is generous enough for real users, tight enough
 *   to stop automated abuse.
 */
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  limit: 3,
  /*
   * standardHeaders: true
   *   Adds RateLimit-* headers to the response so the client knows
   *   how many requests remain and when the window resets.
   *   Useful for debugging — visible in Thunder Client response headers.
   */
  standardHeaders: true,
  /*
   * legacyHeaders: false
   *   Disables the older X-RateLimit-* header format.
   *   The standard headers above replace them.
   */
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many resend attempts. Please try again in an hour.',
  },
});

/*
 * LOGIN LIMITER
 *
 * Applied to: POST /api/auth/login
 *
 * Allows 10 login attempts per IP per 15 minutes.
 * Slows down brute force password attacks significantly.
 *
 * Why 10 per 15 minutes:
 *   A real user who misremembers their password might try 3–4 times.
 *   10 is enough headroom for legitimate use while making automated
 *   attacks impractical — at 10 attempts per 15 minutes, trying
 *   10,000 passwords would take over 10 days.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

/*
 * REGISTER LIMITER
 *
 * Applied to: POST /api/auth/register
 *
 * Allows 5 registration attempts per IP per hour.
 * Protects the Resend email quota — every registration
 * triggers one email. Without this, one IP could exhaust
 * the 100/day free tier in a single automated loop.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again in an hour.',
  },
});

module.exports = { resendVerificationLimiter, loginLimiter, registerLimiter };