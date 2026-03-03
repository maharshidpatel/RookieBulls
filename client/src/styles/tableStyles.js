/*
 * tableStyles.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Shared style objects for all data tables across the application.
 *   Single source of truth for table visual language.
 *
 * Does NOT belong here:
 *   Page-specific styles, component logic, colors (those stay in theme.js).
 *
 * How it fits:
 *   Imported by any page or component that renders a table.
 *   Spread into local styles objects — local overrides still possible.
 *
 * Usage:
 *   import tableStyles from '../styles/tableStyles';
 *   const styles = { ...tableStyles, myLocalStyle: { ... } };
 *
 *   Or selectively:
 *   <th style={tableStyles.th}>
 *   <th style={{ ...tableStyles.th, textAlign: 'right' }}>
 *
 * Pages using this:
 *   HoldingsPage.jsx, HistoryPage.jsx, SummaryPage.jsx (top movers tables)
 *   QuotePage.jsx (Step 6.12)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import theme from './theme';

const tableStyles = {

  // ── Table container ─────────────────────────────────────────────────────────
  //
  // overflow: hidden — clips table content to the card border radius.
  // Without this, table corners render square inside a rounded card.
  //
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

  // ── Header row ──────────────────────────────────────────────────────────────
  //
  // Visually distinct from data rows:
  //   backgroundColor: border color — noticeably darker than surfaceAlt rows
  //   borderBottom: 2px solid textMuted — heavier line separates header from data
  //   fontWeight: bold — stronger than data row text
  //   color: textPrimary — darker than textSecondary used in data labels
  //
  // textAlign: 'left' is the default — numeric columns override to 'right'
  // at the call site: <th style={{ ...tableStyles.th, textAlign: 'right' }}>
  //
  th: {
    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
    textAlign: 'left',
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.bold,
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    backgroundColor: theme.colors.border,
    borderBottom: `2px solid ${theme.colors.textMuted}`,
    whiteSpace: 'nowrap',
  },

  // ── Data rows ───────────────────────────────────────────────────────────────

  tr: {
    borderBottom: `1px solid ${theme.colors.border}`,
  },

  td: {
    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
    color: theme.colors.textPrimary,
    whiteSpace: 'nowrap',
  },

  // ── Ticker link ─────────────────────────────────────────────────────────────
  //
  // Used in Symbol column across all tables.
  // cursor: pointer — signals clickability without an underline.
  //
  tickerLink: {
    color: theme.colors.accent,
    fontWeight: theme.font.weight.semibold,
    cursor: 'pointer',
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  //
  // Shown when a table has no rows to display.
  //
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

export default tableStyles;