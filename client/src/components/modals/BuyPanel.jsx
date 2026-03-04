/*
 * BuyPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Slide-in side panel for entering a buy order.
 *   Fetches the current price on open.
 *   Calls onReview() with order data when user clicks Review Order.
 *   Calls onClose() when user cancels.
 *
 * Does NOT belong here:
 *   Trade execution (belongs in OrderConfirmation via Layout).
 *   Wallet data (available cash fetched fresh here via prop or context).
 *
 * Props:
 *   ticker    — string | null
 *               If set: input is readonly, panel pre-loaded for this stock.
 *               If null: TickerSearch shown — user picks the ticker.
 *   onReview  — (orderData) => void
 *               Called when user clicks Review Order.
 *               orderData shape: { operation, ticker, quantity, fetchedPrice }
 *   onClose   — () => void — called on Cancel or backdrop click
 *
 * Price fetch:
 *   getFullQuote() is called on mount (or when ticker changes).
 *   The fetched price is shown as "Current Market Price".
 *   It is passed to onReview() so OrderConfirmation can re-fetch
 *   and compare — price may change between panel open and review.
 *
 * Available cash:
 *   Fetched fresh on mount via fetchMyWallet().
 *   Shows the user how much they can spend before committing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { getFullQuote } from '../../services/market';
import { fetchMyWallet } from '../../services/wallet';
import TickerSearch from '../TickerSearch';
import theme from '../../styles/theme';

const BuyPanel = ({ ticker: initialTicker, onReview, onClose }) => {

  // activeTicker — the ticker currently loaded in the panel.
  // Starts as initialTicker (may be null if opened from SecondNav).
  const [activeTicker,  setActiveTicker]  = useState(initialTicker || null);

  const [quantity,      setQuantity]      = useState(1);
  const [quantityInput, setQuantityInput] = useState('1');
  const [quote,         setQuote]         = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [loadingPrice,  setLoadingPrice]  = useState(false);
  const [priceError,    setPriceError]    = useState(null);

  // Fetch price and wallet whenever activeTicker changes
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
        const [quoteData, walletData] = await Promise.all([
          getFullQuote(activeTicker),
          fetchMyWallet(),
        ]);
        setQuote(quoteData);
        setWalletBalance(walletData.balance);
      } catch {
        setPriceError('Unable to fetch price. Please try again.');
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
    walletBalance !== null &&
    estimatedTotal <= walletBalance;

  const handleReview = () => {
    if (!canReview) return;
    onReview({
      operation:         'buy',
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
      {/* Backdrop — click to close */}
      <div style={styles.backdrop} onClick={onClose} />

      {/* Panel */}
      <div style={styles.panel}>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Buy</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>

          {/* Ticker — readonly if pre-set, searchable if not */}
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

          {/* Price type — display only */}
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

          {/* Price info — shown once quote is loaded */}
          {activeTicker && (
            <div style={styles.infoCard}>
              {loadingPrice && (
                <p style={styles.infoLoading}>Fetching price...</p>
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
                      color: theme.colors.textPrimary,
                    }}>
                      {formatCurrency(estimatedTotal)}
                    </span>
                  </div>

                  <div style={styles.infoDivider} />

                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Available Cash</span>
                    <span style={{
                      ...styles.infoValue,
                      color: estimatedTotal > walletBalance
                        ? theme.colors.danger
                        : theme.colors.textPrimary,
                    }}>
                      {walletBalance !== null
                        ? formatCurrency(walletBalance)
                        : '...'}
                    </span>
                  </div>

                  {/* Insufficient funds warning */}
                  {estimatedTotal > walletBalance && (
                    <p style={styles.insufficientWarning}>
                      Insufficient funds for this order.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer — action buttons */}
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


// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {

  // Backdrop — full screen overlay behind panel
  backdrop: {
    position:        'fixed',
    inset:           0,
    backgroundColor: theme.colors.overlay,
    zIndex:          150,
  },

  // Panel — slides in from right, sits above backdrop
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
    color:      theme.colors.success,
  },

  closeBtn: {
    fontSize:        theme.font.size.md,
    color:           theme.colors.textMuted,
    background:      'none',
    border:          'none',
    cursor:          'pointer',
    padding:         theme.spacing[1],
    lineHeight:      1,
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
    fontSize:   theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color:      theme.colors.textSecondary,
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

  // Quantity row — minus button, input, plus button
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

  // Info card — price, estimated total, available cash
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

  insufficientWarning: {
    fontSize: theme.font.size.xs,
    color:    theme.colors.danger,
    margin:   0,
  },

  // Footer — Review Order + Cancel
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
    backgroundColor: theme.colors.success,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.success,
    borderRadius:    theme.radius.md,
    cursor:          'pointer',
    transition:      `background-color ${theme.transition.fast}`,
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

export default BuyPanel;