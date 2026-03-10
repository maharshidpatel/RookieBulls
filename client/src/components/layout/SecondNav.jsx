/*
 * SecondNav.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Fixed second navigation bar, rendered directly below TopNav.
 *
 *   Left side:  Page navigation — Summary, Holdings, Quote, History.
 *               Quote pill navigates to last visited quote page.
 *               If no quote has been visited yet, opens GetQuotePopup instead.
 *
 *   Right side: Buy, Sell, Get a Quote action buttons.
 *               Buy and Sell disabled when market is closed.
 *               Get a Quote has magnifying glass icon prefix.
 *
 * Props:
 *   onBuyClick   — opens Buy panel in Layout
 *   onSellClick  — opens Sell panel in Layout
 *   onQuoteClick — opens Get Quote popup in Layout (fallback when no last ticker)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getMarketStatus } from '../../services/market';
import theme from '../../styles/theme';

// ── SearchIcon ────────────────────────────────────────────────────────────────
// Inline SVG magnifying glass — used in Get a Quote button.
const SearchIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '5px', marginTop: '-1px' }}
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const SecondNav = ({ onBuyClick, onSellClick, onQuoteClick }) => {
  const location = useLocation();
  const navigate  = useNavigate();

  const [marketStatus, setMarketStatus] = useState(null);
  const [statusError,  setStatusError]  = useState(false);
  const [hovered,      setHovered]      = useState({
    buy: false, sell: false, quote: false,
  });
  const [navHovered, setNavHovered] = useState(null);

  // ── Market status polling ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getMarketStatus();
        setMarketStatus(data);
        setStatusError(false);
      } catch {
        setMarketStatus({ isOpen: false });
        setStatusError(true);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const isMarketOpen = marketStatus?.isOpen ?? false;

  // ── Quote pill click handler ───────────────────────────────────────────────
  //
  // Reads the last ticker the user visited from localStorage.
  // If found: navigate directly to /quote/:ticker
  // If not:   fall back to opening the GetQuotePopup search
  //
  // QuotePage stores the ticker in localStorage on every load.
  const handleQuotePillClick = () => {
    const lastTicker = localStorage.getItem('lastQuoteTicker');
    if (lastTicker) {
      navigate(`/quote/${lastTicker}`);
    } else {
      onQuoteClick();
    }
  };

  // ── Page nav entries ───────────────────────────────────────────────────────
  const pageLinks = [
    { label: 'Summary',  path: '/summary',  activePrefix: '/summary',  isQuote: false },
    { label: 'Holdings', path: '/holdings', activePrefix: '/holdings', isQuote: false },
    { label: 'Quote',    path: null,        activePrefix: '/quote',    isQuote: true  },
    { label: 'History',  path: '/history',  activePrefix: '/history',  isQuote: false },
  ];

  return (
    <nav style={styles.nav}>

      {/* ── Left: page nav pills + market status ──────────────────────────── */}
      <div style={styles.left}>

        {pageLinks.map(({ label, path, activePrefix, isQuote }) => {
          const isActive  = location.pathname.startsWith(activePrefix);
          const isHovered = navHovered === label;

          const pillStyle = {
            ...styles.navPill,
            ...(isActive
              ? styles.navPillActive
              : isHovered
                ? styles.navPillHover
                : {}),
          };

          // Quote pill — always clickable.
          // Navigates to last visited quote or opens popup if none.
          if (isQuote) {
            return (
              <span
                key={label}
                style={{ ...pillStyle, cursor: 'pointer' }}
                onClick={handleQuotePillClick}
                onMouseEnter={() => setNavHovered(label)}
                onMouseLeave={() => setNavHovered(null)}
              >
                {label}
              </span>
            );
          }

          return (
            <Link
              key={label}
              to={path}
              style={pillStyle}
              onMouseEnter={() => setNavHovered(label)}
              onMouseLeave={() => setNavHovered(null)}
            >
              {label}
            </Link>
          );
        })}

        {/* Market status pill */}
        {marketStatus !== null && (
          <span style={
            statusError
              ? styles.statusUnknown
              : (isMarketOpen ? styles.statusOpen : styles.statusClosed)
          }>
            ●&nbsp;
            {statusError
              ? 'Unavailable'
              : (isMarketOpen ? 'Market Open' : 'Market Closed')
            }
          </span>
        )}

      </div>

      {/* ── Right: action buttons ──────────────────────────────────────────── */}
      <div style={styles.right}>

        <button
          style={{
            ...styles.actionBtn,
            ...(isMarketOpen
              ? (hovered.buy ? styles.buyBtnHover : styles.buyBtn)
              : styles.disabledBtn),
          }}
          disabled={!isMarketOpen}
          onClick={() => isMarketOpen && onBuyClick()}
          onMouseEnter={() => setHovered(h => ({ ...h, buy: true }))}
          onMouseLeave={() => setHovered(h => ({ ...h, buy: false }))}
        >
          Buy
        </button>

        <button
          style={{
            ...styles.actionBtn,
            ...(isMarketOpen
              ? (hovered.sell ? styles.sellBtnHover : styles.sellBtn)
              : styles.disabledBtn),
          }}
          disabled={!isMarketOpen}
          onClick={() => isMarketOpen && onSellClick()}
          onMouseEnter={() => setHovered(h => ({ ...h, sell: true }))}
          onMouseLeave={() => setHovered(h => ({ ...h, sell: false }))}
        >
          Sell
        </button>

        <button
          style={{
            ...styles.actionBtn,
            ...(hovered.quote ? styles.quoteBtnHover : styles.quoteBtn),
          }}
          onClick={onQuoteClick}
          onMouseEnter={() => setHovered(h => ({ ...h, quote: true }))}
          onMouseLeave={() => setHovered(h => ({ ...h, quote: false }))}
        >
          <SearchIcon />
          Get a Quote
        </button>

      </div>

    </nav>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  nav: {
    position:        'fixed',
    top:             theme.layout.topNavHeight,
    left:            0,
    right:           0,
    height:          theme.layout.secondNavHeight,
    backgroundColor: theme.colors.surface,
    borderBottom:    `1px solid ${theme.colors.border}`,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         `0 ${theme.spacing[6]}`,
    zIndex:          99,
  },
  left: {
    display:    'flex',
    alignItems: 'center',
    gap:        theme.spacing[1],
  },
  right: {
    display:    'flex',
    alignItems: 'center',
    gap:        theme.spacing[2],
  },
  navPill: {
    fontSize:        theme.font.size.sm,
    fontWeight:      theme.font.weight.medium,
    color:           theme.colors.textSecondary,
    textDecoration:  'none',
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.full,
    padding:         `4px ${theme.spacing[3]}`,
    cursor:          'pointer',
    transition:      `color ${theme.transition.fast}, background-color ${theme.transition.fast}, border-color ${theme.transition.fast}`,
    userSelect:      'none',
    display:         'inline-block',
  },
  navPillHover: {
    color:           theme.colors.accent,
    backgroundColor: theme.colors.accentTint,
    borderColor:     theme.colors.accent,
  },
  navPillActive: {
    color:           theme.colors.white,
    backgroundColor: theme.colors.accent,
    borderColor:     theme.colors.accent,
    fontWeight:      theme.font.weight.semibold,
  },
  statusOpen: {
    fontSize:        theme.font.size.xs,
    fontWeight:      theme.font.weight.semibold,
    color:           theme.colors.statusOpenText,
    backgroundColor: theme.colors.statusOpenBg,
    padding:         `3px ${theme.spacing[2]}`,
    borderRadius:    theme.radius.full,
    border:          `1px solid ${theme.colors.statusOpenBorder}`,
    marginLeft:      theme.spacing[2],
    whiteSpace:      'nowrap',
    userSelect:      'none',
  },
  statusClosed: {
    fontSize:        theme.font.size.xs,
    fontWeight:      theme.font.weight.semibold,
    color:           theme.colors.statusClosedText,
    backgroundColor: theme.colors.statusClosedBg,
    padding:         `3px ${theme.spacing[2]}`,
    borderRadius:    theme.radius.full,
    border:          `1px solid ${theme.colors.statusClosedBorder}`,
    marginLeft:      theme.spacing[2],
    whiteSpace:      'nowrap',
    userSelect:      'none',
  },
  statusUnknown: {
    fontSize:        theme.font.size.xs,
    color:           theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceAlt,
    padding:         `3px ${theme.spacing[2]}`,
    borderRadius:    theme.radius.full,
    border:          `1px solid ${theme.colors.border}`,
    marginLeft:      theme.spacing[2],
    whiteSpace:      'nowrap',
    userSelect:      'none',
  },
  actionBtn: {
    height:       theme.ui.actionPillHeight,
    padding:      `0 ${theme.spacing[3]}`,
    fontSize:     theme.font.size.sm,
    fontWeight:   theme.font.weight.semibold,
    borderRadius: theme.radius.full,
    borderWidth:  '1px',
    borderStyle:  'solid',
    cursor:       'pointer',
    transition:   `color ${theme.transition.fast}, background-color ${theme.transition.fast}, border-color ${theme.transition.fast}`,
    userSelect:   'none',
  },
  buyBtn: {
    color:           theme.colors.white,
    borderColor:     theme.colors.success,
    backgroundColor: theme.colors.success,
  },
  buyBtnHover: {
    color:           theme.colors.successHover,
    borderColor:     theme.colors.successHover,
    backgroundColor: theme.colors.successTint,
  },
  sellBtn: {
    color:           theme.colors.white,
    borderColor:     theme.colors.danger,
    backgroundColor: theme.colors.danger,
  },
  sellBtnHover: {
    color:           theme.colors.dangerHover,
    borderColor:     theme.colors.dangerHover,
    backgroundColor: theme.colors.dangerTint,
  },
  quoteBtn: {
    color:           theme.colors.white,
    borderColor:     theme.colors.info,
    backgroundColor: theme.colors.info,
  },
  quoteBtnHover: {
    color:           theme.colors.infoHover,
    borderColor:     theme.colors.infoHover,
    backgroundColor: theme.colors.infoTint,
  },
  disabledBtn: {
    color:           theme.colors.textMuted,
    borderColor:     theme.colors.border,
    backgroundColor: theme.colors.border,
    cursor:          'not-allowed',
  },
};

export default SecondNav;