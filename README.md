# RookieBulls - Stock Market Simulator

A simulation-only stock trading platform for North America. Users practice 
buying and selling stocks using virtual credits in a risk-free environment. 
No real money is involved at any stage. Designed for beginners, students, 
and self-learners who want hands-on experience with stock trading concepts.

> This project is not a financial product. It does not provide financial 
> advice or access to real markets.

---

A full-stack stock trading simulator built for educational purposes.
Users receive $100,000 in virtual credits and simulate buying and selling
equities using delayed US market data. No real money. No live trading.

> Status: Active development — MVP complete, production deployment in progress.

---

## Live Demo

_Coming soon — deploying to DigitalOcean VPS with Nginx + SSL._

---

## System Architecture
```
                        ┌─────────────────────────────────┐
                        │           Cloudflare CDN         │
                        └────────────┬────────────────────┘
                                     │
              ┌──────────────────────┼─────────────────────────┐
              │                      │                          │
     ┌────────▼────────┐   ┌─────────▼──────────┐   ┌──────────▼────────┐
     │  Vercel (React) │   │  DigitalOcean VPS   │   │   GitHub Actions  │
     │  Vite Frontend  │   │  Nginx Reverse Proxy│   │   CI/CD Pipeline  │
     └────────┬────────┘   └─────────┬──────────┘   └───────────────────┘
              │                      │
              │           ┌──────────▼──────────┐
              └──────────►│  Express API Server  │
                          │  Node.js + JWT Auth  │
                          └──────┬───────┬───────┘
                                 │       │
                    ┌────────────▼┐    ┌─▼─────────────┐
                    │  MongoDB     │    │  Redis Cache   │
                    │  (Docker)    │    │  (Docker)      │
                    └─────────────┘    └────────────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  Stooq Market Data  │
                                    │  (Delayed, Polled)  │
                                    └─────────────────────┘
```

---

## Tech Stack

| Layer          | Technology                          |
|----------------|--------------------------------------|
| Frontend       | React, Vite, Custom CSS Design System |
| Backend        | Node.js, Express                     |
| Database       | MongoDB (self-hosted, Docker)        |
| Cache          | Redis (Docker)                       |
| Auth           | JWT — access + refresh token rotation |
| Market Data    | Stooq delayed feed                   |
| Reverse Proxy  | Nginx                                |
| SSL            | Let's Encrypt (Certbot)              |
| Containerization | Docker Compose                    |
| Hosting        | DigitalOcean VPS                     |
| Frontend Deploy | Vercel                              |
| DNS / CDN      | Cloudflare                           |
| CI/CD          | GitHub Actions (in progress)         |

---

## Key Features

### Authentication
- JWT access + refresh token rotation
- Refresh tokens stored in HTTP-only cookies
- Token invalidation on logout and rotation on every refresh

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
- 6 pages: Dashboard, Portfolio, Holdings, Trade History, Ticker Search, Profile
- Candlestick chart — custom SVG renderer using OHLC data
- Trade panels and confirmation modals
- Live price polling via interval-based fetch

---

## Module Structure
```
backend/
  src/
    modules/
      auth/         routes → controller → service → model → validators
      wallet/       routes → controller → service → model → validators
      trade/        routes → controller → service → model → validators
      portfolio/    routes → controller → service → model → validators
      market/       routes → controller → service → model → validators
    middleware/
    config/
    utils/

frontend/
  src/
    pages/
    components/
    services/       (API call layer)
    styles/         (design tokens, global CSS)
```

Each module follows a strict layering contract:
- Controller handles HTTP only — no business logic
- Service handles business logic only — no HTTP, no direct DB access
- Model handles data access only

---

## Data Models
```js
User:     { _id, email, passwordHash, role, createdAt }
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
  mongo-express  # DB admin UI (internal only)
  redis          # Cache layer
  nginx          # Reverse proxy + SSL termination
```

---

## Roadmap

- [x] Auth system (JWT, refresh rotation)
- [x] Virtual wallet and transaction ledger
- [x] Trade simulation engine
- [x] Market data pipeline with Redis caching
- [x] Portfolio PnL service
- [x] Frontend redesign and candlestick chart
- [ ] Account and profile management
- [ ] VPS deployment (Docker, Nginx, SSL)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Educational content framework
- [ ] Admin tools and moderation
- [ ] Ad-based credit reward system

---

## Local Development
```bash
# Clone
git clone https://github.com/yourhandle/rookiebulls.git

# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev

# Docker (MongoDB + Redis)
docker compose up -d

---

## Target Audience

North American users: beginners, students, and aspiring traders who want 
practical experience with equity trading concepts without financial risk.