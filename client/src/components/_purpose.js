/**
 * FOLDER: /client/src/components
 *
 * Reusable UI building blocks used across multiple pages.
 * A component is a self-contained piece of UI with its own
 * logic and appearance.
 *
 * Current components:
 *  - TickerSearch.jsx  → debounced stock ticker search with dropdown
 *  - ProtectedRoute.jsx → auth guard, redirects unauthenticated users
 *
 * Subfolders:
 *  - layout/   → Layout.jsx, TopNav.jsx, SecondNav.jsx (app shell)
 *  - modals/   → TradePanel, OrderConfirmation, ExecutionConfirmation,
 *                GetQuotePopup (overlays owned by Layout)
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