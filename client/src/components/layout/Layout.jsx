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
 *   Step 6.8  — TradePanel rendered here (replaces BuyPanel, SellPanel)
 *   Step 6.9  — OrderConfirmation, ExecutionConfirmation rendered here
 *   Step 6.10 — GetQuotePopup rendered here
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import SecondNav from './SecondNav';
import { useTheme } from '../../context/ThemeContext';
import { useMobile } from '../../hooks/useBreakpoint';
import TradePanel from '../modals/TradePanel';
import OrderConfirmation     from '../modals/OrderConfirmation';
import ExecutionConfirmation from '../modals/ExecutionConfirmation';
import GetQuotePopup from '../modals/GetQuotePopup';

const Layout = () => {
  const theme    = useTheme();
  const isMobile = useMobile();

  // ── Buy panel state ─────────────────────────────────────────────────────────
  //
  // ticker: string when opened from a specific stock context (QuotePage, Holdings row).
  // null when opened from SecondNav — the panel shows a TickerSearch input.
  //
  const [buyPanel, setBuyPanel] = useState({ open: false, ticker: null, currentPrice: null });

  // ── Sell panel state — same shape as buyPanel ───────────────────────────────
  const [sellPanel, setSellPanel] = useState({ open: false, ticker: null, availableShares: null });

  // ── Get Quote popup ─────────────────────────────────────────────────────────
  const [quotePopupOpen, setQuotePopupOpen] = useState(false);

  // ── Order confirmation modal ────────────────────────────────────────────────
  //
  // Populated by BuyPanel/SellPanel when the user clicks Review Order.
  // Shape: { operation: 'buy'|'sell', ticker: string, quantity: number } | null
  //
  const [orderData, setOrderData] = useState(null);

  // ── Execution confirmation modal ────────────────────────────────────────────
  //
  // Populated after the trade executes successfully.
  // Shape: { ticker, operation, quantity, executedPrice, totalValue } | null
  //
  const [executionData, setExecutionData] = useState(null);

  // refreshKey — incremented when a trade completes successfully.
  // Pages that receive this via useOutletContext re-fetch their data
  // when refreshKey changes. No navigation required.
  const [refreshKey, setRefreshKey] = useState(0);


  // ── Handlers ────────────────────────────────────────────────────────────────
  //
  // Each open handler closes the others first.
  // Only one panel or popup is visible at a time.
  //
  // ticker parameter: passed by QuotePage and Holdings rows.
  // Default null: means the panel opens with an empty TickerSearch.
  //

  const openBuyPanel = (ticker = null, currentPrice = null) => {
    setSellPanel({ open: false, ticker: null, availableShares: null });
    setQuotePopupOpen(false);
    setBuyPanel({ open: true, ticker, currentPrice });
  };

  const openSellPanel = (ticker = null, availableShares = null) => {
    setBuyPanel({ open: false, ticker: null });
    setQuotePopupOpen(false);
    setSellPanel({ open: true, ticker, availableShares });
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
    // Increment refreshKey — pages watching this will re-fetch data.
    setRefreshKey(prev => prev + 1);
  };


  // ── Styles ──────────────────────────────────────────────────────────────────
  //
  // Mobile: SecondNav stacks to ~100px tall (two rows of ~48px each).
  // Desktop: topNavHeight (60px) + secondNavHeight (52px).
  //
  const mainPaddingTop = isMobile
    ? 'calc(60px + 100px)'
    : `calc(${theme.layout.topNavHeight} + ${theme.layout.secondNavHeight})`;

  const contentPadding = isMobile
    ? theme.spacing[3]
    : `${theme.spacing[6]} ${theme.spacing[6]}`;

  const styles = {
    root: {
      minHeight:       '100vh',
      backgroundColor: theme.colors.background,
      fontFamily:      theme.font.family,
    },

    main: {
      // Push content below both fixed nav bars.
      // calc() adds the two heights together at render time.
      paddingTop: mainPaddingTop,
      minHeight:  '100vh',
    },

    content: {
      // Center content and cap its width on large screens.
      maxWidth: theme.layout.contentMaxWidth,
      margin:   '0 auto',
      padding:  contentPadding,
    },
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
           *   refreshKey — incremented when a trade completes successfully
           *
           * This avoids prop drilling through every page component.
           */}
          <Outlet context={{ openBuyPanel, openSellPanel, refreshKey }} />

        </div>
      </main>

      {/* ── Panels ──────────────────────────────────────────────────────────── */}
      {(buyPanel.open || sellPanel.open) && (
        <TradePanel
          initialOperation={buyPanel.open ? 'buy' : 'sell'}
          ticker={buyPanel.open ? buyPanel.ticker : sellPanel.ticker}
          currentPrice={buyPanel.currentPrice}
          availableShares={sellPanel.availableShares}
          onReview={setOrderData}
          onClose={closeAll}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {orderData && (
        <OrderConfirmation
          data={orderData}
          onExecuted={setExecutionData}
          onCancel={() => setOrderData(null)}
        />
      )}

      {executionData && (
        <ExecutionConfirmation
          data={executionData}
          onDone={onTradeComplete}
        />
      )}

      {quotePopupOpen && (
        <GetQuotePopup
          onClose={() => setQuotePopupOpen(false)}
        />
      )}

    </div>
  );
};

export default Layout;