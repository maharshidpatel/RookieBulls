/*
 * theme.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Single source of truth for all visual design tokens.
 *   Exports lightTheme, darkTheme, and a default export (lightTheme).
 *
 * Does NOT belong here:
 *   Component logic, API calls, routing, state.
 *
 * How it fits:
 *   Every component imports `theme` (or { lightTheme, darkTheme }) from here.
 *   When ThemeContext is added in a future step, it switches the active object.
 *   No component ever hardcodes a color, spacing, or shadow value.
 *
 * Shape contract:
 *   lightTheme and darkTheme are identical in structure — same keys, different
 *   values. This guarantees a component referencing theme.colors.background
 *   works correctly regardless of which theme object is active.
 *
 * Token sections:
 *   colors      → all color values including tints and status indicator colors
 *   font        → family, size scale, weight scale, line height scale
 *   spacing     → 4px-base margin/padding/gap scale
 *   radius      → border radius scale
 *   shadow      → box shadow scale
 *   layout      → fixed structural dimensions (nav heights, max widths)
 *   ui          → reusable component dimensions (button heights)
 *   transition  → animation timing
 * ─────────────────────────────────────────────────────────────────────────────
 */

const lightTheme = {

  // ─── Colors ──────────────────────────────────────────────────────────────────
  //
  // Semantic naming — names describe PURPOSE, not appearance.
  // "background" = main canvas, not "white" or "light grey".
  // This allows dark mode to swap values without renaming tokens.
  //
  // Groups:
  //   Base         → background, surface, surfaceAlt, border, white
  //   Text         → textPrimary, textSecondary, textMuted
  //   Brand/Action → accent, success, danger, info (+ hover variants)
  //   Tints        → light background fills for hover inversion pattern
  //                  e.g. filled green button → hover = light green tint + green border
  //   Status       → market open/closed pill specific colors
  //                  (distinct from success/danger — different background lightness)
  //   Overlay      → modal/panel backdrop
  //
  colors: {

    // Base
    background:    '#f4f5f7',   // main page canvas
    surface:       '#ffffff',   // cards, panels, modals
    surfaceAlt:    '#f9fafb',   // alternating rows, secondary surfaces
    border:        '#e2e8f0',   // dividers, input outlines
    white:         '#ffffff',   // explicit white — button text on filled buttons,
                                // active pill text. Separate from surface so dark
                                // mode can change surface without affecting white text.

    // Text
    textPrimary:   '#1a202c',   // main body text
    textSecondary: '#4a5568',   // labels, subtitles, helper text
    textMuted:     '#a0aec0',   // disabled, de-emphasized

    // Brand / Action colors
    accent:        '#3b82f6',   // blue — brand, active nav
    accentHover:   '#2563eb',   // darker blue on hover
    success:       '#16a34a',   // green — buy, gains, positive values
    successHover:  '#15803d',   // darker green on hover
    danger:        '#dc2626',   // red — sell, losses, negative values
    dangerHover:   '#b91c1c',   // darker red on hover
    info:          '#0284c7',   // sky blue — Get Quote, neutral action
    infoHover:     '#0369a1',   // darker sky blue on hover

    // Tints — hover inversion backgrounds
    // Used when a filled button inverts on hover:
    //   default  → solid color fill, white text
    //   hover    → tint background + colored border + colored text
    // Also used for nav pill hover (accentTint).
    accentTint:    '#eff6ff',   // very light blue — nav pill hover, accent hover bg
    successTint:   '#f0fdf4',   // very light green — buy button hover bg
    dangerTint:    '#fff1f2',   // very light red — sell button hover bg
    infoTint:      '#f0f9ff',   // very light sky blue — quote button hover bg

    // Status indicator colors — market open/closed pill
    // Separate from success/danger because the pill uses pastel backgrounds
    // and specific border colors that would be wrong for other success/danger uses.
    statusOpenText:     '#15803d',  // dark green text (same value as successHover)
    statusOpenBg:       '#dcfce7',  // pastel green background
    statusOpenBorder:   '#bbf7d0',  // light green border
    statusClosedText:   '#b91c1c',  // dark red text (same value as dangerHover)
    statusClosedBg:     '#fee2e2',  // pastel red background
    statusClosedBorder: '#fecaca',  // light red border

    // Overlay — backdrop behind modals and side panels
    overlay: 'rgba(0, 0, 0, 0.45)',
  },


  // ─── Typography ──────────────────────────────────────────────────────────────
  //
  // size scale:
  //   xs    → 11px  timestamps, helper text, status pill labels
  //   sm    → 13px  nav labels, table cells, secondary text
  //   md    → 15px  default body text
  //   lg    → 18px  section headings, card subtitles
  //   xl    → 22px  card primary values
  //   brand → 26px  TopNav company name — sits between xl and 2xl,
  //                 intentionally not on the 4px grid. One-off brand token.
  //   2xl   → 28px  large metrics (Total Equity on Summary page)
  //   3xl   → 36px  hero numbers (reserved)
  //
  font: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    size: {
      xs:    '11px',
      sm:    '13px',
      md:    '15px',
      lg:    '18px',
      xl:    '22px',
      brand: '26px',
      '2xl': '28px',
      '3xl': '36px',
    },
    weight: {
      regular:  400,
      medium:   500,
      semibold: 600,
      bold:     700,
    },
    lineHeight: {
      tight:  1.2,
      normal: 1.5,
      loose:  1.75,
    },
  },


  // ─── Spacing ──────────────────────────────────────────────────────────────────
  //
  // 4px base grid. Used for margin, padding, gap.
  // Usage: padding: theme.spacing[4]  →  '16px'
  //
  spacing: {
    1:  '4px',
    2:  '8px',
    3:  '12px',
    4:  '16px',
    5:  '20px',
    6:  '24px',
    8:  '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },


  // ─── Border radius ────────────────────────────────────────────────────────────
  //
  // sm   → inputs, small tags
  // md   → cards, panels, standard buttons
  // lg   → large modals, large cards
  // full → pill shapes — nav pills, status badge, username pill
  //
  radius: {
    sm:   '4px',
    md:   '8px',
    lg:   '12px',
    full: '9999px',
  },


  // ─── Shadows ──────────────────────────────────────────────────────────────────
  //
  // sm → subtle lift — nav bars, standard cards
  // md → elevated — floating panels, dropdowns
  // lg → deep — modals
  //
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    md: '0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
    lg: '0 10px 30px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.08)',
  },


  // ─── Layout ───────────────────────────────────────────────────────────────────
  //
  // Fixed structural dimensions.
  // topNavHeight + secondNavHeight are used in Layout.jsx paddingTop calc().
  // Changing either value here automatically adjusts the page offset.
  //
  layout: {
    topNavHeight:    '60px',
    secondNavHeight: '52px',
    contentMaxWidth: '1280px',
    panelWidth:      '380px',
  },


  // ─── UI component dimensions ──────────────────────────────────────────────────
  //
  // Reusable height/size values for interactive elements.
  // Keeps buttons and inputs consistent without hardcoding px in every component.
  //
  // navPillHeight    → page nav pills (Summary, Holdings, etc.)
  // actionPillHeight → Buy, Sell, Get a Quote action buttons
  // inputHeight      → text inputs, select fields (used from Step 6.5+)
  //
  ui: {
    navPillHeight:    '28px',
    actionPillHeight: '32px',
    inputHeight:      '38px',
  },


  // ─── Transitions ──────────────────────────────────────────────────────────────
  //
  // fast   → hover color/background changes
  // normal → panel slide-in, modal fade-in
  //
  transition: {
    fast:   '150ms ease',
    normal: '250ms ease',
  },
};


// ─── Dark theme ───────────────────────────────────────────────────────────────
//
// Same structure as lightTheme — only colors and shadows differ.
// Spread lightTheme first to inherit font, spacing, radius, layout, ui,
// transition unchanged, then override colors and shadow.
//
const darkTheme = {
  ...lightTheme,
  colors: {
    // Base
    background:    '#0f172a',
    surface:       '#1e293b',
    surfaceAlt:    '#273549',
    border:        '#334155',
    white:         '#ffffff',   // white stays white in dark mode

    // Text
    textPrimary:   '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted:     '#475569',

    // Brand / Action
    accent:        '#60a5fa',
    accentHover:   '#93c5fd',
    success:       '#4ade80',
    successHover:  '#86efac',
    danger:        '#f87171',
    dangerHover:   '#fca5a5',
    info:          '#38bdf8',
    infoHover:     '#7dd3fc',

    // Tints — darker versions for dark mode
    // Light tints would look washed out on dark backgrounds.
    accentTint:    '#1e3a5f',
    successTint:   '#14532d',
    dangerTint:    '#450a0a',
    infoTint:      '#0c4a6e',

    // Status indicator — dark mode pastels
    statusOpenText:     '#86efac',
    statusOpenBg:       '#14532d',
    statusOpenBorder:   '#166534',
    statusClosedText:   '#fca5a5',
    statusClosedBg:     '#450a0a',
    statusClosedBorder: '#7f1d1d',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.30), 0 1px 2px rgba(0,0,0,0.20)',
    md: '0 4px 12px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.25)',
    lg: '0 10px 30px rgba(0,0,0,0.50), 0 4px 10px rgba(0,0,0,0.30)',
  },
};


// ─── Exports ──────────────────────────────────────────────────────────────────
//
// Named exports — for ThemeContext when dark mode is wired up.
// Default export — lightTheme, used by all components right now.
//
export { lightTheme, darkTheme };
export default lightTheme;