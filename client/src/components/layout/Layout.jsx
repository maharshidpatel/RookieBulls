/*
 * Layout.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Persistent shell for all protected pages.
 *   Owns all panel and modal open/close state.
 *   Renders TopNav, SecondNav, and the matched child route via Outlet.
 *
 * Does NOT belong here:
 *   Page content, API calls, trade execution logic.
 *
 * How it fits:
 *   App.jsx wraps protected routes in <ProtectedRoute><Layout /></ProtectedRoute>.
 *   Layout uses React Router's <Outlet /> to render the current page.
 *   Child pages access openBuyPanel / openSellPanel via useOutletContext().
 *
 * Panel and modal rendering:
 *   Step 6.8  — BuyPanel, SellPanel rendered here
 *   Step 6.9  — OrderConfirmation, ExecutionConfirmation rendered here
 *   Step 6.10 — GetQuotePopup rendered here
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import SecondNav from './SecondNav';
import theme from '../../styles/theme';
import BuyPanel  from '../modals/BuyPanel';
import SellPanel from '../modals/SellPanel';

const Layout = () => {

  // ── Buy panel state ─────────────────────────────────────────────────────────
  //
  // ticker: string when opened from a specific stock context (QuotePage, Holdings row).
  // null when opened from SecondNav — the panel shows a TickerSearch input.
  //
  const [buyPanel, setBuyPanel] = useState({ open: false, ticker: null });

  // ── Sell panel state — same shape as buyPanel ───────────────────────────────
  const [sellPanel, setSellPanel] = useState({ open: false, ticker: null });

  // ── Get Quote popup ─────────────────────────────────────────────────────────
  const [quotePopupOpen, setQuotePopupOpen] = useState(false);

  // ── Order confirmation modal ────────────────────────────────────────────────
  //
  // Populated by BuyPanel/SellPanel when the user clicks Review Order.
  // Shape: { side: 'buy'|'sell', ticker: string, quantity: number } | null
  //
  const [orderData, setOrderData] = useState(null);

  // ── Execution confirmation modal ────────────────────────────────────────────
  //
  // Populated after the trade executes successfully.
  // Shape: { ticker, side, quantity, executedPrice, totalValue } | null
  //
  const [executionData, setExecutionData] = useState(null);


  // ── Handlers ────────────────────────────────────────────────────────────────
  //
  // Each open handler closes the others first.
  // Only one panel or popup is visible at a time.
  //
  // ticker parameter: passed by QuotePage and Holdings rows.
  // Default null: means the panel opens with an empty TickerSearch.
  //

  const openBuyPanel = (ticker = null) => {
    setSellPanel({ open: false, ticker: null });
    setQuotePopupOpen(false);
    setBuyPanel({ open: true, ticker });
  };

  const openSellPanel = (ticker = null) => {
    setBuyPanel({ open: false, ticker: null });
    setQuotePopupOpen(false);
    setSellPanel({ open: true, ticker });
  };

  const openQuotePopup = () => {
    setBuyPanel({ open: false, ticker: null });
    setSellPanel({ open: false, ticker: null });
    setQuotePopupOpen(true);
  };

  const closeAll = () => {
    setBuyPanel({ open: false, ticker: null });
    setSellPanel({ open: false, ticker: null });
    setQuotePopupOpen(false);
    setOrderData(null);
    setExecutionData(null);
  };

  // onTradeComplete — called when the user dismisses ExecutionConfirmation.
  // Clears all panel/modal state.
  // Step 6.5+ adds a refresh trigger here so SummaryPage re-fetches wallet/portfolio.
  const onTradeComplete = () => {
    closeAll();
  };


  return (
    <div style={styles.root}>

      {/* Fixed top navigation bar */}
      <TopNav />

      {/* Fixed second navigation bar — action buttons + page links */}
      <SecondNav
        onBuyClick={openBuyPanel}
        onSellClick={openSellPanel}
        onQuoteClick={openQuotePopup}
      />

      {/* Page content area — sits below both fixed nav bars */}
      <main style={styles.main}>
        <div style={styles.content}>

          {/*
           * Outlet renders the matched child route (SummaryPage, HoldingsPage, etc).
           *
           * useOutletContext() in child pages gives access to:
           *   openBuyPanel(ticker)  — open Buy panel, optionally pre-set ticker
           *   openSellPanel(ticker) — open Sell panel, optionally pre-set ticker
           *
           * This avoids prop drilling through every page component.
           */}
          <Outlet context={{ openBuyPanel, openSellPanel }} />

        </div>
      </main>

      {/* ── Panels ──────────────────────────────────────────────────────────── */}
      {buyPanel.open && (
        <BuyPanel
          ticker={buyPanel.ticker}
          onReview={setOrderData}
          onClose={closeAll}
        />
      )}

      {sellPanel.open && (
        <SellPanel
          ticker={sellPanel.ticker}
          onReview={setOrderData}
          onClose={closeAll}
        />
      )}

      {/*
       * Step 6.9:
       *   {orderData && <OrderConfirmation data={orderData} onExecuted={setExecutionData} onCancel={() => setOrderData(null)} />}
       *   {executionData && <ExecutionConfirmation data={executionData} onDone={onTradeComplete} />}
       *
       * Step 6.10:
       *   {quotePopupOpen && <GetQuotePopup onClose={() => setQuotePopupOpen(false)} />}
       */}

    </div>
  );
};


// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  root: {
    minHeight: '100vh',
    backgroundColor: theme.colors.background,
    fontFamily: theme.font.family,
  },

  main: {
    // Push content below both fixed nav bars.
    // calc() adds the two heights together at render time.
    paddingTop: `calc(${theme.layout.topNavHeight} + ${theme.layout.secondNavHeight})`,
    minHeight: '100vh',
  },

  content: {
    // Center content and cap its width on large screens.
    maxWidth: theme.layout.contentMaxWidth,
    margin: '0 auto',
    padding: `${theme.spacing[6]} ${theme.spacing[6]}`,
  },
};


export default Layout;