/*
 * components/modals/_purpose.js
 * ─────────────────────────────────────────────────────────────────────────────
 * This folder contains overlay components — panels and modals that render
 * above all page content.
 *
 * Files:
 *   BuyPanel.jsx          — slide-in panel for buy order entry
 *   SellPanel.jsx         — slide-in panel for sell order entry
 *   OrderConfirmation.jsx — review modal before execution (Step 6.9)
 *   ExecutionConfirmation.jsx — result modal after execution (Step 6.9)
 *   GetQuotePopup.jsx     — small centered quote lookup popup (Step 6.10)
 *
 * All panels and modals are rendered by Layout.jsx so they overlay
 * all page content. They are never rendered inside a page component.
 *
 * State ownership:
 *   Layout.jsx owns open/close state for all panels and modals.
 *   Panels receive their initial ticker (if any) as a prop from Layout.
 *   Panels call onReview() to pass order data up to Layout.
 *   Layout passes order data to OrderConfirmation.
 * ─────────────────────────────────────────────────────────────────────────────
 */