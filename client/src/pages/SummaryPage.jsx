/*
 * SummaryPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Main landing page after login.
 *   Displays the wallet summary card and a snapshot of open positions.
 *
 * Does NOT belong here:
 *   Trade execution logic (belongs in BuyPanel/SellPanel).
 *   Portfolio math (done on the server in portfolio/service.js).
 *   Auth logic.
 *
 * Data sources:
 *   fetchMyWallet()    → wallet.balance (available cash)
 *   fetchMyPortfolio() → positions[], summary (market value, pnl, dayChange)
 *
 * Derived values (computed here from server data):
 *   Total Equity     = wallet.balance + summary.totalMarketValue
 *   Available Cash   = wallet.balance
 *   Total Investments = summary.totalMarketValue
 *   Unrealized P/L   = summary.totalPnl
 *   Day Change       = summary.totalDayChange
 *   Book Value       = summary.totalCostBasis
 *
 * How it fits:
 *   Rendered by Layout via React Router Outlet at /summary.
 *   Receives openBuyPanel / openSellPanel via useOutletContext().
 *   Step 6.9 adds a refresh trigger so the page re-fetches after a trade.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMyWallet } from '../services/wallet';
import { fetchMyPortfolio } from '../services/portfolio';
import theme from '../styles/theme';
import tableStyles from '../styles/tableStyles';

const SummaryPage = () => {
    const navigate = useNavigate();
  
  const [wallet,    setWallet]    = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // loadData()
  //
  // Fetches wallet and portfolio in parallel.
  // Both are independent — Promise.all() fires both requests simultaneously.
  // useCallback keeps the reference stable across renders.
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
      setError('Failed to load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // ── Derived values ───────────────────────────────────────────────────────────
  //
  // Computed from server data. Only calculated when both wallet and portfolio
  // are loaded to avoid NaN or null errors during loading state.
  //
  const totalEquity     = wallet && portfolio
    ? wallet.balance + portfolio.summary.totalMarketValue
    : null;

  // ── Top movers ───────────────────────────────────────────────────────────────
  //
  // Two independent rankings — both sorted by magnitude (absolute value).
  // Direction (positive/negative) does not affect ranking — only size of move.
  // Color coding (green/red) still reflects actual direction.
  //
  // Left table  — by dollar value: Math.abs(dayChange) descending
  //   A $50 loss ranks above a $20 gain. Expensive stocks tend to dominate.
  //
  // Right table — by percent: Math.abs(dayChangePercent) descending
  //   A 5% move ranks above a 0.5% move regardless of dollar amount.
  //   Cheaper/smaller stocks often dominate this table.
  //
  // The same stock can appear in both, one, or neither table.
  //
  const moversByValue = portfolio
    ? [...portfolio.positions]
        .sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange))
        .slice(0, 3)
    : [];

  const moversByPercent = portfolio
    ? [...portfolio.positions]
        .sort((a, b) => Math.abs(b.dayChangePercent) - Math.abs(a.dayChangePercent))
        .slice(0, 3)
    : [];

  // Only show movers section if the user has at least one position
  // and at least one position has a non-zero day change.
  const hasPositions = portfolio && portfolio.positions.length > 0;

  // ── Formatting helpers ───────────────────────────────────────────────────────
  //
  // formatCurrency(value) → '$1,234.56'
  //   Formats any number as USD with 2 decimal places and thousands separator.
  //
  // formatPercent(value) → '+1.23%' or '-1.23%'
  //   Adds + prefix for positive values. Negative values already include '-'.
  //
  // pnlColor(value)
  //   Returns success green for positive, danger red for negative, muted for zero.
  //   Used to color P/L values throughout the page.
  //
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

      {/* ── Wallet summary card ─────────────────────────────────────────────── */}
      <div style={styles.card}>

        {/* Total Equity — largest, most prominent metric */}
        <div style={styles.equityBlock}>
          <span style={styles.equityLabel}>Total Equity</span>
          <span style={styles.equityValue}>
            {formatCurrency(totalEquity)}
          </span>
          <span style={styles.equitySubLabel}>
            Available Cash + Total Market Value
          </span>
        </div>

        <div style={styles.divider} />

        {/* Secondary metrics — medium size */}
        <div style={styles.metricsRow}>

          <div style={styles.metric}>
            <span style={styles.metricLabel}>Available Cash</span>
            <span style={styles.metricValue}>
              {formatCurrency(wallet.balance)}
            </span>
          </div>

          <div style={styles.metricDivider} />

          <div style={styles.metric}>
            <span style={styles.metricLabel}>Total Investments</span>
            <span style={styles.metricValue}>
              {formatCurrency(portfolio.summary.totalMarketValue)}
            </span>
          </div>

        </div>

        <div style={styles.divider} />

        {/* Tertiary metrics — Book Value, Unrealized P/L, Day Change */}
        <div style={styles.statsRow}>

          <div style={styles.stat}>
            <span style={styles.statLabel}>Book Value</span>
            <span style={styles.statValue}>
              {formatCurrency(portfolio.summary.totalCostBasis)}
            </span>
          </div>

          <div style={styles.stat}>
            <span style={styles.statLabel}>Unrealized P/L</span>
            <span style={{
              ...styles.statValue,
              color: pnlColor(portfolio.summary.totalPnl),
            }}>
              {formatCurrency(portfolio.summary.totalPnl)}
              <span style={styles.statPercent}>
                {portfolio.summary.totalCostBasis > 0
                  ? ` (${formatPercent(portfolio.summary.totalPnlPercent)})`
                  : ''}
              </span>
            </span>
          </div>

          <div style={styles.stat}>
            <span style={styles.statLabel}>Day Change</span>
            <span style={{
              ...styles.statValue,
              color: pnlColor(portfolio.summary.totalDayChange),
            }}>
              {formatCurrency(portfolio.summary.totalDayChange)}
              <span style={styles.statPercent}>
                {portfolio.summary.totalMarketValue > 0
                  ? ` (${formatPercent(
                      (portfolio.summary.totalDayChange /
                        (portfolio.summary.totalMarketValue -
                          portfolio.summary.totalDayChange)) * 100
                    )})`
                  : ''}
              </span>
            </span>
          </div>

        </div>
      </div>

      {/* ── Today's top movers — personal portfolio ─────────────────────────── */}
      {hasPositions && (
        <div style={styles.moversSection}>

          {/* Gainers */}
          <div style={styles.moversCard}>
            <h3 style={styles.moversHeading}>Top Movers ($)</h3>
            <table style={styles.moversTable}>
              <thead>
                <tr>
                  <th style={styles.moversTh}>Symbol</th>
                  <th style={{ ...styles.moversTh, textAlign: 'right' }}>Day Change</th>
                  <th style={{ ...styles.moversTh, textAlign: 'right' }}>Change %</th>
                </tr>
              </thead>
              <tbody>
                {moversByValue.map((position, index) => (
                  <tr
                    key={position.ticker}
                    style={{
                      ...styles.moversTr,
                      backgroundColor: index % 2 === 0
                        ? theme.colors.surface
                        : theme.colors.surfaceAlt,
                    }}
                  >
                    <td style={styles.moversTd}>
                      <span
                        style={styles.tickerLink}
                        onClick={() => navigate(`/quote/${position.ticker}`)}
                      >
                        {position.ticker}
                      </span>
                    </td>
                    <td style={{
                      ...styles.moversTd,
                      textAlign: 'right',
                      color: pnlColor(position.dayChange),
                      fontWeight: theme.font.weight.medium,
                    }}>
                      {formatCurrency(position.dayChange)}
                    </td>
                    <td style={{
                      ...styles.moversTd,
                      textAlign: 'right',
                      color: pnlColor(position.dayChangePercent),
                      fontWeight: theme.font.weight.medium,
                    }}>
                      {formatPercent(position.dayChangePercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Losers */}
          <div style={styles.moversCard}>
            <h3 style={styles.moversHeading}>Top Movers (%)</h3>
            <table style={styles.moversTable}>
              <thead>
                <tr>
                  <th style={styles.moversTh}>Symbol</th>
                  <th style={{ ...styles.moversTh, textAlign: 'right' }}>Day Change</th>
                  <th style={{ ...styles.moversTh, textAlign: 'right' }}>Change %</th>
                </tr>
              </thead>
              <tbody>
                {moversByPercent.map((position, index) => (
                  <tr
                    key={position.ticker}
                    style={{
                      ...styles.moversTr,
                      backgroundColor: index % 2 === 0
                        ? theme.colors.surface
                        : theme.colors.surfaceAlt,
                    }}
                  >
                    <td style={styles.moversTd}>
                      <span
                        style={styles.tickerLink}
                        onClick={() => navigate(`/quote/${position.ticker}`)}
                      >
                        {position.ticker}
                      </span>
                    </td>
                    <td style={{
                      ...styles.moversTd,
                      textAlign: 'right',
                      color: pnlColor(position.dayChange),
                      fontWeight: theme.font.weight.medium,
                    }}>
                      {formatCurrency(position.dayChange)}
                    </td>
                    <td style={{
                      ...styles.moversTd,
                      textAlign: 'right',
                      color: pnlColor(position.dayChangePercent),
                      fontWeight: theme.font.weight.medium,
                    }}>
                      {formatPercent(position.dayChangePercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
    gap: theme.spacing[6],
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

  // ── Wallet card ─────────────────────────────────────────────────────────────

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.sm,
    padding: theme.spacing[6],
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[4],
  },

  // Total Equity block — most prominent element in the card
  equityBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[1],
  },

  equityLabel: {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },

  equityValue: {
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
    color: theme.colors.textPrimary,
    lineHeight: theme.font.lineHeight.tight,
  },

  equitySubLabel: {
    fontSize: theme.font.size.xs,
    color: theme.colors.textMuted,
  },

  // Horizontal rule between card sections
  divider: {
    height: '1px',
    backgroundColor: theme.colors.border,
    border: 'none',
    margin: `${theme.spacing[1]} 0`,
  },

  // Medium metrics row — Available Cash + Total Investments
  metricsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing[8],
  },

  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[1],
  },

  metricLabel: {
    fontSize: theme.font.size.sm,
    color: theme.colors.textSecondary,
  },

  metricValue: {
    fontSize: theme.font.size.xl,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.textPrimary,
  },

  // Vertical divider between medium metrics
  metricDivider: {
    width: '1px',
    height: '40px',
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
  },

  // Small stats row — P/L, Day Change, Book Value
  statsRow: {
    display: 'flex',
    gap: theme.spacing[8],
    flexWrap: 'wrap',
  },

  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[1],
  },

  statLabel: {
    fontSize: theme.font.size.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  statValue: {
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.medium,
    color: theme.colors.textPrimary,
  },

  statPercent: {
    fontSize: theme.font.size.sm,
    marginLeft: theme.spacing[1],
  },

  // ── Top movers ──────────────────────────────────────────────────────────────

  moversSection: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing[4],
  },

  moversCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.sm,
    overflow: 'hidden',
  },

  moversHeading: {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
  },

  moversTable: tableStyles.table,
  moversTh:    tableStyles.th,
  moversTr:    tableStyles.tr,
  moversTd:    tableStyles.td,
  tickerLink:  tableStyles.tickerLink,

};

export default SummaryPage;