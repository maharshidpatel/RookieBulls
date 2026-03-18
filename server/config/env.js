/**
 * config/env.js — Environment Variable Loader and Validator
 *
 * Loads and validates all environment variables from the .env file
 * before the application starts.
 *
 * Why this exists:
 *  - Centralizes all env variable access in one place
 *  - Fails loudly at startup if a required variable is missing
 *    rather than failing silently later during a request
 *
 * Rule: Every part of the app that needs a config value
 * imports it from here, not directly from process.env
 *
 * STEP 7 ADDITIONS:
 *  RESEND_API_KEY — required for sending verification emails on registration.
 *  Server refuses to start without it — a missing email key means
 *  registration silently fails to send verification emails,
 *  which would leave every new user stuck in an unverified state.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') })

const required = [
  'PORT',
  'NODE_ENV',
  'MONGO_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRY',
  'JWT_REFRESH_EXPIRY',
  'CLIENT_ORIGIN',

  // Redis connection string — required because the market module
  // depends on Redis for caching prices, quotes, candles, and profiles.
  // The background price updater worker also writes to Redis on every tick.
  // If Redis is unreachable at startup, the server refuses to start
  // rather than serving stale or missing market data silently.
  'REDIS_URL',

  // Resend API key — required for transactional email (verification emails).
  // Without this, new user registrations cannot complete the verification flow.
  // Sending access only — full access key is not needed.
  'RESEND_API_KEY',
]

const missing = required.filter(key => !process.env[key])

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

const env = {
  PORT:               process.env.PORT,
  NODE_ENV:           process.env.NODE_ENV,
  MONGO_URI:          process.env.MONGO_URI,
  JWT_ACCESS_SECRET:  process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY:  process.env.JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY,
  CLIENT_ORIGIN:      process.env.CLIENT_ORIGIN,

  // Redis URL — used exclusively inside market/cache/redisClient.js.
  // No other file reads this value directly.
  REDIS_URL: process.env.REDIS_URL,

  // Resend API key — used exclusively inside auth/emailService.js.
  // No other file reads this value directly.
  RESEND_API_KEY: process.env.RESEND_API_KEY,

  // NODE_ENV replaces the old BYPASS_MARKET_HOURS flag.
  // Previously a separate .env variable controlled the bypass,
  // which meant it could accidentally be left on in production.
  // Now the rule is simple:
  //   NODE_ENV=development  →  market hours check always returns true
  //   NODE_ENV=production   →  real market hours calculation applies
  // One variable, no separate flag, cannot accidentally deploy with bypass on.
  // marketHours.js reads env.NODE_ENV directly to apply this logic.
}

module.exports = { env }