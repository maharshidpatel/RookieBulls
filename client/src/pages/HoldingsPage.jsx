/*
 * HoldingsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Full positions table with all metrics and Buy/Sell actions per row.
 *   Header shows Available Cash and Total Investments as context.
 *
 * Does NOT belong here:
 *   Trade execution logic (belongs in BuyPanel/SellPanel).
 *   Portfolio math (done on the server in portfolio/service.js).
 *
 * Data sources:
 *   fetchMyWallet()    → wallet.balance (Available Cash header)
 *   fetchMyPortfolio() → positions[], summary (Total Investments header)
 *
 * Columns:
 *   Symbol, Qty, Avg Price, Book Value, Current Price,
 *   Market Value, P/L, P/L %, Buy, Sell
 *
 *   Book Value = Qty × Avg Price (cost basis per position — same as costBasis
 *   from the server, shown here as a dedicated column for clarity)
 *
 * Company name:
 *   Shown below ticker symbol after Step 6.11 adds getStockProfile().
 *   Placeholder comment marks where it will be added.
 *
 * Buy / Sell buttons:
 *   Opens the panel in Layout with the ticker pre-set.
 *   Received via useOutletContext() from Layout.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { fetchMyWallet } from '../services/wallet';
import { fetchMyPortfolio } from '../services/portfolio';
import theme from '../styles/theme';
import tableStyles from '../styles/tableStyles';

const HoldingsPage = () => {
  const navigate = useNavigate();
  const { refreshKey } = useOutletContext();

  // openBuyPanel(ticker) / openSellPanel(ticker) — from Layout via Outlet context.
  // Passed to Buy/Sell buttons in each row so the panel opens pre-set to that ticker.
  const { openBuyPanel, openSellPanel } = useOutletContext();

  const [wallet,    setWallet]    = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [isInitial, setIsInitial] = useState(true);

  // Row hover state — tracks which row the user is hovering over.
  // index-based: hoveredRow === index → highlight that row.
  const [hoveredRow, setHoveredRow] = useState(null);

  // Button hover state — tracks which button the user is hovering.
  // Shape: { rowIndex: number, Operation: 'buy'|'sell' } | null
  const [hoveredBtn, setHoveredBtn] = useState(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [walletData, portfolioData] = await Promise.all([
        fetchMyWallet(),
        fetchMyPortfolio(),
      ]);

      if (silent) {
        setWallet(prev => {
          if (!prev) return walletData;
          return prev.balance !== walletData.balance ? walletData : prev;
        });
        setPortfolio(prev => {
          if (!prev) return portfolioData;
          const changed =
            prev.summary.totalMarketValue !== portfolioData.summary.totalMarketValue ||
            prev.summary.totalDayChange   !== portfolioData.summary.totalDayChange;
          return changed ? portfolioData : prev;
        });
      } else {
        setWallet(walletData);
        setPortfolio(portfolioData);
        setIsInitial(false);
      }

      setError(null);
    } catch {
      if (!silent) setError('Failed to load holdings. Please refresh.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load + re-fetch after trade
  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Background poll every 15s — silent, only updates if data changed
  useEffect(() => {
    if (isInitial) return;
    const interval = setInterval(() => loadData(true), 15000);
    return () => clearInterval(interval);
  }, [isInitial, loadData]);

  // ── Formatting helpers ───────────────────────────────────────────────────────

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);

  const formatPercent = (value) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const pnlColor = (value) => {
    if (value > 0) return theme.colors.success;
    if (value < 0) return theme.colors.danger;
    return theme.colors.textMuted;
  };


  // ── Render states ─────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={styles.stateMessage}>Loading...</div>;
  }

  if (error) {
    return <div style={styles.errorMessage}>{error}</div>;
  }


  return (
    <div style={styles.page}>

      {/* ── Page header — Available Cash + Total Investments ─────────────────── */}
      <div style={styles.header}>

        <div style={styles.headerMetric}>
          <span style={styles.headerLabel}>Available Cash</span>
          <span style={styles.headerValue}>
            {formatCurrency(wallet.balance)}
          </span>
        </div>

        <div style={styles.headerDivider} />

        <div style={styles.headerMetric}>
          <span style={styles.headerLabel}>Total Investments</span>
          <span style={styles.headerValue}>
            {formatCurrency(portfolio.summary.totalMarketValue)}
          </span>
        </div>

      </div>


      {/* ── Holdings table ──────────────────────────────────────────────────── */}
      {portfolio.positions.length === 0 ? (

        <div style={styles.emptyState}>
          <p style={styles.emptyStateText}>You have no open positions.</p>
          <p style={styles.emptyStateHint}>
            Use the Buy button above to simulate your first trade.
          </p>
        </div>

      ) : (

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
                <tr>
                  <th style={styles.th}>Symbol</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Qty</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Avg Price</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Book Value</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Current Price</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Market Value</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>P/L</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>P/L %</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}></th>
                </tr>
              </thead>
            <tbody>
              {portfolio.positions.map((position, index) => {

                const isRowHovered = hoveredRow === index;
                const isBuyHovered  = hoveredBtn?.rowIndex === index && hoveredBtn?.operation === 'buy';
                const isSellHovered = hoveredBtn?.rowIndex === index && hoveredBtn?.operation === 'sell';

                return (
                  <tr
                    key={position.ticker}
                    style={{
                      ...styles.tr,
                      backgroundColor: isRowHovered
                        ? theme.colors.accentTint
                        : index % 2 === 0
                          ? theme.colors.surface
                          : theme.colors.surfaceAlt,
                    }}
                    onMouseEnter={() => setHoveredRow(index)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >

                    {/* Symbol — clickable, navigates to quote page */}
                    {/*
                     * Company name will be added below the ticker in Step 6.11
                     * when getStockProfile() is available.
                     * Pattern will be:
                     *   <span style={styles.tickerLink}>AAPL</span>
                     *   <span style={styles.companyName}>Apple Inc.</span>
                     */}
                    <td style={styles.td}>
                      <span
                        style={styles.tickerLink}
                        onClick={() => navigate(`/quote/${position.ticker}`)}
                      >
                        {position.ticker}
                      </span>
                    </td>

                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {position.quantity}
                    </td>

                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {formatCurrency(position.avgBuyPrice)}
                    </td>

                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {formatCurrency(position.costBasis)}
                    </td>

                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {formatCurrency(position.currentPrice)}
                    </td>

                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {formatCurrency(position.marketValue)}
                    </td>

                    <td style={{
                      ...styles.td,
                      textAlign: 'right',
                      color: pnlColor(position.pnl),
                      fontWeight: theme.font.weight.medium,
                    }}>
                      {formatCurrency(position.pnl)}
                    </td>

                    <td style={{
                      ...styles.td,
                      textAlign: 'right',
                      color: pnlColor(position.pnlPercent),
                      fontWeight: theme.font.weight.medium,
                    }}>
                      {formatPercent(position.pnlPercent)}
                    </td>

                    {/* Buy + Sell buttons — single cell, small gap */}
                    <td style={{ ...styles.tdAction, textAlign: 'right' }}>
                      <button
                        style={{
                          ...styles.actionBtn,
                          ...styles.buyBtn,
                          ...(isBuyHovered ? styles.buyBtnHover : {}), 
                        }}
                        onClick={() => openBuyPanel(position.ticker, position.currentPrice)}
                        onMouseEnter={() => setHoveredBtn({ rowIndex: index, operation: 'buy' })}
                        onMouseLeave={() => setHoveredBtn(null)}
                      >
                        Buy
                      </button>
                      <button
                        style={{
                          ...styles.actionBtn,
                          ...styles.sellBtn,
                          ...(isSellHovered ? styles.sellBtnHover : {}),
                          marginLeft: theme.spacing[3],
                        }}
                        onClick={() => openSellPanel(position.ticker, position.quantity)}
                        onMouseEnter={() => setHoveredBtn({ rowIndex: index, operation: 'sell' })}
                        onMouseLeave={() => setHoveredBtn(null)}
                      >
                        Sell
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      )}
    </div>
  );
};


// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[4],
  },

  stateMessage: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.size.md,
    padding: theme.spacing[8],
    textAlign: 'center',
  },

  errorMessage: {
    color: theme.colors.danger,
    fontSize: theme.font.size.md,
    padding: theme.spacing[8],
    textAlign: 'center',
    backgroundColor: theme.colors.dangerTint,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.danger}`,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing[8],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.sm,
    padding: `${theme.spacing[4]} ${theme.spacing[6]}`,
  },

  headerMetric: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[1],
  },

  headerLabel: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },

  headerValue: {
    fontSize: theme.font.size.xl,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.textPrimary,
  },

  headerDivider: {
    width: '1px',
    height: '40px',
    backgroundColor: theme.colors.border,
  },

  // ── Shared table styles ─────────────────────────────────────────────────────
  ...tableStyles,

  // ── Row action buttons ──────────────────────────────────────────────────────

  tdAction: {
    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
    whiteSpace: 'nowrap',
  },

  actionBtn: {
    height: '26px',
    padding: `0 ${theme.spacing[3]}`,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    borderRadius: theme.radius.full,
    borderWidth: '1px',
    borderStyle: 'solid',
    cursor: 'pointer',
    transition: `background-color ${theme.transition.fast}, color ${theme.transition.fast}, border-color ${theme.transition.fast}`,
    userSelect: 'none',
  },

  buyBtn: {
    color: theme.colors.white,
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.success,
  },
  buyBtnHover: {
    color: theme.colors.successHover,
    borderColor: theme.colors.successHover,
    backgroundColor: theme.colors.successTint,
  },

  sellBtn: {
    color: theme.colors.white,
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.danger,
  },
  sellBtnHover: {
    color: theme.colors.dangerHover,
    borderColor: theme.colors.dangerHover,
    backgroundColor: theme.colors.dangerTint,
  },
};


export default HoldingsPage;