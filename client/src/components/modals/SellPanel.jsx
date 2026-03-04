/*
 * SellPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Slide-in side panel for entering a sell order.
 *   Same structure as BuyPanel — key differences:
 *     - Title and Review button are red (danger) instead of green
 *     - Shows Available Quantity instead of Available Cash
 *     - Validates quantity against current position holdings
 *     - Fetches position data to know max sellable quantity
 *
 * Props:
 *   ticker   — string | null (same as BuyPanel)
 *   onReview — (orderData) => void
 *              orderData shape: { operation, ticker, quantity, fetchedPrice }
 *   onClose  — () => void
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { getFullQuote } from '../../services/market';
import { fetchMyPortfolio } from '../../services/portfolio';
import TickerSearch from '../TickerSearch';
import theme from '../../styles/theme';

const SellPanel = ({ ticker: initialTicker, onReview, onClose }) => {

  const [activeTicker,    setActiveTicker]    = useState(initialTicker || null);
  const [quantity,        setQuantity]        = useState(1);
  const [quantityInput, setQuantityInput] = useState('1');
  const [quote,           setQuote]           = useState(null);
  const [availableShares, setAvailableShares] = useState(null);
  const [loadingPrice,    setLoadingPrice]    = useState(false);
  const [priceError,      setPriceError]      = useState(null);

  // Fetch quote and current position quantity when ticker changes
  useEffect(() => {
    if (!activeTicker) return;

    // Clear previous ticker's data immediately — prevents stale
    // price or error from showing while new fetch is in flight.
    setQuote(null);
    setPriceError(null);

    const load = async () => {
      setLoadingPrice(true);
      setPriceError(null);
      try {
        const [quoteData, portfolioData] = await Promise.all([
          getFullQuote(activeTicker),
          fetchMyPortfolio(),
        ]);
        setQuote(quoteData);

        // Find the position for this ticker — may not exist
        const position = portfolioData.positions.find(
          (p) => p.ticker === activeTicker
        );
        // If user does not hold this ticker, availableShares = 0
        setAvailableShares(position ? position.quantity : 0);
      } catch {
        setPriceError('Unable to fetch data. Please try again.');
      } finally {
        setLoadingPrice(false);
      }
    };

    load();
  }, [activeTicker]);

  // Reset quantity to 1 when ticker changes
  useEffect(() => {
    setQuantity(1);
    setQuantityInput('1');
  }, [activeTicker]);


  const estimatedTotal = quote ? quote.price * quantity : null;

  const canReview =
    activeTicker &&
    quote &&
    quantity > 0 &&
    availableShares !== null &&
    availableShares > 0 &&
    quantity <= availableShares;

  const handleReview = () => {
    if (!canReview) return;
    onReview({
      operation:         'sell',
      ticker:       activeTicker,
      quantity,
      fetchedPrice: quote.price,
    });
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style:                 'currency',
      currency:              'USD',
      minimumFractionDigits: 2,
    }).format(value);


  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />

      <div style={styles.panel}>

        <div style={styles.header}>
          <h2 style={styles.title}>Sell</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>

          {/* Ticker */}
          <div style={styles.field}>
            <label style={styles.label}>Symbol</label>
            {initialTicker ? (
              <div style={styles.readonlyTicker}>{initialTicker}</div>
            ) : (
              <TickerSearch
                width="100%"
                onSelect={(result) => setActiveTicker(result.ticker)}
              />
            )}
          </div>

          {/* Order type */}
          <div style={styles.field}>
            <label style={styles.label}>Order Type</label>
            <div style={styles.readonlyValue}>At Market</div>
            <span style={styles.helperText}>
              Order executes immediately at current market price.
            </span>
          </div>

          {/* Quantity */}
          <div style={styles.field}>
            <label style={styles.label}>Quantity</label>
            <div style={styles.quantityRow}>
              <button
                style={styles.qtyBtn}
                onClick={() => {
                  const next = Math.max(1, quantity - 1);
                  setQuantity(next);
                  setQuantityInput(String(next));
                }}
              >
                −
              </button>
              <input
                type="number"
                min="1"
                value={quantityInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setQuantityInput(raw);
                  const val = parseInt(raw, 10);
                  if (!isNaN(val) && val > 0) setQuantity(val);
                }}
                onBlur={() => {
                  // On blur — if field is empty or invalid, reset to 1
                  if (!quantityInput || parseInt(quantityInput, 10) < 1) {
                    setQuantity(1);
                    setQuantityInput('1');
                  }
                }}
                style={styles.qtyInput}
              />
              <button
                style={styles.qtyBtn}
                onClick={() => {
                  const next = quantity + 1;
                  setQuantity(next);
                  setQuantityInput(String(next));
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Price info */}
          {activeTicker && (
            <div style={styles.infoCard}>
              {loadingPrice && (
                <p style={styles.infoLoading}>Fetching data...</p>
              )}
              {priceError && (
                <p style={styles.infoError}>{priceError}</p>
              )}
              {quote && !loadingPrice && (
                <>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Current Market Price</span>
                    <span style={styles.infoValue}>
                      {formatCurrency(quote.price)}
                    </span>
                  </div>

                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Estimated Total</span>
                    <span style={{
                      ...styles.infoValue,
                      fontWeight: theme.font.weight.bold,
                      color:      theme.colors.textPrimary,
                    }}>
                      {formatCurrency(estimatedTotal)}
                    </span>
                  </div>

                  <div style={styles.infoDivider} />

                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Available Quantity</span>
                    <span style={{
                      ...styles.infoValue,
                      color: quantity > availableShares
                        ? theme.colors.danger
                        : theme.colors.textPrimary,
                    }}>
                      {availableShares !== null ? availableShares : '...'}
                    </span>
                  </div>

                  {/* No position warning */}
                  {availableShares === 0 && (
                    <p style={styles.warning}>
                      You do not hold any shares of {activeTicker}.
                    </p>
                  )}

                  {/* Oversell warning */}
                  {availableShares > 0 && quantity > availableShares && (
                    <p style={styles.warning}>
                      You only hold {availableShares}{' '}
                      {availableShares === 1 ? 'share' : 'shares'}.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

        </div>

        <div style={styles.footer}>
          <button
            style={{
              ...styles.reviewBtn,
              ...(!canReview ? styles.reviewBtnDisabled : {}),
            }}
            onClick={handleReview}
            disabled={!canReview}
          >
            Review Order
          </button>
          <button style={styles.cancelBtn} onClick={onClose}>
            Cancel
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
    backgroundColor: theme.colors.overlay,
    zIndex:          150,
  },

  panel: {
    position:        'fixed',
    top:             0,
    right:           0,
    bottom:          0,
    width:           theme.layout.panelWidth,
    backgroundColor: theme.colors.surface,
    boxShadow:       theme.shadow.lg,
    zIndex:          151,
    display:         'flex',
    flexDirection:   'column',
    overflow:        'hidden',
  },

  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        `${theme.spacing[4]} ${theme.spacing[6]}`,
    borderBottom:   `1px solid ${theme.colors.border}`,
  },

  title: {
    fontSize:   theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    color:      theme.colors.danger,
  },

  closeBtn: {
    fontSize:   theme.font.size.md,
    color:      theme.colors.textMuted,
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    padding:    theme.spacing[1],
    lineHeight: 1,
  },

  body: {
    flex:          1,
    overflowY:     'auto',
    padding:       theme.spacing[6],
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[5],
  },

  field: {
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[2],
  },

  label: {
    fontSize:      theme.font.size.xs,
    fontWeight:    theme.font.weight.semibold,
    color:         theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },

  readonlyTicker: {
    height:          theme.ui.inputHeight,
    padding:         `0 ${theme.spacing[3]}`,
    display:         'flex',
    alignItems:      'center',
    fontSize:        theme.font.size.md,
    fontWeight:      theme.font.weight.bold,
    color:           theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
  },

  readonlyValue: {
    height:          theme.ui.inputHeight,
    padding:         `0 ${theme.spacing[3]}`,
    display:         'flex',
    alignItems:      'center',
    fontSize:        theme.font.size.sm,
    color:           theme.colors.textSecondary,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
  },

  helperText: {
    fontSize: theme.font.size.xs,
    color:    theme.colors.textMuted,
  },

  quantityRow: {
    display: 'flex',
    gap:     theme.spacing[2],
  },

  qtyBtn: {
    width:           '38px',
    height:          theme.ui.inputHeight,
    fontSize:        theme.font.size.lg,
    fontWeight:      theme.font.weight.medium,
    color:           theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
    cursor:          'pointer',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    userSelect:      'none',
  },

  qtyInput: {
    flex:            1,
    height:          theme.ui.inputHeight,
    textAlign:       'center',
    fontSize:        theme.font.size.md,
    fontWeight:      theme.font.weight.semibold,
    color:           theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
    outline:         'none',
    fontFamily:      theme.font.family,
  },

  infoCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius:    theme.radius.md,
    border:          `1px solid ${theme.colors.border}`,
    padding:         theme.spacing[4],
    display:         'flex',
    flexDirection:   'column',
    gap:             theme.spacing[3],
  },

  infoLoading: {
    fontSize: theme.font.size.sm,
    color:    theme.colors.textMuted,
    margin:   0,
  },

  infoError: {
    fontSize: theme.font.size.sm,
    color:    theme.colors.danger,
    margin:   0,
  },

  infoRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
  },

  infoLabel: {
    fontSize: theme.font.size.sm,
    color:    theme.colors.textSecondary,
  },

  infoValue: {
    fontSize:   theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
    color:      theme.colors.textPrimary,
  },

  infoDivider: {
    height:          '1px',
    backgroundColor: theme.colors.border,
  },

  warning: {
    fontSize: theme.font.size.xs,
    color:    theme.colors.danger,
    margin:   0,
  },

  footer: {
    padding:       `${theme.spacing[4]} ${theme.spacing[6]}`,
    borderTop:     `1px solid ${theme.colors.border}`,
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[2],
  },

  reviewBtn: {
    height:          '44px',
    fontSize:        theme.font.size.md,
    fontWeight:      theme.font.weight.semibold,
    color:           theme.colors.white,
    backgroundColor: theme.colors.danger,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.danger,
    borderRadius:    theme.radius.md,
    cursor:          'pointer',
    fontFamily:      theme.font.family,
  },

  reviewBtnDisabled: {
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

export default SellPanel;