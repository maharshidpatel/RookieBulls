/**
 * FOLDER: /client/src/services
 *
 * Functions that communicate with the Express backend API.
 * All HTTP requests live here — nowhere else in the frontend.
 *
 * Why centralize API calls here:
 *  Without a services layer, API calls are scattered across components:
 *    axios.post('http://localhost:5000/api/auth/login', data)  ← in Login.jsx
 *    axios.post('http://localhost:5000/api/auth/login', data)  ← in another file
 *
 *  If the URL changes, you update it in every file that used it.
 *  If you need to add an auth header, you add it everywhere.
 *
 *  With a services layer:
 *    authService.login(data)  ← in Login.jsx
 *  The actual URL and headers are defined once in authService.js.
 *  Changes happen in one place.
 *
 * Files planned:
 *  - authService.js      → register, login, logout, refresh token
 *  - tradeService.js     → buy, sell
 *  - portfolioService.js → fetch holdings, PnL
 *  - marketService.js    → fetch stock prices
 *  - walletService.js    → fetch balance, transaction history
 *
 * Rule:
 *  No component or page imports axios directly.
 *  All API communication goes through a service function.
 */