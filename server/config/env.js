/**
 * config/env.js — Environment Variable Loader
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
 */