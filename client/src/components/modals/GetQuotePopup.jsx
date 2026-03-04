/*
 * GetQuotePopup.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Centered search popup — user finds a ticker and lands on its QuotePage.
 *   No quote data fetched here — that belongs on QuotePage.
 *
 * Does NOT belong here:
 *   Quote data display, trade execution, OHLC stats.
 *
 * Props:
 *   onClose — () => void
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useNavigate } from 'react-router-dom';
import TickerSearch from '../TickerSearch';
import theme from '../../styles/theme';

const GetQuotePopup = ({ onClose }) => {
  const navigate = useNavigate();

  const handleTickerSelect = (result) => {
    onClose();
    navigate(`/quote/${result.ticker}`);
  };

  return (
    <>
      {/* Backdrop */}
      <div style={styles.backdrop} onClick={onClose} />

      {/* Popup */}
      <div style={styles.modal}>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Get a Quote</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Body — search only, dropdown allowed to overflow */}
        <div style={styles.body}>
          <p style={styles.hint}>
            Search by symbol or company name to view the full quote page.
          </p>
          <TickerSearch
            width="100%"
            onSelect={handleTickerSelect}
          />
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

  modal: {
    position:        'fixed',
    top:             '20%',       // sits in upper third — leaves room for dropdown below
    left:            '50%',
    transform:       'translateX(-50%)',
    width:           '440px',
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.lg,
    boxShadow:       theme.shadow.lg,
    zIndex:          151,
    display:         'flex',
    flexDirection:   'column',
    // No overflow:hidden — allows TickerSearch dropdown to extend below modal
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
    padding:       theme.spacing[6],
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[3],
    // paddingBottom large enough so dropdown has visual breathing room
    paddingBottom: theme.spacing[8],
  },

  hint: {
    fontSize: theme.font.size.sm,
    color:    theme.colors.textMuted,
    margin:   0,
  },
};

export default GetQuotePopup;