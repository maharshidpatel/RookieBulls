/*
 * HistoryPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Displays the authenticated user's full trade history, newest first.
 *   Filtered by month via a single dropdown.
 *
 * Does NOT belong here:
 *   Trade execution logic, portfolio math, wallet data.
 *
 * Data source:
 *   fetchTradeHistory() → trades[] (all trades, newest first)
 *
 * Filtering:
 *   All grouping and filtering is done client-side from the full trades array.
 *   No backend changes needed — data volume is small at this stage.
 *   When pagination is added post-deployment, filtering moves to the backend.
 *
 * Dropdown:
 *   Built from actual trade data — only months that have trades appear.
 *   Format: 'March 2026 (8 trades)'
 *   Default: most recent month that has trades.
 *
 * Columns:
 *   Date / Time (ET) | Symbol | Operation | Qty | Executed Price | Total Value
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import fetchTradeHistory from '../services/history';
import theme from '../styles/theme';
import tableStyles from '../styles/tableStyles';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { refreshKey } = useOutletContext();

  const [trades,          setTrades]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState(null);
  const [dropdownHovered,  setDropdownHovered]  = useState(false);

  const load = async () => {
    try {
      const data = await fetchTradeHistory();
      setTrades(data);
    } catch {
      setError('Failed to load trade history. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    load();
  }, []);

  // Re-fetch after a trade completes (refreshKey incremented in Layout)
  useEffect(() => {
    if (refreshKey > 0) load();
  }, [refreshKey]); 


  // ── Month grouping ───────────────────────────────────────────────────────────
  //
  // Derives the list of unique months from the trades array.
  // Each entry is { key, label, count }
  //
  // key:   'YYYY-MM' string — used for comparison and state
  //        e.g. '2026-02'
  // label: 'February 2026 (8 trades)' — shown in the dropdown
  // count: number of trades in that month
  //
  // getMonthKey(isoString)
  //   Converts a UTC timestamp to a 'YYYY-MM' key in ET timezone.
  //   Using ET ensures the key matches what the user sees in the Date column.
  //   A trade at 11:58 PM ET appears on a different date than UTC midnight.
  //
  const getMonthKey = (isoString) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year:     'numeric',
      month:    '2-digit',
    }).format(date).split('/').reverse().join('-');
    // Intl returns 'MM/YYYY' — reverse and join gives 'YYYY-MM'
  };

  const getMonthLabel = (isoString) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month:    'long',
      year:     'numeric',
    }).format(date);
  };

  // monthOptions — derived from trades, computed once when trades changes.
  // useMemo prevents recomputing on every render.
  // Months appear newest first — same order as the trades themselves.
  const monthOptions = useMemo(() => {
    if (trades.length === 0) return [];

    // Build a map of key → { label, count } in one pass.
    const map = new Map();
    trades.forEach((trade) => {
      const key   = getMonthKey(trade.createdAt);
      const label = getMonthLabel(trade.createdAt);
      if (!map.has(key)) {
        map.set(key, { key, label, count: 0 });
      }
      map.get(key).count += 1;
    });

    // Map preserves insertion order — trades are newest first,
    // so the map is already in newest-month-first order.
    return Array.from(map.values());
  }, [trades]);

  // Set default selection to the most recent month once monthOptions resolves.
  // Only runs when monthOptions changes — prevents overwriting user selection.
  useEffect(() => {
    if (monthOptions.length > 0 && selectedMonthKey === null) {
      setSelectedMonthKey(monthOptions[0].key);
    }
  }, [monthOptions, selectedMonthKey]);

  // filteredTrades — trades belonging to the selected month only.
  const filteredTrades = useMemo(() => {
    if (!selectedMonthKey) return [];
    return trades.filter(
      (trade) => getMonthKey(trade.createdAt) === selectedMonthKey
    );
  }, [trades, selectedMonthKey]);


  // ── Formatting helpers ────────────────────────────────────────────────────────

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style:                 'currency',
      currency:              'USD',
      minimumFractionDigits: 2,
    }).format(value);

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month:    'short',
      day:      'numeric',
      year:     'numeric',
      hour:     'numeric',
      minute:   '2-digit',
      hour12:   true,
    }).format(date) + ' ET';
  };


  // ── Render states ─────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={styles.stateMessage}>Loading...</div>;
  }

  if (error) {
    return <div style={styles.errorMessage}>{error}</div>;
  }


  // Selected month label for the trade count display
  const selectedMonth = monthOptions.find(m => m.key === selectedMonthKey);


  return (
    <div style={styles.page}>

      {/* ── Page header — title + dropdown ──────────────────────────────────── */}
      <div style={styles.pageHeader}>

        <div style={styles.pageTitleRow}>
          <h2 style={styles.pageTitle}>Trade History</h2>
          {selectedMonth && (
            <span style={styles.tradeCount}>
              {selectedMonth.count} {selectedMonth.count === 1 ? 'trade' : 'trades'}
            </span>
          )}
        </div>

        {/* Month selector dropdown */}
        {monthOptions.length > 0 && (
          <select
            value={selectedMonthKey ?? ''}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            style={{
              ...styles.dropdown,
              ...(dropdownHovered ? styles.dropdownHover : {}),
            }}
            onMouseEnter={() => setDropdownHovered(true)}
            onMouseLeave={() => setDropdownHovered(false)}
          >
            {monthOptions.map(({ key, label, count }) => (
              <option key={key} value={key}>
                {label} ({count} {count === 1 ? 'trade' : 'trades'})
              </option>
            ))}
          </select>
        )}

      </div>


      {/* ── Empty state — no trades at all ───────────────────────────────────── */}
      {trades.length === 0 ? (

        <div style={styles.emptyState}>
          <p style={styles.emptyStateText}>No trades yet.</p>
          <p style={styles.emptyStateHint}>
            Use the Buy button above to simulate your first trade.
          </p>
        </div>

      ) : (

        /* ── Trade history table ───────────────────────────────────────────── */
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date / Time (ET)</th>
                <th style={styles.th}>Symbol</th>
                <th style={styles.th}>Operation</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Qty</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Executed Price</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade, index) => {
                const totalValue = trade.quantity * trade.priceAtExecution;
                const isBuy     = trade.action === 'buy';

                return (
                  <tr
                    key={trade._id}
                    style={{
                      ...styles.tr,
                      backgroundColor: index % 2 === 0
                        ? theme.colors.surface
                        : theme.colors.surfaceAlt,
                    }}
                  >

                    <td style={styles.td}>
                      {formatDateTime(trade.createdAt)}
                    </td>

                    <td style={styles.td}>
                      <span
                        style={styles.tickerLink}
                        onClick={() => navigate(`/quote/${trade.ticker}`)}
                      >
                        {trade.ticker}
                      </span>
                    </td>

                    <td style={{
                      ...styles.td,
                      color:      isBuy ? theme.colors.success : theme.colors.danger,
                      fontWeight: theme.font.weight.semibold,
                    }}>
                      {isBuy ? 'Buy' : 'Sell'}
                    </td>

                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {trade.quantity}
                    </td>

                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {formatCurrency(trade.priceAtExecution)}
                    </td>

                    <td style={{
                      ...styles.td,
                      textAlign:  'right',
                      color:      isBuy ? theme.colors.danger : theme.colors.success,
                      fontWeight: theme.font.weight.medium,
                    }}>
                      {isBuy ? '-' : '+'}{formatCurrency(totalValue)}
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
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[4],
  },

  stateMessage: {
    color:     theme.colors.textSecondary,
    fontSize:  theme.font.size.md,
    padding:   theme.spacing[8],
    textAlign: 'center',
  },

  errorMessage: {
    color:           theme.colors.danger,
    fontSize:        theme.font.size.md,
    padding:         theme.spacing[8],
    textAlign:       'center',
    backgroundColor: theme.colors.dangerTint,
    borderRadius:    theme.radius.md,
    border:          `1px solid ${theme.colors.danger}`,
  },

  // ── Page header ─────────────────────────────────────────────────────────────

  pageHeader: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
  },

  pageTitleRow: {
    display:    'flex',
    alignItems: 'baseline',
    gap:        theme.spacing[3],
  },

  pageTitle: {
    fontSize:   theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    color:      theme.colors.textPrimary,
  },

  tradeCount: {
    fontSize: theme.font.size.sm,
    color:    theme.colors.textMuted,
  },

  // ── Month dropdown ──────────────────────────────────────────────────────────
  //
  // Styled as a pill — consistent with the nav pill language used throughout.
  // Native <select> element — no custom dropdown needed at this scale.
  // appearance: 'none' would remove the native arrow — keeping it for clarity.
  //
  dropdown: {
    fontSize:        theme.font.size.sm,
    fontWeight:      theme.font.weight.medium,
    color:           theme.colors.textSecondary,
    backgroundColor: theme.colors.surface,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
    padding:         `${theme.spacing[2]} ${theme.spacing[4]}`,
    cursor:          'pointer',
    outline:         'none',
    transition:      `border-color ${theme.transition.fast}, color ${theme.transition.fast}`,
    fontFamily:      theme.font.family,
    height:          theme.ui.inputHeight,
  },

  dropdownHover: {
    borderColor: theme.colors.accent,
    color:       theme.colors.accent,
  },

  // ── Shared table styles ─────────────────────────────────────────────────────
  ...tableStyles,
};


export default HistoryPage;