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

const HoldingsPage = () => {
  const navigate = useNavigate();

  // openBuyPanel(ticker) / openSellPanel(ticker) — from Layout via Outlet context.
  // Passed to Buy/Sell buttons in each row so the panel opens pre-set to that ticker.
  const { openBuyPanel, openSellPanel } = useOutletContext();

  const [wallet,    setWallet]    = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Row hover state — tracks which row the user is hovering over.
  // index-based: hoveredRow === index → highlight that row.
  const [hoveredRow, setHoveredRow] = useState(null);

  // Button hover state — tracks which button the user is hovering.
  // Shape: { rowIndex: number, side: 'buy'|'sell' } | null
  const [hoveredBtn, setHoveredBtn] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [walletData, portfolioData] = await Promise.all([
        fetchMyWallet(),
        fetchMyPortfolio(),
      ]);
      setWallet(walletData);
      setPortfolio(portfolioData);
      setError(null);
    } catch {
      setError('Failed to load holdings. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


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
                {[
                  'Symbol', 'Qty', 'Avg Price', 'Book Value',
                  'Current Price', 'Market Value', 'P/L', 'P/L %', '',
                ].map((heading, i) => (
                  <th key={i} style={styles.th}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.map((position, index) => {

                const isRowHovered = hoveredRow === index;
                const isBuyHovered  = hoveredBtn?.rowIndex === index && hoveredBtn?.side === 'buy';
                const isSellHovered = hoveredBtn?.rowIndex === index && hoveredBtn?.side === 'sell';

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

                    <td style={styles.td}>
                      {position.quantity}
                    </td>

                    <td style={styles.td}>
                      {formatCurrency(position.avgBuyPrice)}
                    </td>

                    {/* Book Value = Qty × Avg Price = costBasis from server */}
                    <td style={styles.td}>
                      {formatCurrency(position.costBasis)}
                    </td>

                    <td style={styles.td}>
                      {formatCurrency(position.currentPrice)}
                    </td>

                    <td style={styles.td}>
                      {formatCurrency(position.marketValue)}
                    </td>

                    <td style={{
                      ...styles.td,
                      color: pnlColor(position.pnl),
                      fontWeight: theme.font.weight.medium,
                    }}>
                      {formatCurrency(position.pnl)}
                    </td>

                    <td style={{
                      ...styles.td,
                      color: pnlColor(position.pnlPercent),
                      fontWeight: theme.font.weight.medium,
                    }}>
                      {formatPercent(position.pnlPercent)}
                    </td>

                    {/* Buy + Sell buttons — single cell, small gap */}
                    <td style={styles.tdAction}>
                      <button
                        style={{
                          ...styles.actionBtn,
                          ...styles.buyBtn,
                          ...(isBuyHovered ? styles.buyBtnHover : {}),
                        }}
                        onClick={() => openBuyPanel(position.ticker)}
                        onMouseEnter={() => setHoveredBtn({ rowIndex: index, side: 'buy' })}
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
                        onClick={() => openSellPanel(position.ticker)}
                        onMouseEnter={() => setHoveredBtn({ rowIndex: index, side: 'sell' })}
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

  // ── Loading / error states ──────────────────────────────────────────────────

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

  // ── Page header ─────────────────────────────────────────────────────────────

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

  // ── Table ───────────────────────────────────────────────────────────────────

  tableWrapper: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.sm,
    overflow: 'hidden',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: theme.font.size.sm,
  },

  th: {
    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
    textAlign: 'left',
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    backgroundColor: theme.colors.surfaceAlt,
    borderBottom: `1px solid ${theme.colors.border}`,
    whiteSpace: 'nowrap',
  },

  tr: {
    borderBottom: `1px solid ${theme.colors.border}`,
    transition: `background-color ${theme.transition.fast}`,
  },

  td: {
    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
    color: theme.colors.textPrimary,
    whiteSpace: 'nowrap',
  },

  tdAction: {
    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
    whiteSpace: 'nowrap',
  },

  tickerLink: {
    color: theme.colors.accent,
    fontWeight: theme.font.weight.semibold,
    cursor: 'pointer',
  },

  // ── Row action buttons ──────────────────────────────────────────────────────
  //
  // Smaller than SecondNav action buttons — compact for table rows.
  // Same filled default + tint hover pattern as SecondNav.
  //
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

  // ── Empty state ─────────────────────────────────────────────────────────────

  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: `${theme.spacing[10]} ${theme.spacing[6]}`,
    textAlign: 'center',
  },

  emptyStateText: {
    fontSize: theme.font.size.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing[2],
  },

  emptyStateHint: {
    fontSize: theme.font.size.sm,
    color: theme.colors.textMuted,
  },
};


export default HoldingsPage;