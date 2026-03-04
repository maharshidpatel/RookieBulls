/*
 * OrderConfirmation.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Centered modal that appears after the user clicks Review Order.
 *   Re-fetches the current price before showing the confirmation —
 *   price may have moved between panel open and review click.
 *   Executes the trade when user clicks Confirm.
 *
 * Does NOT belong here:
 *   Panel state, quantity input, ticker search.
 *
 * Props:
 *   data      — { Operation, ticker, quantity, fetchedPrice }
 *               Passed from Layout which received it from BuyPanel/SellPanel.
 *   onExecuted — (executionData) => void
 *               Called after successful trade execution.
 *               executionData: { Operation, ticker, quantity, executedPrice, totalValue }
 *   onCancel  — () => void — returns user to the panel
 *
 * Price re-fetch:
 *   A fresh price is fetched on mount.
 *   If re-fetch fails, falls back to fetchedPrice from the panel.
 *   The price used for display is always shown clearly to the user.
 *   The actual execution price is determined server-side.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { getFullQuote } from '../../services/market';
import { executeBuy, executeSell } from '../../services/trade';
import theme from '../../styles/theme';

const OrderConfirmation = ({ data, onExecuted, onCancel }) => {
  const { operation, ticker, quantity, fetchedPrice } = data;

  const [currentPrice, setCurrentPrice] = useState(fetchedPrice);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [executing,    setExecuting]    = useState(false);
  const [execError,    setExecError]    = useState(null);

  // Re-fetch price on mount — get the freshest price before confirming.
  // Falls back to fetchedPrice from the panel if this fails.
  useEffect(() => {
    const refresh = async () => {
      try {
        const quote = await getFullQuote(ticker);
        setCurrentPrice(quote.price);
      } catch {
        // Non-fatal — panel price is still valid enough to show
      } finally {
        setLoadingPrice(false);
      }
    };
    refresh();
  }, [ticker]);

  const estimatedTotal = currentPrice * quantity;

  const isBuy = operation === 'buy';

  const handleConfirm = async () => {
    setExecuting(true);
    setExecError(null);
    try {
      if (isBuy) {
        await executeBuy(ticker, quantity);
      } else {
        await executeSell(ticker, quantity);
      }

      onExecuted({
        operation,
        ticker,
        quantity,
        executedPrice: currentPrice,
        totalValue:    estimatedTotal,
      });
    } catch (err) {
      // Surface the server error message — e.g. insufficient funds
      const message =
        err.response?.data?.message ||
        'Trade failed. Please try again.';
      setExecError(message);
      setExecuting(false);
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style:                 'currency',
      currency:              'USD',
      minimumFractionDigits: 2,
    }).format(value);

  return (
    <>
      {/* Full screen backdrop — darker than panel backdrop */}
      <div style={styles.backdrop} onClick={!executing ? onCancel : undefined} />

      {/* Centered modal */}
      <div style={styles.modal}>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            Review Order
          </h2> 
        </div>

        {/* Order details */}
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
            <span style={styles.detailLabel}>Order Type</span>
            <span style={styles.detailValue}>At Market</span>
          </div>

          <div style={styles.divider} />

          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Market Price</span>
            <span style={styles.detailValue}>
              {loadingPrice ? 'Refreshing...' : formatCurrency(currentPrice)}
            </span>
          </div>

          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Estimated Total</span>
            <span style={{
              ...styles.detailValue,
              fontSize:   theme.font.size.lg,
              fontWeight: theme.font.weight.bold,
              color:      theme.colors.textPrimary,
            }}>
              {loadingPrice ? '...' : formatCurrency(estimatedTotal)}
            </span>
          </div>

          {/* Disclaimer */}
          <p style={styles.disclaimer}>
            Final execution price is determined at the time of order processing
            and may differ slightly from the displayed price.
          </p>

          {/* Execution error */}
          {execError && (
            <div style={styles.errorBox}>
              {execError}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            style={{
              ...styles.confirmBtn,
              ...(executing || loadingPrice ? styles.confirmBtnDisabled : {}),
            }}
            onClick={handleConfirm}
            disabled={executing || loadingPrice}
          >
            {executing ? 'Executing...' : 'Confirm Order'}
          </button>

          <button
            style={{
              ...styles.cancelBtn,
              ...(executing ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
            }}
            onClick={!executing ? onCancel : undefined}
            disabled={executing}
          >
            Go Back
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
    padding:      `${theme.spacing[5]} ${theme.spacing[6]}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },

  title: {
    fontSize:   theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    color:      theme.colors.textPrimary,
  },

  body: {
    padding: theme.spacing[6],
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

  disclaimer: {
    fontSize:  theme.font.size.xs,
    color:     theme.colors.textMuted,
    margin:    0,
    marginTop: theme.spacing[2],
    lineHeight: theme.font.lineHeight.relaxed,
  },

  errorBox: {
    backgroundColor: theme.colors.dangerTint,
    border:          `1px solid ${theme.colors.danger}`,
    borderRadius:    theme.radius.md,
    padding:         `${theme.spacing[2]} ${theme.spacing[3]}`,
    fontSize:        theme.font.size.sm,
    color:           theme.colors.danger,
  },

  footer: {
    padding:       `${theme.spacing[4]} ${theme.spacing[6]}`,
    borderTop:     `1px solid ${theme.colors.border}`,
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[2],
  },

  confirmBtn: {
    height:      '44px',
    fontSize:    theme.font.size.md,
    fontWeight:  theme.font.weight.semibold,
    color:       theme.colors.white,
    backgroundColor: theme.colors.accent,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor:     theme.colors.accent,
    borderRadius: theme.radius.md,
    cursor:      'pointer',
    fontFamily:  theme.font.family,
  },

  confirmBtnDisabled: {
    backgroundColor: theme.colors.border,
    borderColor:     theme.colors.border,
    color:           theme.colors.textMuted,
    cursor:          'not-allowed',
  },

  cancelBtn: {
    height:          '44px',
    fontSize:        theme.font.size.md,
    fontWeight:      theme.font.weight.medium,
    color:           theme.colors.textSecondary,
    backgroundColor: 'transparent',
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
    cursor:          'pointer',
    fontFamily:      theme.font.family,
  },
};

export default OrderConfirmation;