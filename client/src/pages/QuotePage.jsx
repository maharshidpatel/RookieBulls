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
 *   Cache expires at next market open (9:45 AM ET).
 *
 * Chart — Option B (current price appended):
 *   The last candle's close is replaced with quote.price on every poll.
 *   Chart always ends at the current delayed price — no extra Stooq call.
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

// xAxisConfig — formatter, interval, and minTickGap per range.
//
// interval:
//   number            — show every Nth tick
//   'preserveStartEnd' — always show first and last tick (recharts built-in)
//
// minTickGap:
//   minimum pixels between ticks — prevents overlap on dense ranges.
//   5Y and All use this instead of fixed interval for clean auto-spacing.
//
// Format decisions:
//   5D         — "Tue, Mar 10"  (weekday + date — 5 points, show all)
//   1M, 3M     — "Feb 23"       (month + day)
//   6M, 1Y, 2Y — "Jun 2024"     (month + full 4-digit year)
//   5Y, All    — "2024"         (year only — minTickGap prevents overlap)
const xAxisConfig = {
  '5D': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    },
    interval:    0,
    minTickGap:  0,
  },
  '1M': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    interval:   4,
    minTickGap: 5,
  },
  '3M': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    interval:   9,
    minTickGap: 5,
  },
  '6M': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    },
    interval:   19,
    minTickGap: 10,
  },
  '1Y': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    },
    interval:   19,
    minTickGap: 10,
  },
  '2Y': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    },
    interval:   49,
    minTickGap: 10,
  },
  '5Y': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    },
    interval:   125,  // ~6 months of trading days → ~10 labels over 5 years
    minTickGap: 50,
  },
  'All': {
    formatter: (val) => {
      const d = new Date(val + 'T00:00:00');
      return d.getFullYear().toString();
    },
    interval:   'preserveStartEnd',
    minTickGap: 60,
  },
};

// ── OhlcChart — candlestick chart for 5D range ────────────────────────────
//
// Pure SVG component — renders full OHLC candlesticks.
// ResponsiveContainer passes width as prop automatically.
// Each candle: wick (high-low line) + body (open-close rect).
// Hover shows OHLC tooltip. Current price shown as dashed reference line.
const OhlcChart = ({ candles, width = 600, height = 280 }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!candles || candles.length === 0) return null;

  const margin = { top: 10, right: 40, bottom: 32, left: 64 };
  const chartW  = Math.max(width - margin.left - margin.right, 1);
  const chartH  = height - margin.top - margin.bottom;

  // Price domain — 12% padding above and below
  const prices = candles.flatMap(c => [c.high, c.low]);
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const pad    = (rawMax - rawMin) * 0.12 || rawMax * 0.01;
  const domMin = rawMin - pad;
  const domMax = rawMax + pad;

  const priceToY = (p) =>
    margin.top + chartH * (1 - (p - domMin) / (domMax - domMin));

  // Candle layout
  const slotW   = chartW / candles.length;
  const bodyW   = Math.max(slotW * 0.5, 6);
  const candleX = (i) => margin.left + slotW * i + slotW / 2;

  // Y axis — 5 evenly spaced ticks
  const yTicks = Array.from({ length: 5 }, (_, i) =>
    domMin + (domMax - domMin) * (i / 4)
  );

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx   = e.clientX - rect.left - margin.left;
    const idx  = Math.floor(mx / slotW);
    setHoveredIdx(idx >= 0 && idx < candles.length ? idx : null);
  };

  const fmt = (v) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    }).format(v);

  // Flip tooltip to left side if near right edge
  const tooltipX = (i) => {
    const cx = candleX(i);
    return cx + slotW / 2 + 8 > width - margin.right - 130
      ? cx - 140
      : cx + 10;
  };

  return (
    <svg
      width={width}
      height={height}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredIdx(null)}
      style={{ display: 'block' }}
    >
      {/* Y axis gridlines + labels */}
      {yTicks.map((price, i) => {
        const ty = priceToY(price);
        return (
          <g key={i}>
            <line
              x1={margin.left} y1={ty}
              x2={margin.left + chartW} y2={ty}
              stroke={theme.colors.border}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <text
              x={margin.left - 6} y={ty + 4}
              textAnchor="end"
              fontSize={11}
              fill={theme.colors.textMuted}
            >
              ${price.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Candles */}
      {candles.map((c, i) => {
        const isUp  = c.close >= c.open;
        const color = isUp ? theme.colors.success : theme.colors.danger;
        const cx    = candleX(i);
        const yHigh = priceToY(c.high);
        const yLow  = priceToY(c.low);
        const yTop  = priceToY(Math.max(c.open, c.close));
        const yBot  = priceToY(Math.min(c.open, c.close));
        const bodyH = Math.max(yBot - yTop, 2);

        const d     = new Date(c.time + 'T00:00:00');
        const label = d.toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
        });

        return (
          <g key={c.time}>
            {/* Wick — high to low */}
            <line
              x1={cx} y1={yHigh} x2={cx} y2={yLow}
              stroke={color} strokeWidth={1.5}
            />
            {/* Body — open to close */}
            <rect
              x={cx - bodyW / 2} y={yTop}
              width={bodyW} height={bodyH}
              fill={color}
              opacity={hoveredIdx === i ? 1 : 0.85}
            />
            {/* X axis label */}
            <text
              x={cx}
              y={height - margin.bottom + 18}
              textAnchor="middle"
              fontSize={11}
              fill={hoveredIdx === i
                ? theme.colors.textPrimary
                : theme.colors.textMuted}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Hover crosshair + OHLC tooltip */}
      {hoveredIdx !== null && (() => {
        const c    = candles[hoveredIdx];
        const cx   = candleX(hoveredIdx);
        const tx   = tooltipX(hoveredIdx);
        const isUp = c.close >= c.open;

        return (
          <g>
            {/* Vertical crosshair */}
            <line
              x1={cx} y1={margin.top}
              x2={cx} y2={margin.top + chartH}
              stroke={theme.colors.textMuted}
              strokeDasharray="4 2"
              strokeWidth={1}
              opacity={0.5}
            />
            {/* Tooltip */}
            <foreignObject x={tx} y={margin.top + 4} width={132} height={112}>
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                style={{
                  backgroundColor: theme.colors.surface,
                  border:          `1px solid ${theme.colors.border}`,
                  borderRadius:    '6px',
                  padding:         '8px 10px',
                  fontSize:        '11px',
                  boxShadow:       theme.shadow.md,
                  lineHeight:      1.65,
                }}
              >
                <div style={{ color: theme.colors.textMuted, marginBottom: 4 }}>
                  {c.time}
                </div>
                <div style={{ color: theme.colors.textSecondary }}>
                  O: <span style={{ color: theme.colors.textPrimary, fontWeight: 600 }}>
                    {fmt(c.open)}
                  </span>
                </div>
                <div style={{ color: theme.colors.textSecondary }}>
                  H: <span style={{ color: theme.colors.success, fontWeight: 600 }}>
                    {fmt(c.high)}
                  </span>
                </div>
                <div style={{ color: theme.colors.textSecondary }}>
                  L: <span style={{ color: theme.colors.danger, fontWeight: 600 }}>
                    {fmt(c.low)}
                  </span>
                </div>
                <div style={{ color: theme.colors.textSecondary }}>
                  C: <span style={{
                    color: isUp ? theme.colors.success : theme.colors.danger,
                    fontWeight: 600,
                  }}>
                    {fmt(c.close)}
                  </span>
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })()}
    </svg>
  );
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
  const [priceFlash, setPriceFlash] = useState(null);

  // prevPriceRef — last known price between polls, no re-render on update.
  const prevPriceRef = useRef(null);

  // ── Initial full load ──────────────────────────────────────────────────────
  //
  // Quote loaded first — resolveQuote() caches candles as a side effect.
  // Profile and candles then fire in parallel — candles is always a cache hit.
  const loadData = useCallback(async () => {
    if (!ticker) return;
    localStorage.setItem('lastQuoteTicker', ticker.toUpperCase());
    setLoading(true);
    setError(null);

    try {
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

  useEffect(() => {
    if (refreshKey > 0) loadData();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Background quote poll ──────────────────────────────────────────────────
  const pollQuote = useCallback(async () => {
    if (!ticker) return;
    try {
      const quoteData = await getFullQuote(ticker);
      const newPrice  = quoteData.price;
      const oldPrice  = prevPriceRef.current;

      if (oldPrice !== null && newPrice === oldPrice) return;

      if (oldPrice !== null) {
        const direction = newPrice > oldPrice ? 'up' : 'down';
        setPriceFlash(direction);
        setTimeout(() => setPriceFlash(null), 1500);
      }

      prevPriceRef.current = newPrice;
      setQuote(quoteData);
    } catch {
      // Silent — poll failures do not show errors
    }
  }, [ticker]);

  useEffect(() => {
    if (isInitial) return;
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

  // ── Option B — append current price to chart ───────────────────────────────
  //
  // Replace last candle's close with quote.price so the chart always ends
  // at the current delayed price. No extra Stooq call — quote.price is
  // already in state from the initial load and 15s poll.
  // If candles is empty or quote not loaded — return as-is.
  const chartCandles = (() => {
    if (!quote || visibleCandles.length === 0) return visibleCandles;
    const updated = [...visibleCandles];
    updated[updated.length - 1] = {
      ...updated[updated.length - 1],
      close: quote.price,
    };
    return updated;
  })();

  const chartPositive =
    chartCandles.length > 1
      ? chartCandles[chartCandles.length - 1].close >= chartCandles[0].close
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

          {quote && (
            <div style={{
              ...styles.priceBlock,
              backgroundColor: flashBackground,
              borderRadius:    theme.radius.md,
              transition:      'background-color 0.3s ease',
              padding:         `${theme.spacing[1]} ${theme.spacing[2]}`,
              marginLeft:      `-${theme.spacing[2]}`,
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

          {/* 5D — candlestick chart using full OHLC data */}
          {range === '5D' ? (
            <ResponsiveContainer width="100%" height={280}>
              <OhlcChart candles={chartCandles} />
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartCandles}
                margin={{ top: 8, right: 40, left: 0, bottom: 0 }}
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
                  minTickGap={axisConf.minTickGap}
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
          )}

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