/**
 * FOLDER: /client/src/pages
 *
 * Each file in this folder represents one full page of the application.
 * One file per page. No exceptions.
 *
 * Current pages planned:
 *  - Register.jsx    → new user registration form
 *  - Login.jsx       → returning user login form
 *  - Dashboard.jsx   → main view after login, shows portfolio summary
 *  - Market.jsx      → view available stocks and prices
 *  - Portfolio.jsx   → detailed view of user holdings and PnL
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
 *  /login      → Login.jsx
 *  /register   → Register.jsx
 *  /dashboard  → Dashboard.jsx
 */