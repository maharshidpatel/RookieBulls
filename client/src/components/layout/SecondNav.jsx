/*
 * SecondNav.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Fixed second navigation bar, rendered directly below TopNav.
 *
 *   Left side:  Page navigation — Summary, Holdings, Quote, History.
 *               Rendered as pill buttons with border.
 *               Active page: accent color fill.
 *               Hover: light background fill.
 *               Market status pill sits after History on the left.
 *
 *   Right side: Buy, Sell, Get a Quote action buttons.
 *               Buy and Sell disabled when market is closed.
 *
 * Quote nav button:
 *   /quote/:ticker requires a ticker — there is no plain /quote route.
 *   The Quote button is a visual indicator only. It does not navigate.
 *   It highlights when the current path starts with /quote (user arrived
 *   via a ticker click on another page).
 *   Step 6.12 revisits this when QuotePage is fully built.
 *
 * Props:
 *   onBuyClick   — opens Buy panel in Layout
 *   onSellClick  — opens Sell panel in Layout
 *   onQuoteClick — opens Get Quote popup in Layout
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getMarketStatus } from '../../services/market';
import theme from '../../styles/theme';

const SecondNav = ({ onBuyClick, onSellClick, onQuoteClick }) => {
  const location = useLocation();

  const [marketStatus, setMarketStatus]   = useState(null);
  const [statusError, setStatusError]     = useState(false);
  const [hovered, setHovered]             = useState({
    buy: false, sell: false, quote: false,
  });
  const [navHovered, setNavHovered]       = useState(null);

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

  // ── Page nav entries ───────────────────────────────────────────────────────
  //
  // Quote has no path — it is a non-navigating indicator button.
  // isQuote flag distinguishes it from the Link-based buttons.
  //
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

          // Compute pill style: active beats hover beats default
          const pillStyle = {
            ...styles.navPill,
            ...(isActive
              ? styles.navPillActive
              : isHovered
                ? styles.navPillHover
                : {}),
            // Quote is not clickable when not already on a quote page
            ...(isQuote && !isActive ? { cursor: 'default', opacity: 0.6 } : {}),
          };

          // Quote button — not a Link, just a styled span indicator
          if (isQuote) {
            return (
              <span
                key={label}
                style={pillStyle}
                onMouseEnter={() => !isActive && setNavHovered(null)}
              >
                {label}
              </span>
            );
          }

          // All other nav items are Links
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

        {/* Market status pill — visible after first fetch */}
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
          Get a Quote
        </button>

      </div>

    </nav>
  );
};


// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  nav: {
    position: 'fixed',
    top: theme.layout.topNavHeight,
    left: 0,
    right: 0,
    height: theme.layout.secondNavHeight,
    backgroundColor: theme.colors.surface,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${theme.spacing[6]}`,
    zIndex: 99,
  },

  left: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing[1],
  },

  right: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing[2],
  },

  // ── Page nav pills ──────────────────────────────────────────────────────────
  //
  // Default:  grey text, grey border, transparent background
  // Hover:    accent blue text, accent blue border, light accent tint background
  // Active:   white text, accent filled background, accent border
  //
  navPill: {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
    color: theme.colors.textSecondary,
    textDecoration: 'none',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.full,
    padding: `4px ${theme.spacing[3]}`,
    cursor: 'pointer',
    transition: `color ${theme.transition.fast}, background-color ${theme.transition.fast}, border-color ${theme.transition.fast}`,
    userSelect: 'none',
    display: 'inline-block',
  },

  navPillHover: {
    color: theme.colors.accent,
    backgroundColor: theme.colors.accentTint,
    borderColor: theme.colors.accent,
  },

  navPillActive: {
    color: theme.colors.white,
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
    fontWeight: theme.font.weight.semibold,
  },

  // ── Market status pill ──────────────────────────────────────────────────────

  statusOpen: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.statusOpenText,
    backgroundColor: theme.colors.statusOpenBg,
    padding: `3px ${theme.spacing[2]}`,
    borderRadius: theme.radius.full,
    border: `1px solid ${theme.colors.statusOpenBorder}`,
    marginLeft: theme.spacing[2],
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },

  statusClosed: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.statusClosedText,
    backgroundColor: theme.colors.statusClosedBg,
    padding: `3px ${theme.spacing[2]}`,
    borderRadius: theme.radius.full,
    border: `1px solid ${theme.colors.statusClosedBorder}`,
    marginLeft: theme.spacing[2],
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },

  statusUnknown: {
    fontSize: theme.font.size.xs,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceAlt,
    padding: `3px ${theme.spacing[2]}`,
    borderRadius: theme.radius.full,
    border: `1px solid ${theme.colors.border}`,
    marginLeft: theme.spacing[2],
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },

  // ── Action button pills ─────────────────────────────────────────────────────
  //
  // Default:  solid color fill, white text
  // Hover:    tint background + colored border + colored text (inversion pattern)
  // Disabled: grey fill, muted text, not-allowed cursor
  //
  actionBtn: {
    height: theme.ui.actionPillHeight,
    padding: `0 ${theme.spacing[3]}`,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    borderRadius: theme.radius.full,
    border: '1px solid',
    cursor: 'pointer',
    transition: `color ${theme.transition.fast}, background-color ${theme.transition.fast}, border-color ${theme.transition.fast}`,
    userSelect: 'none',
  },

  // Buy — green text/border default, green tint on hover
  buyBtn: {
    color: theme.colors.white,
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.success,
  },
  buyBtnHover: {
    color: theme.colors.successHover,
    borderColor: theme.colors.successHover,
    backgroundColor: theme.colors.successTint,
  },

  // Sell — red text/border default, red tint on hover
  sellBtn: {
    color: theme.colors.white,
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.danger,
  },
  sellBtnHover: {
    color: theme.colors.dangerHover,
    borderColor: theme.colors.dangerHover,
    backgroundColor: theme.colors.dangerTint,
  },

  // Get a Quote — blue text/border default, blue tint on hover
  quoteBtn: {
    color: theme.colors.white,
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.info,
  },
  quoteBtnHover: {
    color: theme.colors.infoHover,
    borderColor: theme.colors.infoHover,
    backgroundColor: theme.colors.infoTint,
  },

  disabledBtn: {
    color: theme.colors.textMuted,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.border,
    cursor: 'not-allowed',
  },
};

export default SecondNav;