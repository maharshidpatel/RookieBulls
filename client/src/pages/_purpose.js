/**
 * FOLDER: /client/src/pages
 *
 * Each file in this folder represents one full page of the application.
 * One file per page. No exceptions.
 *
 * Current pages:
 *  - RegisterPage.jsx  → new user registration form
 *  - LoginPage.jsx     → returning user login form
 *  - SummaryPage.jsx   → main view after login, shows portfolio summary
 *  - HoldingsPage.jsx  → detailed view of user holdings and PnL
 *  - HistoryPage.jsx   → trade history log
 *  - QuotePage.jsx     → stock price chart and company profile
 *
 * What a page does:
 *  - Composes components together into a full layout
 *  - Calls service functions to fetch or send data
 *  - Manages page-level state
 *
 * What a page does NOT do:
 *  - Contain reusable UI logic (goes in components/)
 *  - Make direct API calls inline (goes in services/)
 *  - Manage global state like logged-in user (goes in context/)
 *
 * React Router maps each URL path to one page component:
 *  /login      → LoginPage.jsx
 *  /register   → RegisterPage.jsx
 *  /summary    → SummaryPage.jsx
 *  /holdings   → HoldingsPage.jsx
 *  /history    → HistoryPage.jsx
 *  /quote/:ticker → QuotePage.jsx
 */