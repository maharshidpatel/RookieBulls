/*
 * components/MarketStatus.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Displays whether the US stock market is currently open or closed.
 *   Polls the market status endpoint every 60 seconds so the indicator
 *   updates automatically when the market opens or closes.
 *
 * HOW IT WORKS:
 *   1. On mount, calls GET /api/market/status immediately
 *   2. Sets up a 60 second interval that repeats the call
 *   3. Displays MARKET OPEN (green) or MARKET CLOSED (red)
 *   4. Calls onStatusChange(isOpen) so the parent can disable trade buttons
 *   5. Cleans up the interval when the component unmounts
 *
 * WHY 60 SECOND POLLING:
 *   The market opens and closes at fixed times. A 60 second poll is
 *   frequent enough that the indicator updates within a minute of the
 *   real open or close. Polling faster than this on the free tier
 *   wastes API requests with no meaningful benefit.
 *
 * PROPS:
 *   onStatusChange — called with isOpen (boolean) whenever status is fetched.
 *                    Parent uses this to disable trade buttons when closed.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Trade execution logic
 *   - Wallet or portfolio state
 *   - Any display beyond the market status indicator
 */

import { useState, useEffect } from 'react'
import { getMarketStatus } from '../services/market'

const MarketStatus = ({ onStatusChange }) => {
  // status holds the full response: { isOpen: boolean, message: string }
  // null until the first fetch completes
  const [status, setStatus] = useState(null)

  // error — shown if the status fetch fails
  const [error, setError] = useState(null)

  useEffect(() => {
    // fetchStatus()
    //
    // Calls the market status endpoint and updates local state.
    // Also calls onStatusChange so the parent knows the current value.
    const fetchStatus = async () => {
      try {
        const data = await getMarketStatus()
        setStatus(data)
        setError(null)
        // Notify parent of the current open/closed state.
        // Parent passes this down to TradeForm to disable buttons.
        onStatusChange(data.isOpen)
      } catch {
        setError('Status unavailable')
        // On error, treat market as closed — safer than allowing trades
        // when the status cannot be confirmed.
        onStatusChange(false)
      }
    }

    // Fetch immediately on mount — do not wait for the first interval tick.
    fetchStatus()

    // Poll every 60 seconds.
    // The market opens and closes at fixed times — 60 seconds is
    // frequent enough to reflect real transitions within one minute.
    const interval = setInterval(fetchStatus, 60000)

    // Cleanup — clear the interval when the component unmounts.
    // Without this, the interval keeps firing even after the user
    // navigates away from the dashboard.
    return () => clearInterval(interval)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Why empty dependency array:
  //   fetchStatus only needs to run on mount and on the interval timer.
  //   onStatusChange is a stable useCallback reference in the parent page
  //   so it will not change between renders — safe to exclude.
  //   The eslint disable comment suppresses the linter warning for this
  //   intentional decision.

  // Show nothing until the first fetch completes.
  // Avoids a flash of incorrect state on initial render.
  if (!status && !error) return null

  return (
    <div style={styles.wrapper}>
      {error ? (
        <span style={styles.unknown}>● Market status unavailable</span>
      ) : (
        <span style={status.isOpen ? styles.open : styles.closed}>
          ● {status.isOpen ? 'Market Open' : 'Market Closed'}
        </span>
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'inline-block',
    marginBottom: '16px',
  },
  open: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#2e7d32',
    backgroundColor: '#e8f5e9',
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid #a5d6a7',
  },
  closed: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#c62828',
    backgroundColor: '#ffebee',
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid #ef9a9a',
  },
  unknown: {
    fontSize: '13px',
    color: '#888',
    backgroundColor: '#f5f5f5',
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid #ddd',
  },
}

export default MarketStatus