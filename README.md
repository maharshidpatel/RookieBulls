# RookieBulls — Stock Trading Simulator & Learning Platform

A full-stack stock trading simulator built for educational purposes.
Users receive $100,000 in virtual credits and simulate buying and selling
equities using delayed North American market data. No real money. No live trading.

> This project is not a financial product. It does not provide financial
> advice or access to real markets.

> Status: Active development — live in production at rookiebulls.com

---

## Live Demo

**[rookiebulls.com](https://rookiebulls.com)**

Deployed on a DigitalOcean VPS — Docker Compose, Nginx reverse proxy,
Let's Encrypt SSL, Cloudflare DNS and CDN. CI/CD via GitHub Actions on push to main.

---

## System Architecture
```
                        ┌─────────────────────────────────┐
                        │           Cloudflare CDN        │
                        │     DNS + DDoS Protection       │
                        └────────────┬────────────────────┘
                                     │
              ┌──────────────────────┼─────────────────────────┐
              │                      │                         │
     ┌────────▼────────┐   ┌─────────▼──────────┐   ┌──────────▼────────┐
     │  React Frontend │   │  DigitalOcean VPS  │   │   GitHub Actions  │
     │  (Nginx served) │   │ Nginx Reverse Proxy│   │   CI/CD Pipeline  │
     └────────┬────────┘   └─────────┬──────────┘   └───────────────────┘
              │                      │
              │           ┌──────────▼──────────┐
              └──────────►│  Express API Server │
                          │  Node.js + JWT Auth │
                          └──────┬───────┬──────┘
                                 │       │
                    ┌────────────▼┐    ┌─▼─────────────┐
                    │  MongoDB    │    │  Redis Cache  │
                    │  (Docker)   │    │  (Docker)     │
                    └─────────────┘    └───────────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  Stooq Market Data  │
                                    │  (Delayed, Polled)  │
                                    └─────────────────────┘
```

---

## Tech Stack

| Layer            | Technology                            |
|------------------|---------------------------------------|
| Frontend         | React, Vite, Custom CSS Design System |
| Backend          | Node.js, Express                      |
| Database         | MongoDB (self-hosted, Docker)         |
| Cache            | Redis (Docker)                        |
| Auth             | JWT — access + refresh token rotation |
| Market Data      | Stooq delayed feed                    |
| Reverse Proxy    | Nginx                                 |
| SSL              | Let's Encrypt (Certbot)               |
| Containerization | Docker Compose                        |
| Hosting          | DigitalOcean VPS                      |
| Frontend Deploy  | Nginx (serves React dist/ from VPS)   |
| DNS / CDN        | Cloudflare                            |
| CI/CD            | GitHub Actions                        |

---

## Key Features

### Authentication
- JWT access + refresh token rotation
- Refresh tokens stored in HTTP-only cookies
- Token invalidation on logout and rotation on every refresh
- Email verification via crypto-generated tokens with 24hr expiry
- Hard login block until email is verified
- Rate limiting across register, login, and resend endpoints (express-rate-limit)

### Virtual Wallet
- Each user receives $100,000 in virtual credits on registration
- Full transaction ledger — every credit movement is recorded
- Wallet state is recomputed from ledger, not mutated directly

### Trade Simulation Engine
- Market buy and sell orders against delayed real prices
- Position tracking with average buy price (weighted average on partial fills)
- PnL calculated per position and across the full portfolio
- Simulated trading fees applied per transaction

### Market Data Pipeline
- Delayed equity prices sourced from Stooq
- Redis caching layer reduces external API calls by 97%
  (from ~39,000 to ~400 per day at current polling intervals)
- Cache-aside pattern: stale reads served from Redis, refreshed on TTL expiry
- Market data module is fully decoupled — replaceable without touching trade logic

### Portfolio Service
- Real-time portfolio value computed from live Redis-cached prices
- Day change and total PnL surfaced per position and at portfolio level
- Holdings, trade history, and position data served from separate endpoints

### Frontend
- Custom design system — no component library dependency
- 8 pages: Login, Register, Verify, Profile, Summary, Holdings, Trade History, Quote
- Candlestick chart — custom SVG renderer using OHLC data
- Trade panels and confirmation modals
- Live price polling via interval-based fetch
- Light/dark theme — user preference persisted via ThemeContext
- Fully responsive layout — mobile, tablet, and desktop via useBreakpoint hook

---

## Module Structure
```
backend/
├── config/
│   ├── db.js               # MongoDB connection
│   └── env.js              # Environment variable validation and export
│
├── middleware/
│   ├── auth.js             # JWT verification middleware
│   └── rateLimiter.js      # express-rate-limit — register, login, resend
│
├── modules/
│   ├── auth/               # Registration, login, token refresh, logout
│   │   ├── controller.js
│   │   ├── emailService.js # Resend API wrapper — verification emails only
│   │   ├── model.js
│   │   ├── routes.js
│   │   ├── service.js
│   │   └── validators.js
│   │
│   ├── user/               # Profile reads and account management
│   │   ├── controller.js
│   │   ├── model.js
│   │   ├── routes.js
│   │   ├── service.js
│   │   └── validators.js
│   │
│   ├── wallet/             # Virtual credit ledger and transaction history
│   │   ├── controller.js
│   │   ├── model.js
│   │   ├── routes.js
│   │   ├── service.js
│   │   └── validators.js
│   │
│   ├── trade/              # Buy/sell execution, fee simulation, order status
│   │   ├── controller.js
│   │   ├── model.js
│   │   ├── routes.js
│   │   ├── service.js
│   │   └── validators.js
│   │
│   ├── position/           # Position state and weighted average cost basis
│   │   ├── model.js
│   │   └── service.js      # No routes — consumed internally by trade module
│   │
│   ├── portfolio/          # Holdings aggregation, PnL, day change
│   │   ├── controller.js
│   │   ├── model.js
│   │   ├── routes.js
│   │   ├── service.js
│   │   └── validators.js
│   │
│   ├── market/             # Price delivery, caching, ticker search
│   │   ├── controller.js
│   │   ├── model.js
│   │   ├── routes.js
│   │   ├── service.js
│   │   ├── validators.js
│   │   │
│   │   ├── cache/
│   │   │   └── redisClient.js      # Redis connection and client export
│   │   │
│   │   ├── providers/
│   │   │   ├── stooqProvider.js    # Stooq delayed price fetcher
│   │   │   └── secProvider.js      # SEC data provider
│   │   │
│   │   ├── data/
│   │   │   ├── tickers.json        # North America ticker reference data
│   │   │   └── transformTickers.js # Normalisation logic for ticker data
│   │   │
│   │   ├── utils/
│   │   │   ├── marketHours.js      # Exchange hours and open/closed state
│   │   │   └── tickerSearch.js     # Ticker lookup and filtering logic
│   │   │
│   │   └── workers/
│   │       └── priceUpdater.js     # Background worker — polling and cache writes
│   │
│   └── education/          # Educational content framework (scaffold only — in progress)
│       ├── controller.js
│       ├── model.js
│       ├── routes.js
│       ├── service.js
│       └── validators.js
│
├── utils/                  # Shared utilities (reserved for future helpers)
│
└── server.js               # App entry point — Express init, middleware, route mounting
```

### Layering Contract

| Layer         | Responsibility                        | Rule                        |
|---------------|---------------------------------------|-----------------------------|
| routes.js     | Path and method registration          | No logic                    |
| controller.js | HTTP request and response handling    | No business logic           |
| service.js    | Business logic and orchestration      | No HTTP, no direct DB calls |
| model.js      | Database schema and data access       | No logic outside queries    |
| validators.js | Input shape and constraint validation | No side effects             |

The `position` module has no routes or controller by design — it is an internal service
consumed directly by the trade module, not exposed as a public endpoint.

---

## Frontend Structure
```
frontend/
└── src/
    ├── main.jsx                    # React entry point
    ├── App.jsx                     # Route definitions and layout wrapper
    │
    ├── assets/
    │   └── react.svg
    │
    ├── pages/
    │   ├── LoginPage.jsx               # Two-column layout with branding panel
    │   ├── RegisterPage.jsx            # Two-column layout, firstName/lastName, email verify flow
    │   ├── VerifyPage.jsx              # Email verification — loading/success/expired/invalid states
    │   ├── ProfilePage.jsx             # Personal info, country dropdown, bio, change password
    │   ├── SummaryPage.jsx             # PnL summary and account snapshot
    │   ├── HoldingsPage.jsx            # Open positions with live PnL
    │   ├── HistoryPage.jsx             # Completed trade log
    │   └── QuotePage.jsx               # Ticker detail and trade entry
    │
    ├── components/
    │   ├── TickerSearch.jsx            # Typeahead ticker lookup
    │   ├── ProtectedRoute.jsx          # Auth guard for private routes
    │   │
    │   ├── layout/
    │   │   ├── Layout.jsx              # Page shell — nav + outlet
    │   │   ├── TopNav.jsx              # Primary navigation bar
    │   │   └── SecondNav.jsx           # Contextual sub-navigation
    │   │
    │   └── modals/
    │       ├── TradePanel.jsx          # Slide-in trade entry panel
    │       ├── GetQuotePopup.jsx       # Quick price lookup modal
    │       ├── ExecutionConfirmation.jsx  # Pre-submit order review
    │       └── OrderConfirmation.jsx   # Post-execution result display
    │
    ├── context/
    │   ├── AuthContext.jsx         # Global auth state — user, token, login, logout, updateUser
    │   └── ThemeContext.jsx        # Theme state — light/dark mode
    │
    ├── hooks/
    │   └── useBreakpoint.js        # Responsive breakpoint detection
    │
    ├── data/
    │   └── countries.js            # ISO 3166-1 alpha-2 country list — profile dropdown
    │
    ├── services/                   # All API calls — one file per domain
    │   ├── axiosInstance.js        # Axios config — base URL, interceptors, token refresh
    │   ├── auth.js                 # register, login, resendVerification, verifyEmail
    │   ├── user.js                 # getProfile, updateProfile, changePassword
    │   ├── market.js
    │   ├── portfolio.js
    │   ├── trade.js
    │   ├── wallet.js
    │   └── history.js
    │
    ├── styles/
    │   ├── global.css              # Reset, CSS custom properties, base typography
    │   ├── theme.js                # Design tokens exported as JS constants
    │   └── tableStyles.js          # Shared table style definitions
    │
    └── utils/
        └── inactivityTimer.js      # Auto-logout on user inactivity
```

### Frontend Architecture Notes

- No component library — all UI built against a custom design system using CSS custom properties
- `services/` layer is the only point of contact with the backend API — no fetch calls outside this folder
- `axiosInstance.js` handles token refresh automatically via a response interceptor — pages and services never manage token state directly
- `context/AuthContext.jsx` is the single source of truth for authentication state across the app
- `ThemeContext.jsx` manages light/dark mode — decoupled from auth state
- `hooks/useBreakpoint.js` centralises responsive logic — components query breakpoint state rather than writing media queries inline
- Modal components are fully decoupled from pages — they receive props and emit callbacks only

---

## Data Models
```js
User:     { _id, email, passwordHash, role, firstName, lastName,
            isVerified, verificationToken, verificationExpiry,
            displayName, country, phone, bio, createdAt }
Wallet:   { _id, userId, balance, transactions[] }
Position: { _id, userId, ticker, quantity, avgBuyPrice, openedAt }
Trade:    { _id, userId, ticker, action, quantity, priceAtExecution,
            feesSimulated, timestamp, status }
```

---

## Infrastructure

All backend services run in Docker Compose on a single DigitalOcean VPS:
```yaml
services:
  api            # Express server
  mongo          # MongoDB
  mongo-express  # DB admin UI (internal only, SSH tunnel only)
  redis          # Cache layer
  nginx          # Reverse proxy + SSL termination + static file server
```

- Node server bound to `127.0.0.1` only — not reachable from internet even if firewall fails
- Zero ports exposed publicly — all traffic routed through Nginx
- Secrets injected at runtime via `env_file`, never baked into Docker image
- Mongo Express accessible via SSH tunnel only
- Cloudflare DNS with proxied A records — DDoS protection and CDN caching at the edge

---

## Roadmap

- [x] Auth system (JWT, refresh rotation)
- [x] Virtual wallet and transaction ledger
- [x] Trade simulation engine
- [x] Market data pipeline with Redis caching
- [x] Portfolio PnL service
- [x] Frontend redesign and candlestick chart
- [x] Account and profile management
- [x] Dark theme and mobile responsiveness
- [x] VPS deployment (Docker, Nginx, SSL)
- [x] CI/CD pipeline (GitHub Actions)
- [x] DNS, Cloudflare, domain setup
- [ ] Educational content framework
- [ ] Admin tools and moderation
- [ ] Ad-based credit reward system

---

## Local Development
```bash
# Clone
git clone https://github.com/maharshidpatel/RookieBulls.git

# Backend
cd server
cp .env.example .env
npm install
npm run dev

# Frontend
cd client
npm install
npm run dev

# Docker (MongoDB + Redis)
docker compose up -d mongo redis
```

---

## Target Audience

North American users: beginners, students, and aspiring traders who want
practical experience with equity trading concepts without financial risk.

---

## Disclaimer

RookieBulls is an educational simulation platform only.
No real money is involved. Market data is delayed and used for
learning purposes only. This platform does not constitute financial advice.
