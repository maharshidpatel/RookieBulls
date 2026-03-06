/**
 * market/cache/redisClient.js — Redis Connection and Cache Wrappers
 *
 * Responsibility:
 *  Connects to Redis and exports simple get/set/del wrapper functions.
 *  All Redis operations in this application go through this file.
 *
 * What does not belong here:
 *  Business logic, market data parsing, or anything domain-specific.
 *  This file only knows how to read and write key-value pairs.
 *
 * How it fits into the request flow:
 *  market/service.js calls get() before calling an external provider.
 *  If the key exists (cache hit), the cached value is returned immediately.
 *  If the key is missing (cache miss), the provider is called, the result
 *  is stored via set(), then returned to the caller.
 *
 *  External providers (Stooq, SEC EDGAR) are never called directly by
 *  controllers or services without checking Redis first.
 *
 * Why ioredis:
 *  ioredis is the most widely used Redis client for Node.js.
 *  It handles reconnection automatically if Redis restarts.
 *  It supports async/await natively — no callback wrappers needed.
 */

const Redis = require('ioredis')
const { env } = require('../../../config/env')

// Create the Redis client using the connection string from .env
// ioredis parses the URL and connects automatically on creation.
// Format: redis://host:port
// Example: redis://localhost:6379
const client = new Redis(env.REDIS_URL, {
  // How long ioredis waits (in ms) before giving up on a connection attempt.
  // Without this, a missing Redis container causes the server to hang
  // indefinitely rather than failing with a clear error.
  connectTimeout: 5000,

  // How many times ioredis retries a failed connection before giving up.
  // On each retry it waits longer (exponential backoff built into ioredis).
  // Setting this to 3 means: try once, retry 3 times, then emit an error.
  maxRetriesPerRequest: 3,
})

// ── Connection event handlers ─────────────────────────────────────────────

// Fires when the client successfully connects to Redis.
// Logged at startup so you can confirm Redis is reachable.
client.on('connect', () => {
  console.log('Redis connected:', env.REDIS_URL)
})

// Fires when the client loses connection or fails to connect.
// Logged with the error message so you know exactly what went wrong.
// ioredis will attempt to reconnect automatically after this fires.
client.on('error', (err) => {
  console.error('Redis connection error:', err.message)
})

// ── Cache wrapper functions ───────────────────────────────────────────────

/**
 * get(key)
 *
 * Retrieves a value from Redis by key.
 * Returns the stored string, or null if the key does not exist or has expired.
 *
 * Why return null instead of throwing:
 *  A missing key is a normal cache miss, not an error.
 *  The caller checks for null and falls through to the external provider.
 *
 * Note: Redis stores everything as strings.
 *  If you stored JSON, parse it in the caller — not here.
 *  This function does not know or care what the string contains.
 */
const get = async (key) => {
  return await client.get(key)
}

/**
 * set(key, value, ttlSeconds)
 *
 * Stores a value in Redis under the given key.
 * The key automatically expires after ttlSeconds.
 *
 * TTL (time to live) is required — every key in this application expires.
 * Why: market data becomes stale. A key that never expires would serve
 * yesterday's price indefinitely if the worker stopped running.
 *
 * The EX option tells Redis the TTL unit is seconds.
 * Example: set('price:AAPL', '182.10', 90) expires after 90 seconds.
 *
 * Note: value must be a string.
 *  Pass numbers as-is (Redis coerces them).
 *  Pass objects as JSON.stringify(object) — not done here, done by the caller.
 */
const set = async (key, value, ttlSeconds) => {
  await client.set(key, value, 'EX', ttlSeconds)
}

/**
 * del(key)
 *
 * Deletes a key from Redis immediately, regardless of its TTL.
 * Used to force a cache refresh when data is known to be stale.
 * Not used in the current implementation but exported for future use.
 */
const del = async (key) => {
  await client.del(key)
}

module.exports = { client, get, set, del }