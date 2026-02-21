/**
 * FOLDER: /client/src/components
 *
 * Reusable UI building blocks used across multiple pages.
 * A component is a self-contained piece of UI with its own
 * logic and appearance.
 *
 * Examples for Rookie Bulls:
 *  - Navbar.jsx       → navigation bar shown on all pages
 *  - StockCard.jsx    → displays one stock with price and action buttons
 *  - TradeForm.jsx    → buy/sell input form
 *  - PortfolioRow.jsx → one row in the portfolio table
 *  - Button.jsx       → styled button used throughout the app
 *  - LoadingSpinner   → shown while waiting for API responses
 *
 * Rule for deciding if something is a component:
 *  If it appears on more than one page, it is a component.
 *  If it is complex enough to have its own logic, it is a component.
 *  If it is a simple one-off element used in one place only,
 *  it can stay inside the page file.
 *
 * Components receive data through props.
 * They do not fetch their own data — pages do that
 * and pass the data down.
 */