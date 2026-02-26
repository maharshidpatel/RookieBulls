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
 * Loads all variables from .env into process.env via dotenv.
 * Validates that required variables are present at startup.
 *
 * Why validate at startup:
 *  If a required variable is missing, the app fails immediately
 *  with a clear error message rather than failing silently
 *  during a request hours later with a confusing error.
 *
 * Usage:
 *  require('./config/env') at the top of server.js
 *  After that, process.env.VARIABLE_NAME is available everywhere.
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

  // The server must have a Finnhub API key to fetch stock prices.
  // If this is missing, market/service.js cannot call Finnhub and
  // the entire trade engine breaks silently. Fail at startup instead.
  'FINNHUB_API_KEY',

  // BYPASS_MARKET_HOURS is intentionally not in this required list.
  // Reason: it is an optional development flag, not a secret or credential.
  // If it is absent from .env, market/service.js treats it as false,
  // which is the correct safe default (market hours enforced).
  // Making it required would force every developer to add it manually,
  // which adds friction for no safety benefit.
]

const missing = required.filter(key => !process.env[key])

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

const env = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  MONGO_URI: process.env.MONGO_URI,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,

  // Finnhub API key — used exclusively inside market/service.js.
  // No other file reads this value directly.
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,

  // Development bypass flag for market hours enforcement.
  // process.env always returns a string, never a boolean.
  // The string 'true' is compared explicitly so that any other value
  // ('false', '', undefined) resolves to false — the safe default.
  // This means if the variable is missing from .env entirely,
  // BYPASS_MARKET_HOURS is false and market hours are enforced.
  BYPASS_MARKET_HOURS: process.env.BYPASS_MARKET_HOURS === 'true',
};

module.exports = { env };