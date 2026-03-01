/*
 * components/layout/_purpose.js
 * ─────────────────────────────────────────────────────────────────────────────
 * This folder contains the persistent shell that wraps all protected pages.
 *
 * Files:
 *   Layout.jsx    — owns all panel and modal state. Renders TopNav, SecondNav,
 *                   and the current page via React Router's Outlet.
 *   TopNav.jsx    — fixed top bar: company name (link to /summary),
 *                   display name, logout button.
 *   SecondNav.jsx — fixed second bar: Buy/Sell/Quote action buttons,
 *                   page navigation links, market status indicator.
 *
 * Why Layout owns panel/modal state:
 *   Buy and Sell panels are triggered from multiple pages (Summary, Holdings,
 *   QuotePage, SecondNav). Lifting state to their common parent (Layout)
 *   avoids prop drilling and keeps trigger logic in one place.
 *
 * What does NOT belong in this folder:
 *   Page-specific content, API calls, business logic.
 * ─────────────────────────────────────────────────────────────────────────────
 */