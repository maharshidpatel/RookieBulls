# RookieBulls — Architecture

## Overview

RookieBulls is a stock trading simulator. Users register, fund a virtual wallet, and trade US equities at real delayed prices. The server maintains a live Redis price cache backed by Stooq; the frontend reads from that cache on every request.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Frontend | React + Vite |
| Database | MongoDB (Mongoose) |
| Cache | Redis |
| Price data | Stooq (15-min delayed, free, no API key required) |
| Company profiles | SEC EDGAR (free, no API key required) |
| Holiday calendar | date.nager.at (free, cached 24h in Redis) |

---

## Server Module Structure

```
server/
  config/
    env.js            — loads + validates all environment variables
    db.js             — MongoDB connection
  middleware/
    auth.js           — JWT verification (authenticate middleware)
  modules/
    auth/             — register, login, token refresh
    wallet/           — virtual credits balance
    trade/            — buy and sell execution
    portfolio/        — positions enriched with live prices and PnL
    position/         — Position model and mutations (no HTTP routes)
    market/
      cache/          — Redis client
      data/           — tickers.json (in-memory search dataset)
      providers/
        stooqProvider.js  — Stooq batch price + candle history fetches
        secProvider.js    — SEC EDGAR company profile lookup
      utils/
        marketHours.js    — isMarketOpen(), isTradingDay(), TTL helpers
        tickerSearch.js   — in-memory ticker symbol search
      workers/
        priceUpdater.js   — background job: 3 jobs, 60s interval
      controller.js, service.js, routes.js, model.js, validators.js
    education/        — reserved, not yet active
    user/             — reserved, not yet active
```

Each module follows the same internal structure: routes → validators → controller → service → model. No layer skips another.

---

## Redis Key Reference

| Key | Value type | Value | TTL | Primary writer |
|---|---|---|---|---|
| `price:TICKER` | number | current delayed price | 90s during hours / nextOpen after close | regular tick, closing job |
| `quote:TICKER` | JSON object | `{ price, change, changePercent, high, low, open, prevClose, timestamp }` | 90s during hours / nextOpen after close | regular tick, closing job |
| `prevClose:TICKER` | number | yesterday's closing price — day change baseline | until next 9:45 AM | opening job |
| `closingPrice:TICKER` | number | today's confirmed closing price — displayed as "Prev Close" on QuotePage | nextOpen + 6.5h | closing job |
| `candles:TICKER` | JSON array | 90-day daily OHLCV history | until next 9:45 AM | resolveQuote() |
| `profile:TICKER` | JSON object | company name, exchange, industry, description | until next 9:45 AM | getStockProfile() |
| `watched:tickers` | Redis set | tickers visited on QuotePage this session | until next 9:45 AM | resolveQuote() (trackWatched=true) |
| `market:opening:done` | string `"1"` | flag: opening job already ran today | until next 9:45 AM | opening job |
| `market:closing:done` | string `"1"` | flag: closing job already ran today | until next 9:45 AM | closing job |
| `market:holidays:YEAR` | JSON array | US federal holiday date strings | 24h | getHolidays() |

**Key ownership rule:** `prevClose:TICKER` and `closingPrice:TICKER` are owned by the updater jobs. `resolveQuote()` bootstraps them only when cold (first-ever visit or cold start), and only if the key does not already exist.

---

## Stooq Call Budget

```
Opening job:         0 calls/day   (pure Redis key copy — no Stooq)
Regular ticks:     390 calls/day   (1 batch request/min × 390 market minutes)
Closing job:         1 call/day    (one final batch at 4:16 PM)
─────────────────────────────────
Total:             391 calls/day   regardless of how many tickers are tracked
```

All held and watched tickers are batched into a single Stooq request per tick. The ticker count does not affect call volume — only tick frequency does.

---

## Market Hours (ET, adjusted for Stooq 15-min delay)

| Event | Time ET |
|---|---|
| Market open (trading allowed) | 9:45 AM |
| Market close (trading blocked) | 4:15 PM |
| Closing batch fires | 4:16 PM |
| Early close — Black Friday, Christmas Eve | 1:15 PM |

**Development bypass:** `isMarketOpen()` always returns `true` when `NODE_ENV !== 'production'`. No separate env flag.

**Holiday check:** fetched from date.nager.at once per year, cached 24h in Redis under `market:holidays:YEAR`. On fetch failure, `isTradingDay()` fails open (returns true) to avoid missing legitimate trades.

---

## Startup Sequence

```
1. config/env.js          load and validate all environment variables
2. redisClient.js         connect to Redis (required before any cache reads)
3. connectDB()            connect to MongoDB
4. startPriceUpdater()    first tick runs immediately, then every 60s
5. app.listen()           HTTP server starts accepting requests
```

MongoDB must be connected before the price updater starts because its first action is `Position.distinct('ticker')`.

---

## Request Middleware Order

Every incoming request passes through middleware in this order:

```
helmet()         security headers
cors()           origin check (CLIENT_ORIGIN env var)
morgan()         request logging (dev format)
express.json()   JSON body parsing
routes           matched route handler
404 handler      catches unmatched routes
error handler    catches all thrown errors (reads err.statusCode)
```
