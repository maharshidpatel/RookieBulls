# RookieBulls — API Contracts

All endpoints are prefixed with `/api` except `/health`.
All error responses follow: `{ status: 'error', message: string }` (production) or `{ status: 'error', message: <actual error> }` (development).
Validation errors return: `{ success: false, errors: [{ field, message }] }`.

---

## Authentication

Endpoints marked **🔒 Auth required** expect the header:
```
Authorization: Bearer <accessToken>
```
The `authenticate` middleware verifies the JWT and sets `req.user.sub` to the user's `_id`.

---

## Auth

### POST /api/auth/register

Creates a new user account and initialises a wallet with the default credit balance.

**Request body**
```json
{ "email": "user@example.com", "password": "password123" }
```

**201 Created**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": { "_id": "...", "email": "user@example.com" }
  }
}
```

**Errors**
| Status | Condition |
|---|---|
| 409 | Email already registered |
| 422 | Missing or invalid email / password |

---

### POST /api/auth/login

Authenticates an existing user. Returns a short-lived access token and a longer-lived refresh token.

**Request body**
```json
{ "email": "user@example.com", "password": "password123" }
```

**200 OK**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "user": { "_id": "...", "email": "user@example.com" }
  }
}
```

**Errors**
| Status | Condition |
|---|---|
| 401 | Email not found or password incorrect |
| 422 | Missing fields |

---

### POST /api/auth/refresh

Issues a new access token using a valid refresh token. Called automatically by the frontend axios interceptor on 401 responses. The refresh token is not rotated at MVP.

**Request body**
```json
{ "refreshToken": "<jwt>" }
```

**200 OK**
```json
{
  "success": true,
  "data": { "accessToken": "<jwt>" }
}
```

**Errors**
| Status | Condition |
|---|---|
| 401 | Missing, expired, or invalid refresh token |

---

## Wallet

### GET /api/wallet/me 🔒

Returns the authenticated user's wallet including balance and full transaction history.

**200 OK**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "_id": "...",
      "userId": "...",
      "balance": 95000.00,
      "transactions": [
        {
          "type": "debit",
          "amount": 877.50,
          "reason": "trade_buy",
          "referenceId": "<tradeId>",
          "createdAt": "2026-03-16T14:00:00.000Z"
        }
      ]
    }
  }
}
```

---

## Trade

### POST /api/trade/buy 🔒

Executes a simulated market buy order at the current delayed price.

**Request body**
```json
{ "ticker": "AAPL", "quantity": 5 }
```

**201 Created**
```json
{
  "success": true,
  "message": "Buy order executed",
  "data": {
    "trade": {
      "_id": "...",
      "userId": "...",
      "ticker": "AAPL",
      "action": "buy",
      "quantity": 5,
      "priceAtExecution": 175.50,
      "createdAt": "2026-03-16T14:00:00.000Z"
    }
  }
}
```

**Errors**
| Status | Condition |
|---|---|
| 400 | Insufficient credits |
| 403 | Market is currently closed |
| 404 | Ticker not found / insufficient Stooq data |
| 422 | Missing or invalid ticker / quantity |

---

### POST /api/trade/sell 🔒

Executes a simulated market sell order at the current delayed price.

**Request body**
```json
{ "ticker": "AAPL", "quantity": 3 }
```

**200 OK**
```json
{
  "success": true,
  "message": "Sell order executed",
  "data": {
    "trade": {
      "_id": "...",
      "userId": "...",
      "ticker": "AAPL",
      "action": "sell",
      "quantity": 3,
      "priceAtExecution": 178.20,
      "createdAt": "2026-03-16T15:00:00.000Z"
    }
  }
}
```

**Errors**
| Status | Condition |
|---|---|
| 400 | No position held for this ticker |
| 400 | Insufficient shares (own fewer than requested) |
| 403 | Market is currently closed |
| 404 | Ticker not found |
| 422 | Missing or invalid ticker / quantity |

---

### GET /api/trade/history 🔒

Returns all trades for the authenticated user, sorted newest first.

**200 OK**
```json
{
  "success": true,
  "data": {
    "trades": [
      {
        "_id": "...",
        "ticker": "AAPL",
        "action": "sell",
        "quantity": 3,
        "priceAtExecution": 178.20,
        "createdAt": "2026-03-16T15:00:00.000Z"
      }
    ]
  }
}
```

Returns `trades: []` if the user has made no trades.

---

## Portfolio

### GET /api/portfolio/me 🔒

Returns the authenticated user's open positions enriched with live prices, PnL, and day change.

**200 OK**
```json
{
  "success": true,
  "data": {
    "portfolio": {
      "positions": [
        {
          "ticker": "AAPL",
          "quantity": 5,
          "avgBuyPrice": 175.50,
          "currentPrice": 178.20,
          "costBasis": 877.50,
          "marketValue": 891.00,
          "pnl": 13.50,
          "pnlPercent": 1.54,
          "dayChange": 13.50,
          "dayChangePercent": 1.54
        }
      ],
      "summary": {
        "totalCostBasis": 877.50,
        "totalMarketValue": 891.00,
        "totalPnl": 13.50,
        "totalPnlPercent": 1.54,
        "totalDayChange": 13.50
      }
    }
  }
}
```

Returns `positions: []` and all summary values as `0` if the user holds no positions.

**dayChange baseline logic:**
- Position touched today (bought or added today) → uses `avgBuyPrice` as baseline
- Position held from a previous day → uses `prevClose:TICKER` from Redis
- `prevClose:TICKER` cold (new ticker, first day) → falls back to `avgBuyPrice`

---

## Market (no auth required)

### GET /api/market/price/:ticker

Returns the current delayed price as a single number. Used internally by the trade engine.

**200 OK**
```json
{ "ticker": "AAPL", "price": 178.20 }
```

**Errors:** 404 if ticker not found or insufficient Stooq data.

---

### GET /api/market/search?q=query

In-memory search against the tickers dataset. Sub-millisecond, no external API call.

**200 OK**
```json
{
  "results": [
    { "ticker": "AAPL", "companyName": "Apple Inc.", "exchange": "NASDAQ" },
    { "ticker": "AAPL-W", "companyName": "Apple Warrant", "exchange": "NYSE" }
  ]
}
```

Returns up to 10 results. Returns `results: []` on no match.

**Errors:** 400 if `q` is missing or empty.

---

### GET /api/market/status

Returns whether the US market is currently open for trading.

**200 OK**
```json
{ "isOpen": true, "message": "Market is open" }
```
or
```json
{ "isOpen": false, "message": "Market is closed" }
```

---

### GET /api/market/quote/:ticker

Returns the full quote object for a ticker. Adds the ticker to `watched:tickers` in Redis so the price updater keeps it warm.

**200 OK**
```json
{
  "ticker": "AAPL",
  "price": 178.20,
  "change": 2.70,
  "changePercent": 1.54,
  "high": 179.50,
  "low": 175.30,
  "open": 175.80,
  "prevClose": 175.50,
  "timestamp": "2026-03-16T14:30:00.000Z"
}
```

`change` and `changePercent` are `null` if `prevClose:TICKER` was cold when the quote was last written (resolved to accurate values on QuotePage visit via candles fetch).

**Errors:** 404 if ticker not found or insufficient Stooq data.

---

### GET /api/market/profile/:ticker

Returns company profile from SEC EDGAR. Cached until next market open.

**200 OK**
```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "exchange": "NASDAQ",
  "industry": "Electronic Computers",
  "description": "..."
}
```

**Errors:** 404 if ticker not found in SEC EDGAR.

---

### GET /api/market/candles/:ticker

Returns up to 90 days of daily OHLCV candle data from Stooq. Cached until next market open. The frontend slices this array client-side for different chart ranges (1D, 5D, 1M, 3M).

**200 OK**
```json
{
  "candles": [
    { "date": "2026-01-02", "open": 150.00, "high": 155.00, "low": 149.50, "close": 153.20, "volume": 82000000 }
  ]
}
```

**Errors:** 404 if ticker not found or insufficient history.

---

## Health

### GET /health

**200 OK**
```json
{ "status": "ok", "environment": "development", "timestamp": "2026-03-16T14:00:00.000Z" }
```
