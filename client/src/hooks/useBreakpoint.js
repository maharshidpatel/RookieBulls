/*
 * useBreakpoint.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Exposes a useMobile() hook backed by window.matchMedia.
 *   Components use this to apply different style values at mobile widths.
 *
 * Breakpoint: < 768px (767px and below = mobile).
 *
 * Sync init — isMobile is initialized from mql.matches on first render,
 * so there is no layout flash between SSR (N/A here) or initial paint.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';

export function useMobile() {
  const mql = window.matchMedia('(max-width: 767px)');
  const [isMobile, setIsMobile] = useState(mql.matches); // sync init = no layout flash

  useEffect(() => {
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return isMobile;
}
