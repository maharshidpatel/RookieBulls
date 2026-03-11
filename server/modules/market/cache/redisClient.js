/**
 * market/cache/redisClient.js — Redis Connection and Cache Wrappers
 *
 * Responsibility:
 *  Connects to Redis and exports simple wrapper functions.
 *  All Redis operations in this application go through this file.
 *
 * Exported functions:
 *  get(key)                    — fetch a string value
 *  set(key, value, ttl)        — store with expiry in seconds
 *  del(key)                    — delete immediately
 *  sadd(key, ...members)       — add members to a Redis set
 *  smembers(key)               — get all members of a Redis set
 *  expireat(key, ttlSeconds)   — set TTL on an existing key
 */

const Redis = require('ioredis')
const { env } = require('../../../config/env')

const client = new Redis(env.REDIS_URL, {
  connectTimeout:      5000,
  maxRetriesPerRequest: 3,
})

client.on('connect', () => {
  console.log('Redis connected:', env.REDIS_URL)
})

client.on('error', (err) => {
  console.error('Redis connection error:', err.message)
})

// ── Cache wrapper functions ───────────────────────────────────────────────

/**
 * get(key)
 * Returns cached string or null on miss/expiry.
 */
const get = async (key) => {
  return await client.get(key)
}

/**
 * set(key, value, ttlSeconds)
 * Stores value with automatic expiry.
 * Every key in this application must expire — no indefinite storage.
 */
const set = async (key, value, ttlSeconds) => {
  await client.set(key, value, 'EX', ttlSeconds)
}

/**
 * del(key)
 * Deletes a key immediately regardless of TTL.
 * Used to force a cache refresh when data is known to be stale.
 */
const del = async (key) => {
  await client.del(key)
}

/**
 * sadd(key, ...members)
 * Adds one or more members to a Redis set.
 * Creates the set if it does not exist.
 *
 * Used by service.js to track watched tickers.
 * Example: sadd('watched:tickers', 'NVDA')
 */
const sadd = async (key, ...members) => {
  await client.sadd(key, ...members)
}

/**
 * smembers(key)
 * Returns all members of a Redis set as an array of strings.
 * Returns an empty array if the key does not exist.
 *
 * Used by priceUpdater.js to read the watched tickers set.
 * Example: smembers('watched:tickers') → ['NVDA', 'MSFT']
 */
const smembers = async (key) => {
  return await client.smembers(key)
}

/**
 * expireat(key, ttlSeconds)
 * Sets or updates the TTL on an existing key.
 * Uses EXPIRE (seconds from now) — not EXPIREAT (unix timestamp).
 *
 * Used to refresh the TTL on watched:tickers after each new member
 * is added — keeps the set alive until next market open.
 * Example: expireat('watched:tickers', 3600) — expires in 1 hour
 */
const expireat = async (key, ttlSeconds) => {
  await client.expire(key, ttlSeconds)
}

module.exports = { client, get, set, del, sadd, smembers, expireat }