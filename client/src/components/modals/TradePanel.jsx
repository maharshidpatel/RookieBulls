/*
 * TradePanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Slide-in side panel for entering a buy or sell order.
 *   Replaces BuyPanel.jsx and SellPanel.jsx.
 *
 *   Operation dropdown at the top allows switching between Buy and Sell
 *   without closing and reopening the panel.
 *
 * Does NOT belong here:
 *   Trade execution (belongs in OrderConfirmation).
 *   Wallet or portfolio calculations.
 *
 * Props:
 *   initialOperation — 'buy' | 'sell' — sets the dropdown default
 *   ticker           — string | null
 *                      If set: ticker field is readonly.
 *                      If null: TickerSearch shown.
 *   onReview         — (orderData) => void
 *                      orderData: { operation, ticker, quantity, fetchedPrice }
 *   onClose          — () => void
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { getTickerPrice } from '../../services/market';
import { fetchMyWallet } from '../../services/wallet';
import { fetchMyPortfolio } from '../../services/portfolio';
import TickerSearch from '../TickerSearch';
import { useTheme } from '../../context/ThemeContext';
import { useMobile } from '../../hooks/useBreakpoint';

// ── LockIcon ──────────────────────────────────────────────────────────────────
// Inline SVG padlock — shown when ticker is pre-set and readonly.
const LockIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px', opacity: 0.5 }}
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const TradePanel = ({ 
  initialOperation = 'buy', 
  ticker: initialTicker,
  currentPrice: initialCurrentPrice = null,
  availableShares: initialAvailableShares = null,
  onReview,
  onClose
}) => {

  const theme    = useTheme();
  const isMobile = useMobile();
  const [operation,       setOperation]       = useState(initialOperation);
  const [activeTicker,    setActiveTicker]    = useState(initialTicker || null);
  const [quantity,        setQuantity]        = useState(1);
  const [quantityInput,   setQuantityInput]   = useState('1');
  const [quote,           setQuote]           = useState(null);
  const [walletBalance,   setWalletBalance]   = useState(null);
  const [availableShares, setAvailableShares] = useState(null);
  const [loadingPrice,    setLoadingPrice]    = useState(false);
  const [priceError,      setPriceError]      = useState(null);
  const [hovered,         setHovered]         = useState(null);

  const isBuy = operation === 'buy';

  // Fetch price + relevant context data when ticker or operation changes
  useEffect(() => {
    if (!activeTicker) return;

    setQuote(null);
    setPriceError(null);

    const load = async () => {
      setLoadingPrice(true);
      try {
        if (operation === 'buy') {
          if (initialCurrentPrice !== null) {
            const walletData = await fetchMyWallet();
            setQuote({ price: initialCurrentPrice });
            setWalletBalance(walletData.balance);
          } else {
            const [quoteData, walletData] = await Promise.all([
              getTickerPrice(activeTicker),
              fetchMyWallet(),
            ]);
            setQuote(quoteData);
            setWalletBalance(walletData.balance);
          }
          setAvailableShares(null);
        } else {
            const [quoteData, portfolioData] = await Promise.all([
              getTickerPrice(activeTicker),
              initialAvailableShares === null ? fetchMyPortfolio() : Promise.resolve(null),
            ]);
            setQuote(quoteData);
            if (initialAvailableShares !== null) {
              setAvailableShares(initialAvailableShares);
            } else {
              const position = portfolioData.positions.find(
                (p) => p.ticker === activeTicker
              );
              setAvailableShares(position ? position.quantity : 0);
            }
            setWalletBalance(null);
          }
      } catch {
        setPriceError('Unable to fetch data. Please try again.');
      } finally {
        setLoadingPrice(false);
      }
    };

    load();
  }, [activeTicker, operation, initialAvailableShares, initialCurrentPrice]);

  // Reset quantity when ticker or operation changes
  useEffect(() => {
    setQuantity(1);
    setQuantityInput('1');
  }, [activeTicker, operation]);

  const estimatedTotal = quote ? quote.price * quantity : null;

  const canReview = isBuy
    ? activeTicker && quote && quantity > 0 &&
      walletBalance !== null && estimatedTotal <= walletBalance
    : activeTicker && quote && quantity > 0 &&
      availableShares !== null && availableShares > 0 &&
      quantity <= availableShares;

  const handleReview = () => {
    if (!canReview) return;
    onReview({
      operation,
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
  
  // ── Styles ──────────────────────────────────────────────────────────────────

  const styles = {
    backdrop: {
      position:        'fixed',
      inset:           0,
      backgroundColor: theme.colors.overlay,
      zIndex:          150,
    },

    // Mobile: panel covers full width. Desktop: fixed 380px.
    panel: {
      position:        'fixed',
      top:             0,
      right:           0,
      bottom:          0,
      width:           isMobile ? '100%' : theme.layout.panelWidth,
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
      color:      theme.colors.textPrimary,
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

    // Operation dropdown
    select: {
      height:          theme.ui.inputHeight,
      padding:         `0 ${theme.spacing[3]}`,
      fontSize:        theme.font.size.sm,
      fontWeight:      theme.font.weight.medium,
      color:           theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
      borderWidth:     '1px',
      borderStyle:     'solid',
      borderColor:     theme.colors.border,
      borderRadius:    theme.radius.md,
      cursor:          'pointer',
      outline:         'none',
      fontFamily:      theme.font.family,
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

    readonlyHint: {
      fontSize:   theme.font.size.xs,
      color:      theme.colors.textMuted,
      fontWeight: theme.font.weight.normal,
      marginLeft: theme.spacing[2],
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

    // Review Order — neutral accent, no green/red
    reviewBtn: {
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
      transition:      `background-color ${theme.transition.fast}`,
    },

    reviewBtnHover: {
      backgroundColor: theme.colors.accentHover ?? theme.colors.accent,
      borderColor:     theme.colors.accentHover ?? theme.colors.accent,
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

    cancelBtnHover: {
      backgroundColor: theme.colors.surfaceAlt,
    },
  };
  
  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />

      <div style={styles.panel}>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Trade</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>

          {/* Operation dropdown — top of panel */}
          <div style={styles.field}>
            <label style={styles.label}>Operation</label>
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              style={styles.select}
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          {/* Ticker */}
          <div style={styles.field}>
            <label style={styles.label}>Symbol</label>
            {initialTicker ? (
              <div style={styles.readonlyTicker}>
                <LockIcon />
                {initialTicker}
                <span style={styles.readonlyHint}>Pre-set</span>
              </div>
            ) : (
              <TickerSearch
                width="100%"
                onSelect={(result) => setActiveTicker(result.ticker)}
                onClear={() => setActiveTicker(null)}
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

          {/* Info card — price and context data */}
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

                  {/* Buy context — available cash */}
                  {isBuy && (
                    <>
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
                      {estimatedTotal > walletBalance && (
                        <p style={styles.warning}>
                          Insufficient funds for this order.
                        </p>
                      )}
                    </>
                  )}

                  {/* Sell context — available shares */}
                  {!isBuy && (
                    <>
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
                      {availableShares === 0 && (
                        <p style={styles.warning}>
                          You do not hold any shares of {activeTicker}.
                        </p>
                      )}
                      {availableShares > 0 && quantity > availableShares && (
                        <p style={styles.warning}>
                          You only hold {availableShares}{' '}
                          {availableShares === 1 ? 'share' : 'shares'}.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            style={{
              ...styles.reviewBtn,
              ...(!canReview ? styles.reviewBtnDisabled : {}),
              ...(hovered === 'review' && canReview ? styles.reviewBtnHover : {}),
            }}
            onClick={handleReview}
            disabled={!canReview}
            onMouseEnter={() => setHovered('review')}
            onMouseLeave={() => setHovered(null)}
          >
            Review Order
          </button>
          <button
            style={{
              ...styles.cancelBtn,
              ...(hovered === 'cancel' ? styles.cancelBtnHover : {}),
            }}
            onClick={onClose}
            onMouseEnter={() => setHovered('cancel')}
            onMouseLeave={() => setHovered(null)}
          >
            Cancel
          </button>
        </div>

      </div>
    </>
  );
};

export default TradePanel;