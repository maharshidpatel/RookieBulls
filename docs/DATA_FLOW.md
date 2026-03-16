# RookieBulls — Data Flow

Covers the three areas that involve the most moving parts: the price updater background jobs, the `resolveQuote()` cache resolution paths, and the portfolio read path.

---

## 1. priceUpdater Jobs

`priceUpdater.js` runs a single `setInterval` (60s). On every tick, `runUpdate()` fires and decides which of three jobs to execute based on market state.

### Job 1 — Opening Job

**When:** First tick after 9:45 AM on a trading day
**Gate:** `market:opening:done` Redis flag (expires at next 9:45 AM)
**Stooq calls:** 0 — pure Redis key copy

```
for each held + watched ticker:
  read  closingPrice:TICKER   (written yesterday at 4:16 PM)
  write prevClose:TICKER      (TTL = secondsUntilNextMarketOpen)

set market:opening:done = "1"  (TTL = secondsUntilNextMarketOpen)
```

`prevClose:TICKER` becomes the day change baseline for all positions. If `closingPrice:TICKER` is cold for a ticker (new ticker, never seen a closing job), `prevClose:TICKER` stays cold — `resolveQuote()` bootstraps it on first QuotePage visit.

---

### Job 2 — Regular Tick

**When:** Every 60s while market is open (9:45 AM – 4:15 PM)
**Stooq calls:** 1 batch request for all held + watched tickers

```
allTickers = union(Position.distinct('ticker'), smembers('watched:tickers'))

priceMap = stooq.getPriceBatch(allTickers)   ← 1 Stooq call

for each ticker in allTickers:
  write price:TICKER          (TTL = 90s)
  read  prevClose:TICKER      (set by opening job)
  compute change, changePercent  (null if prevClose cold)
  write quote:TICKER          (TTL = 90s)
    shape: { price, change, changePercent, high, low, open, prevClose, timestamp }
```

`change` and `changePercent` are `null` in the quote object when `prevClose:TICKER` is cold. `resolveQuote()` Path B fixes this on first QuotePage visit.

---

### Job 3 — Closing Job

**When:** First tick after 4:16 PM on a trading day
**Gate:** `market:closing:done` Redis flag (expires at next 9:45 AM)
**Stooq calls:** 1 final batch request

```
allTickers = union(Position.distinct('ticker'), smembers('watched:tickers'))

priceMap = stooq.getPriceBatch(allTickers)   ← 1 Stooq call (final prices)

for each ticker:
  read  prevClose:TICKER      (this morning's open = yesterday's close)
  write closingPrice:TICKER   (TTL = nextOpen + 6.5h)
    value = today's final price
    becomes tomorrow's prevClose when opening job runs
  compute change, changePercent vs prevClose
  write quote:TICKER          (TTL = nextOpen — survives overnight)
  write price:TICKER          (TTL = nextOpen — portfolio reads this after close)

set market:closing:done = "1"  (TTL = secondsUntilNextMarketOpen)
```

After the closing job, portfolio and QuotePage requests are served entirely from Redis all night with zero Stooq calls.

---

## 2. resolveQuote() Paths

`market/service.js → resolveQuote(ticker, trackWatched)` is the single entry point for full quote objects. It has three paths based on cache state.

### Path A — Cache hit, change is not null

**Stooq calls:** 0
**Condition:** `quote:TICKER` exists in Redis and `change !== null`
**Typical case:** Day 2 onward for any held or watched ticker during market hours

```
read quote:TICKER from Redis
return { ticker, ...parsed }
```

---

### Path B — Cache hit, change is null

**Stooq calls:** 1 (history call)
**Condition:** `quote:TICKER` exists but `change === null`
**Cause:** Updater wrote the quote while `prevClose:TICKER` was cold (new ticker on first trading day)
**Runs at most once per ticker per session** (after fix, Path A handles all subsequent requests)

```
read quote:TICKER from Redis  →  change === null
fetch stooq.getHistorical(ticker)   ← 1 Stooq call

prevClose    = candles[secondToLast].close
closingPrice = candles[last].close  (if market closed)
             = candles[secondToLast].close  (if market open — yesterday's close)

recompute change, changePercent
rewrite quote:TICKER  (with corrected change values)
write   candles:TICKER

if prevClose:TICKER cold:
  write prevClose:TICKER   (bootstrap — opening job owns this, do not overwrite)
if closingPrice:TICKER cold:
  write closingPrice:TICKER (bootstrap — closing job owns this, do not overwrite)

if marketOpen and trackWatched:
  sadd watched:tickers ticker

return { ticker, ...updatedQuote }
```

---

### Path C — Cache miss (brand new ticker)

**Stooq calls:** 1 (history call)
**Condition:** `quote:TICKER` does not exist in Redis
**Typical case:** First ever visit to a ticker's QuotePage

```
fetch stooq.getHistorical(ticker)   ← 1 Stooq call

last         = candles[last]
prevClose    = candles[secondToLast].close
closingPrice = last.close  (if market closed)
             = candles[secondToLast].close  (if market open)

build quote object from candles
write quote:TICKER
write price:TICKER
write candles:TICKER

if prevClose:TICKER cold:    write prevClose:TICKER
if closingPrice:TICKER cold: write closingPrice:TICKER

if marketOpen and trackWatched:
  sadd watched:tickers ticker

return { ticker, ...quote }
```

After Path C, the ticker is in `watched:tickers`. The regular tick picks it up within 60 seconds, keeping it warm for the rest of the session.

---

## 3. Portfolio Read Path

`portfolio/service.js → getPortfolio(userId)` enriches every open position with a live price and day change. It reads directly from Redis — no quote object, no Stooq calls in normal operation.

```
positions = Position.find({ userId })

for each position:

  ── Price resolution ──────────────────────────────────────────

  1. read price:TICKER from Redis
       warm during hours (90s TTL, updated every 60s)
       warm after close  (nextOpen TTL, written by closing job)

  2. if cold: read closingPrice:TICKER
       fallback for the gap between server restart and first updater tick

  3. if still cold: resolveQuote(ticker, trackWatched=false)
       absolute last resort — triggers 1 history call
       bootstraps all Redis keys
       trackWatched=false — held ticker is already in Position.distinct()

  ── Day change baseline ────────────────────────────────────────

  if position.updatedAt >= today's 9:45 AM:
    baseline = avgBuyPrice        (position touched today)
  else if prevClose:TICKER warm:
    baseline = prevClose:TICKER   (standard overnight change)
  else:
    baseline = avgBuyPrice        (prevClose cold — graceful degradation)

  ── Calculations ───────────────────────────────────────────────

  costBasis   = avgBuyPrice × quantity
  marketValue = currentPrice × quantity
  pnl         = marketValue − costBasis
  pnlPercent  = pnl / costBasis × 100
  dayChange   = (currentPrice − baseline) × quantity
  dayChangePercent = (currentPrice − baseline) / baseline × 100
```

**Normal case (day 2+):** Both `price:TICKER` and `prevClose:TICKER` are warm. Zero Stooq calls. Pure Redis reads for all positions, computed in `Promise.all`.

**Cold start / first day:** One `resolveQuote()` call per cold ticker. After that call, all subsequent portfolio loads are cache hits.
