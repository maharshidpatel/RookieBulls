# Market Module

Documents the architecture decisions made during Step 5 (real market data integration).

---

## Provider Decision

| | |
|---|---|
| Provider | Stooq |
| Cost | Free — no API key required |
| Delay | 15 minutes |
| Coverage | NYSE, Nasdaq (and others — filtered to US common stocks via tickers.json) |
| Rate limit | None published — 391 calls/day well within observed free-tier behavior |

Stooq was chosen over Finnhub to avoid API key management and the 60 req/min free-tier ceiling. Stooq is accessed via CSV endpoint — no SDK, no auth header.

---

## The Middleman Pattern

The app never calls Stooq directly from trade or portfolio code. All price and market data flows through `market/service.js`.

```
Frontend / Trade Service / Portfolio Service
              │
              ▼
    market/service.js        ← the only Stooq-aware file
              │
              ├── stooqProvider.js   (HTTP + CSV parsing)
              └── secProvider.js     (SEC EDGAR HTTP)
```

When the provider changes:
- Change `stooqProvider.js` internals only
- `trade/service.js` — no changes
- `portfolio/service.js` — no changes
- Any frontend service — no changes
- Any component — no changes

---

## Two-Key Redis Strategy

Price data for each ticker is stored across two separate Redis keys:

| Key | Value | Purpose |
|---|---|---|
| `prevClose:TICKER` | yesterday's closing price | day change baseline (written once at 9:45 AM) |
| `closingPrice:TICKER` | today's closing price | "Prev Close" display on QuotePage (written once at 4:16 PM) |

These are separate from `price:TICKER` (the live delayed price, 90s TTL) and `quote:TICKER` (the full quote object, 90s TTL).

The `quote:TICKER` object does **not** include `prevClose` as a field. `prevClose:TICKER` lives in its own Redis key and is read directly by `portfolio/service.js`.

---

## Ticker Search

```
User types "APP"
→ debounced 300ms
→ GET /api/market/search?q=APP
→ market/service.js → tickerSearch.js
→ in-memory filter of tickers.json (loaded at module load time)
→ returns [{ ticker, companyName, exchange }] — max 10 results
→ zero external API calls — sub-millisecond response
```

`tickers.json` is a filtered list of US-listed common stocks built from SEC EDGAR data via `data/transformTickers.js`. No live API is involved in search.

---

## Market Hours Enforcement

```
Trading allowed:   Monday–Friday, 9:45 AM – 4:15 PM ET
Trading blocked:   weekends, federal holidays, before 9:45 AM, after 4:15 PM ET
Early closes:      Black Friday and Christmas Eve (if weekday) — 1:15 PM ET
```

**Where the check lives:** `trade/service.js`
`executeBuy` and `executeSell` call `isMarketOpen()` as their first step. Throws 403 if closed. No price lookup, no wallet debit, nothing else happens.

**Holiday source:** `date.nager.at` — fetched once per year, cached 24h in Redis under `market:holidays:YEAR`. On fetch failure, `isTradingDay()` fails open (returns true) rather than blocking legitimate trades.

**Development bypass:** `isMarketOpen()` returns `true` when `NODE_ENV !== 'production'`. No separate env flag needed.

---

## Background Price Updater

Three distinct jobs run via a single 60s `setInterval`. See `DATA_FLOW.md` for the full job breakdown.

```
Opening job   — 9:45 AM  — copies closingPrice → prevClose for all tickers (0 Stooq calls)
Regular tick  — every 60s — fetches live prices for all held + watched tickers (1 Stooq batch)
Closing job   — 4:16 PM  — captures final prices, writes overnight cache (1 Stooq batch)
```

**Daily Stooq call budget: 391 calls/day** — fixed regardless of ticker count.

---

## What Did Not Change from MVP

| Component | Status |
|---|---|
| Position model | Unchanged |
| Trade model | Unchanged |
| Wallet service | Unchanged |
| Auth module | Unchanged |
| Portfolio service | `getPrice()` became async — one-line change per call site |
