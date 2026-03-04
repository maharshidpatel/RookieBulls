/*
 * ExecutionConfirmation.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Centered modal shown after a trade executes successfully.
 *   Displays the execution summary — ticker, Operation, quantity, price, total.
 *   Calls onDone() when user dismisses — triggers page data refresh.
 *
 * Does NOT belong here:
 *   Trade execution logic, price fetching, panel state.
 *
 * Props:
 *   data   — { Operation, ticker, quantity, executedPrice, totalValue }
 *   onDone — () => void — called on dismiss, triggers Layout refresh cycle
 * ─────────────────────────────────────────────────────────────────────────────
 */

import theme from '../../styles/theme';

const ExecutionConfirmation = ({ data, onDone }) => {
  const { operation, ticker, quantity, executedPrice, totalValue } = data;

  const isBuy = operation === 'buy';

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style:                 'currency',
      currency:              'USD',
      minimumFractionDigits: 2,
    }).format(value);

  return (
    <>
      <div style={styles.backdrop} />

      <div style={styles.modal}>

        {/* Success icon + heading */}
        <div style={styles.header}>
          <div style={{
            ...styles.iconCircle,
            backgroundColor: isBuy
              ? theme.colors.successTint
              : theme.colors.dangerTint,
            borderColor: isBuy
              ? theme.colors.success
              : theme.colors.danger,
          }}>
            <span style={{
              fontSize: theme.font.size['2xl'],
              color:    isBuy ? theme.colors.success : theme.colors.danger,
            }}>
              ✓
            </span>
          </div>

          <h2 style={styles.title}>
            Order Executed
          </h2>

          <p style={{
            ...styles.subtitle,
            color: isBuy ? theme.colors.success : theme.colors.danger,
          }}>
            {isBuy ? 'Buy' : 'Sell'} order for {ticker} completed successfully.
          </p>
        </div>

        {/* Execution details */}
        <div style={styles.body}>

          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Symbol</span>
            <span style={styles.detailValue}>{ticker}</span>
          </div>

          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Operation</span>
            <span style={{
              ...styles.detailValue,
              color:      isBuy ? theme.colors.success : theme.colors.danger,
              fontWeight: theme.font.weight.bold,
            }}>
              {isBuy ? 'Buy' : 'Sell'}
            </span>
          </div>

          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Quantity</span>
            <span style={styles.detailValue}>{quantity}</span>
          </div>

          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Executed Price</span>
            <span style={styles.detailValue}>
              {formatCurrency(executedPrice)}
            </span>
          </div>

          <div style={styles.divider} />

          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Total Value</span>
            <span style={{
              ...styles.detailValue,
              fontSize:   theme.font.size.lg,
              fontWeight: theme.font.weight.bold,
              color:      isBuy ? theme.colors.danger : theme.colors.success,
            }}>
              {isBuy ? '-' : '+'}{formatCurrency(totalValue)}
            </span>
          </div>

        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.doneBtn} onClick={onDone}>
            Done
          </button>
        </div>

      </div>
    </>
  );
};


const styles = {
  backdrop: {
    position:        'fixed',
    inset:           0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex:          160,
  },

  modal: {
    position:        'fixed',
    top:             '50%',
    left:            '50%',
    transform:       'translate(-50%, -50%)',
    width:           '420px',
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.lg,
    boxShadow:       theme.shadow.lg,
    zIndex:          161,
    display:         'flex',
    flexDirection:   'column',
    overflow:        'hidden',
  },

  header: {
    padding:        `${theme.spacing[6]}`,
    borderBottom:   `1px solid ${theme.colors.border}`,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            theme.spacing[3],
    textAlign:      'center',
  },

  iconCircle: {
    width:        '56px',
    height:       '56px',
    borderRadius: theme.radius.full,
    borderWidth:  '2px',
    borderStyle:  'solid',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
  },

  title: {
    fontSize:   theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    color:      theme.colors.textPrimary,
  },

  subtitle: {
    fontSize: theme.font.size.sm,
    margin:   0,
  },

  body: {
    padding:       theme.spacing[6],
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[3],
  },

  detailRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
  },

  detailLabel: {
    fontSize: theme.font.size.sm,
    color:    theme.colors.textSecondary,
  },

  detailValue: {
    fontSize:   theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
    color:      theme.colors.textPrimary,
  },

  divider: {
    height:          '1px',
    backgroundColor: theme.colors.border,
    margin:          `${theme.spacing[1]} 0`,
  },

  footer: {
    padding:   `${theme.spacing[4]} ${theme.spacing[6]}`,
    borderTop: `1px solid ${theme.colors.border}`,
  },

  doneBtn: {
    width:           '100%',
    height:          '44px',
    fontSize:        theme.font.size.md,
    fontWeight:      theme.font.weight.semibold,
    color:           theme.colors.white,
    backgroundColor: theme.colors.accent,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.accent,
    borderRadius:    theme.radius.md,
    cursor:          'pointer',
    fontFamily:      theme.font.family,
  },
};

export default ExecutionConfirmation;