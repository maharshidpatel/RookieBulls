# Market Module (Real Delayed Data)

## Provider Decision
Provider:   Finnhub
Free tier:  60 requests/minute
Delay:      15 minutes
Coverage:   NYSE, Nasdaq

## The Middleman Pattern

The website never calls Finnhub directly.
All price and market data flows through market/service.js.
```
Frontend / Trade Service / Portfolio Service
              │
              ▼
    market/service.js        ← the middleman
              │
              ▼
           Finnhub API
```

When Finnhub is replaced with another provider:
  - Change market/service.js internals only
  - No changes to trade/service.js
  - No changes to portfolio/service.js
  - No changes to any frontend service
  - No changes to any component

This is the same pluggable boundary established in Step 4
with hardcoded prices — now formalised as an explicit pattern.

## What Does Not Change

  Position model          — unchanged
  Trade model             — unchanged
  Wallet service          — unchanged
  Auth module             — unchanged
  Portfolio service       — getPrice() becomes async (one line change per call)

## Ticker Search — Architectural Impact
  User types into a search box (e.g. 'APP')
  → debounced request fires after 300ms of no typing
  → GET /api/market/search?q=APP
  → market/service.js calls Finnhub symbol search endpoint
  → returns [{ ticker, companyName, exchange }]
  → user selects AAPL from results
  → trade form populated with selected ticker
  → trade executes against live delayed price

## Market Hours Enforcement

Trading allowed:   Monday–Friday, 9:30am–4:00pm EST
Trading blocked:   weekends, before 9:30am, after 4:00pm EST
Holidays:          Finnhub market status endpoint handles this
                   More accurate than local calculation
                   Accounts for early closes and public holidays

Where the check lives: trade/service.js
  executeBuy and executeSell call isMarketOpen() as first step.
  Throws 403 if market is closed.
  isMarketOpen() lives in market/service.js.

Testing bypass:
  .env:  BYPASS_MARKET_HOURS=true
  market/service.js reads this flag and skips the check.
  Never set to true in production.
  Allows testing trades at any time during development.

## Environment Variables (to add)

  FINNHUB_API_KEY=<your key>
  BYPASS_MARKET_HOURS=false

## Substeps

  1  Confirm Finnhub free tier terms
         Verify public educational platform is permitted.
         Get API key. Add to .env and .env.example.

  2  market/service.js — getPrice(ticker)
         Finnhub quote endpoint.
         Returns delayed price as a number.
         Handles unknown ticker (404) and provider failure (503).
         Function becomes async — all callers add await.

  3  market/service.js — searchTickers(query)
         Calls Finnhub symbol search endpoint.
         Filters results to NYSE and Nasdaq only.
         Returns [{ ticker, companyName, exchange }].

  4  market/service.js — isMarketOpen()
         Calls Finnhub market status endpoint.
         Returns true if NYSE is currently open, false otherwise.
         Reads BYPASS_MARKET_HOURS env flag — returns true if set.

  5  Market routes and controller
         GET /api/market/price/:ticker   — single price lookup
         GET /api/market/search?q=query  — ticker search
         GET /api/market/status          — market open or closed
         No auth required — prices are public information.

  6  Trade service — enforce market hours
         Add isMarketOpen() call as first step in executeBuy and executeSell.
         Throws 403 with message: 'Market is currently closed'

  7  Frontend — ticker search component
         New component: TickerSearch.jsx
         Debounced input — 300ms wait before API call fires.
         Displays results with company name and exchange label.
         On selection: populates TradeForm with chosen ticker.
         Replaces the TICKERS dropdown entirely.

  8  Frontend — market status indicator
         Small indicator on dashboard: MARKET OPEN / MARKET CLOSED
         Shows next open time when closed.
         Disables buy and sell buttons when market is closed.

## Decisions Confirmed

  Provider:               Finnhub
  Exchanges:              NYSE and Nasdaq only
  Holiday handling:       Finnhub market status endpoint
  Testing bypass:         BYPASS_MARKET_HOURS env flag
  Middleman pattern:      market/service.js is the only Finnhub-aware file
  Ads/monetization:       Post-deployment, after traffic confirmed
  API upgrade path:       Change market/service.js only — nothing else