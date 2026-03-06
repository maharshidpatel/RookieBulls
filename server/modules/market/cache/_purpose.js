/**
 * FOLDER: /server/modules/market/cache
 *
 * Contains the Redis client connection and wrapper functions.
 * This is the only folder in the application that communicates
 * directly with Redis.
 *
 * Why Redis exists in this system:
 *  External data sources (Stooq, SEC EDGAR) are free services with
 *  no published rate limits. Without caching, every user request
 *  would trigger a direct external call. Under load this would
 *  result in IP blocks or degraded responses from those sources.
 *
 *  Redis sits between the application and external sources:
 *    User request → service.js → Redis check
 *      Cache hit  → return immediately (sub-millisecond)
 *      Cache miss → call provider → store in Redis → return
 *
 * Redis does NOT replace MongoDB:
 *  MongoDB — permanent data (users, wallets, trades, positions)
 *  Redis   — temporary market data (prices, quotes, candles, profiles)
 *
 * Redis key design:
 *  price:TICKER     → number,      TTL 90s
 *  quote:TICKER     → JSON string, TTL 90s
 *  candles:TICKER   → JSON string, TTL 1h
 *  profile:TICKER   → JSON string, TTL 24h
 *  market:holidays  → JSON string, TTL 24h
 *
 * FILES:
 *  redisClient.js
 *    Connects to Redis using REDIS_URL from env.js
 *    Exports: get(key), set(key, value, ttlSeconds), del(key)
 *    Connection is established at server startup via require in server.js
 *    Logs connection success or failure to the terminal
 */