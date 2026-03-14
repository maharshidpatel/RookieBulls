/*
 * QuotePage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Full quote view for a single ticker.
 *   Fetches quote, profile, and candles in parallel on load.
 *   Polls quote only every 15s — profile and candles do not change on that cadence.
 *   Flash effect on price change — green background if price went up,
 *   red background if price went down. Clears after 1.5 seconds.
 *
 * Chart ranges: 5D, 1M, 3M, 6M, 1Y, 2Y, 5Y, All
 *   All served from a single full-history candle dataset fetched on load.
 *   No extra API calls when switching ranges — all slicing is done client-side.
 *   Cache expires at next market open (9:30 AM ET).
 *
 * Does NOT belong here:
 *   Trade execution, wallet data, portfolio calculations.
 *
 * Route: /quote/:ticker
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getFullQuote, getStockProfile, getCandles } from '../services/market';
import theme from '../styles/theme';

// Range definitions — calendarDays used to slice the full history dataset.
// null = no filter, show entire dataset (All range).
const RANGES = [
  { label: '5D',  calendarDays: 7    },
  { label: '1M',  calendarDays: 30   },
  { label: '3M',  calendarDays: 90   },
  { label: '6M',  calendarDays: 180  },
  { label: '1Y',  calendarDays: 365  },
  { label: '2Y',  calendarDays: 730  },
  { label: '5Y',  calendarDays: 1825 },
  { label: 'All', calendarDays: null },
];

const xAxisConfig = {
  '5D': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    },
    interval: 0,
  },
  '1M': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    interval: 4,
  },
  '3M': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    interval: 9,
  },
  '6M': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short' });
    },
    interval: 19,
  },
  '1Y': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short' });
    },
    interval: 19,
  },
  '2Y': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    },
    interval: 49,
  },
  '5Y': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.getFullYear().toString();
    },
    interval: 'preserveStartEnd',
  },
  'All': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.getFullYear().toString();
    },
    interval: 'preserveStartEnd',
  },
};

const QuotePage = () => {
  const { ticker } = useParams();
  const { openBuyPanel, openSellPanel, refreshKey } = useOutletContext();

  const [quote,      setQuote]      = useState(null);
  const [profile,    setProfile]    = useState(null);
  const [candles,    setCandles]    = useState([]);
  const [range,      setRange]      = useState('3M');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [hovered,    setHovered]    = useState(null);
  const [isInitial,  setIsInitial]  = useState(true);

  // priceFlash — 'up' | 'down' | null
  // Set when a poll detects a price change. Cleared after 1.5 seconds.
  // Controls background color on the price block.
  const [priceFlash, setPriceFlash] = useState(null);

  // prevPriceRef — holds the last known price between polls.
  // useRef so it does not cause a re-render when updated.
  const prevPriceRef = useRef(null);

  // ── Initial full load ──────────────────────────────────────────────────────
  //
  // Fetches quote, profile, and candles in parallel.
  // Only runs on ticker change or after a trade (refreshKey).
  // Profile and candles are not re-fetched on polls — they are stable.
  const loadData = useCallback(async () => {
    if (!ticker) return;
    localStorage.setItem('lastQuoteTicker', ticker.toUpperCase());
    setLoading(true);
    setError(null);

    try {
      // Load quote first — resolveQuote() caches candles as a side effect.
      // Profile and candles then fire in parallel — candles is always a cache hit.
      const quoteData = await getFullQuote(ticker);
      const [profileData, candleData] = await Promise.all([
        getStockProfile(ticker),
        getCandles(ticker),
      ]);

      setQuote(quoteData);
      setProfile(profileData);
      setCandles(candleData);
      prevPriceRef.current = quoteData.price;
      setIsInitial(false);
    } catch {
      setError('Unable to load quote data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-fetch full data after a trade completes
  useEffect(() => {
    if (refreshKey > 0) loadData();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Background quote poll ──────────────────────────────────────────────────
  //
  // Fetches quote only every 15 seconds.
  // Profile and candles are excluded — they do not change on this cadence.
  // Only updates state if price actually changed — no unnecessary re-renders.
  // Triggers flash effect when price changes direction.
  const pollQuote = useCallback(async () => {
    if (!ticker) return;
    try {
      const quoteData = await getFullQuote(ticker);
      const newPrice  = quoteData.price;
      const oldPrice  = prevPriceRef.current;

      // Only update if price changed
      if (oldPrice !== null && newPrice === oldPrice) return;

      // Determine direction for flash
      if (oldPrice !== null) {
        const direction = newPrice > oldPrice ? 'up' : 'down';
        setPriceFlash(direction);

        // Clear flash after 1.5 seconds
        setTimeout(() => setPriceFlash(null), 1500);
      }

      prevPriceRef.current = newPrice;
      setQuote(quoteData);
    } catch {
      // Silent — poll failures do not show errors to the user
    }
  }, [ticker]);

  useEffect(() => {
    if (isInitial) return; // wait for first load before polling
    const interval = setInterval(pollQuote, 15000);
    return () => clearInterval(interval);
  }, [isInitial, pollQuote]);

  // ── Candle slicing ─────────────────────────────────────────────────────────

  const visibleCandles = (() => {
    const selected = RANGES.find((r) => r.label === range);
    if (!selected || selected.calendarDays === null) return candles;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selected.calendarDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return candles.filter((c) => c.time >= cutoffStr);
  })();

  const chartPositive =
    visibleCandles.length > 1
      ? visibleCandles[visibleCandles.length - 1].close >= visibleCandles[0].close
      : true;

  const chartColor = chartPositive ? theme.colors.success : theme.colors.danger;
  const axisConf   = xAxisConfig[range] || xAxisConfig['3M'];

  // ── Formatters ─────────────────────────────────────────────────────────────

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    }).format(value);

  const formatPercent = (value) =>
  value === null || value === undefined
    ? '--'
    : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const formatVolume = (value) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}K`;
    return value;
  };

  const pnlColor = (value) => {
    if (value === null || value === undefined) return theme.colors.textMuted;
    if (value > 0) return theme.colors.success;
    if (value < 0) return theme.colors.danger;
    return theme.colors.textMuted;
  };

  // Flash background color for the price block.
  // Up = light green tint, Down = light red tint, null = transparent.
  const flashBackground = priceFlash === 'up'
    ? theme.colors.successTint
    : priceFlash === 'down'
      ? theme.colors.dangerTint
      : 'transparent';

  // ── Chart tooltip ──────────────────────────────────────────────────────────

  const ChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={styles.tooltip}>
        <p style={styles.tooltipDate}>{d.time}</p>
        <p style={styles.tooltipClose}>Close: {formatCurrency(d.close)}</p>
        <p style={styles.tooltipVol}>Vol: {formatVolume(d.volume)}</p>
      </div>
    );
  };

  // ── Loading / Error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.stateWrapper}>
        <p style={styles.stateText}>Loading {ticker}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.stateWrapper}>
        <div style={styles.errorBox}>{error}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>

      {/* ── Header card ───────────────────────────────────────────────────── */}
      <div style={styles.headerCard}>

        <div style={styles.headerLeft}>

          <div style={styles.companyRow}>
            <span style={styles.tickerLabel}>{ticker}</span>
            {profile && (
              <span style={styles.companyName}>{profile.name}</span>
            )}
          </div>

          {profile && (
            <div style={styles.metaRow}>
              <span style={styles.metaPill}>{profile.exchange}</span>
              <span style={styles.metaPill}>{profile.industry}</span>
            </div>
          )}

          {/* Price block — flash background transitions on price change */}
          {quote && (
            <div style={{
              ...styles.priceBlock,
              backgroundColor: flashBackground,
              borderRadius:    theme.radius.md,
              // Smooth fade in/out of the flash background
              transition:      'background-color 0.3s ease',
              padding:         `${theme.spacing[1]} ${theme.spacing[2]}`,
              marginLeft:      `-${theme.spacing[2]}`, // offset padding so text stays aligned
            }}>
              <span style={styles.price}>{formatCurrency(quote.price)}</span>
              <span style={{ ...styles.change, color: pnlColor(quote.change) }}>
                {quote.change !== null
                  ? `${quote.change >= 0 ? '+' : ''}${formatCurrency(quote.change)}`
                  : '--'
                }
              </span>
              <span style={{ ...styles.changePct, color: pnlColor(quote.changePercent) }}>
                ({formatPercent(quote.changePercent)})
              </span>
              <span style={styles.delayedLabel}>Delayed</span>
            </div>
          )}

        </div>

        <div style={styles.headerRight}>
          <button
            style={{
              ...styles.tradeBtn, ...styles.buyBtn,
              ...(hovered === 'buy' ? styles.buyBtnHover : {}),
            }}
            onClick={() => openBuyPanel(ticker)}
            onMouseEnter={() => setHovered('buy')}
            onMouseLeave={() => setHovered(null)}
          >
            Buy
          </button>
          <button
            style={{
              ...styles.tradeBtn, ...styles.sellBtn,
              ...(hovered === 'sell' ? styles.sellBtnHover : {}),
            }}
            onClick={() => openSellPanel(ticker)}
            onMouseEnter={() => setHovered('sell')}
            onMouseLeave={() => setHovered(null)}
          >
            Sell
          </button>
        </div>

      </div>

      {/* ── OHLC stats row ────────────────────────────────────────────────── */}
      {quote && (
        <div style={styles.statsRow}>
          {[
            { label: 'Open',       value: formatCurrency(quote.open)     },
            { label: 'Prev Close', value: quote.prevClose !== null ? formatCurrency(quote.prevClose) : '--' },
            { label: 'Day High',   value: formatCurrency(quote.high),  color: theme.colors.success },
            { label: 'Day Low',    value: formatCurrency(quote.low),   color: theme.colors.danger  },
          ].map(({ label, value, color }) => (
            <div key={label} style={styles.statBox}>
              <span style={styles.statLabel}>{label}</span>
              <span style={{ ...styles.statValue, ...(color ? { color } : {}) }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Chart card ────────────────────────────────────────────────────── */}
      {candles.length > 0 && (
        <div style={styles.chartCard}>

          <div style={styles.chartHeader}>
            <span style={styles.chartTitle}>Price History</span>
            <div style={styles.rangeGroup}>
              {RANGES.map((r) => (
                <button
                  key={r.label}
                  style={{
                    ...styles.rangeBtn,
                    ...(range === r.label ? styles.rangeBtnActive : {}),
                  }}
                  onClick={() => setRange(r.label)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={visibleCandles}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}    />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme.colors.border}
                vertical={false}
              />

              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: theme.colors.textMuted }}
                tickLine={false}
                axisLine={false}
                tickFormatter={axisConf.formatter}
                interval={axisConf.interval}
              />

              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 11, fill: theme.colors.textMuted }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(val) => `$${val.toFixed(0)}`}
              />

              <Tooltip content={<ChartTooltip />} />

              <Area
                type="monotone"
                dataKey="close"
                stroke={chartColor}
                strokeWidth={2}
                fill="url(#chartGradient)"
                dot={false}
                activeDot={{ r: 4, fill: chartColor }}
              />

            </AreaChart>
          </ResponsiveContainer>

        </div>
      )}

    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page: {
    display: 'flex', flexDirection: 'column', gap: theme.spacing[4],
  },
  stateWrapper: {
    display: 'flex', justifyContent: 'center', paddingTop: theme.spacing[12],
  },
  stateText: {
    fontSize: theme.font.size.sm, color: theme.colors.textMuted,
  },
  errorBox: {
    backgroundColor: theme.colors.dangerTint,
    border:          `1px solid ${theme.colors.danger}`,
    borderRadius:    theme.radius.md,
    padding:         `${theme.spacing[3]} ${theme.spacing[4]}`,
    fontSize:        theme.font.size.sm,
    color:           theme.colors.danger,
  },
  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.lg,
    border:          `1px solid ${theme.colors.border}`,
    padding:         theme.spacing[6],
    display:         'flex',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    gap:             theme.spacing[6],
  },
  headerLeft: {
    display: 'flex', flexDirection: 'column', gap: theme.spacing[2],
  },
  companyRow: {
    display: 'flex', alignItems: 'baseline', gap: theme.spacing[3],
  },
  tickerLabel: {
    fontSize:   theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
    color:      theme.colors.textPrimary,
  },
  companyName: {
    fontSize:   theme.font.size.lg,
    fontWeight: theme.font.weight.medium,
    color:      theme.colors.textSecondary,
  },
  metaRow: {
    display: 'flex', gap: theme.spacing[2],
  },
  metaPill: {
    fontSize:        theme.font.size.xs,
    fontWeight:      theme.font.weight.medium,
    color:           theme.colors.textSecondary,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.full,
    padding:         `${theme.spacing[1]} ${theme.spacing[3]}`,
  },
  priceBlock: {
    display: 'flex', alignItems: 'baseline', gap: theme.spacing[2], marginTop: theme.spacing[2],
  },
  price: {
    fontSize:   theme.font.size['3xl'],
    fontWeight: theme.font.weight.bold,
    color:      theme.colors.textPrimary,
  },
  change: {
    fontSize: theme.font.size.lg, fontWeight: theme.font.weight.semibold,
  },
  changePct: {
    fontSize: theme.font.size.lg, fontWeight: theme.font.weight.semibold,
  },
  delayedLabel: {
    fontSize:        theme.font.size.xs,
    color:           theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.sm,
    padding:         `${theme.spacing[1]} ${theme.spacing[2]}`,
    alignSelf:       'center',
  },
  headerRight: {
    display: 'flex', gap: theme.spacing[2], flexShrink: 0,
  },
  tradeBtn: {
    height:       '38px',
    padding:      `0 ${theme.spacing[5]}`,
    fontSize:     theme.font.size.sm,
    fontWeight:   theme.font.weight.semibold,
    borderRadius: theme.radius.md,
    borderWidth:  '1px',
    borderStyle:  'solid',
    cursor:       'pointer',
    fontFamily:   theme.font.family,
    transition:   `background-color ${theme.transition.fast}, color ${theme.transition.fast}`,
  },
  buyBtn: {
    color: theme.colors.white, backgroundColor: theme.colors.success, borderColor: theme.colors.success,
  },
  buyBtnHover: {
    color: theme.colors.success, backgroundColor: theme.colors.successTint, borderColor: theme.colors.success,
  },
  sellBtn: {
    color: theme.colors.white, backgroundColor: theme.colors.danger, borderColor: theme.colors.danger,
  },
  sellBtnHover: {
    color: theme.colors.danger, backgroundColor: theme.colors.dangerTint, borderColor: theme.colors.danger,
  },
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: theme.spacing[3],
  },
  statBox: {
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.md,
    border:          `1px solid ${theme.colors.border}`,
    padding:         theme.spacing[4],
    display:         'flex',
    flexDirection:   'column',
    gap:             theme.spacing[1],
  },
  statLabel: {
    fontSize:      theme.font.size.xs,
    color:         theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statValue: {
    fontSize:   theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    color:      theme.colors.textPrimary,
  },
  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.lg,
    border:          `1px solid ${theme.colors.border}`,
    padding:         theme.spacing[6],
    display:         'flex',
    flexDirection:   'column',
    gap:             theme.spacing[4],
  },
  chartHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  chartTitle: {
    fontSize:   theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    color:      theme.colors.textPrimary,
  },
  rangeGroup: {
    display: 'flex', gap: theme.spacing[1],
  },
  rangeBtn: {
    height:          '28px',
    padding:         `0 ${theme.spacing[3]}`,
    fontSize:        theme.font.size.xs,
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
  rangeBtnActive: {
    color:           theme.colors.accent,
    backgroundColor: theme.colors.accentTint,
    borderColor:     theme.colors.accent,
  },
  tooltip: {
    backgroundColor: theme.colors.surface,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
    padding:         `${theme.spacing[2]} ${theme.spacing[3]}`,
    boxShadow:       theme.shadow.md,
  },
  tooltipDate: {
    fontSize: theme.font.size.xs, color: theme.colors.textMuted,
    margin: 0, marginBottom: theme.spacing[1],
  },
  tooltipClose: {
    fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold,
    color: theme.colors.textPrimary, margin: 0,
  },
  tooltipVol: {
    fontSize: theme.font.size.xs, color: theme.colors.textSecondary, margin: 0,
  },
};

export default QuotePage;