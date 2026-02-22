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
  'CLIENT_ORIGIN'
]

const missing = required.filter(key => !process.env[key])

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

module.exports = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  MONGO_URI: process.env.MONGO_URI,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN
}