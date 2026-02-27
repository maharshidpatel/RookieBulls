/*
 * components/TickerSearch.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   A debounced ticker search input that lets the user find and select
 *   a US-listed stock by typing a name or symbol.
 *
 *   Replaces the hardcoded TICKERS dropdown that existed in TradeForm.jsx
 *   at MVP. The user is no longer limited to 5 stocks — any NYSE or
 *   Nasdaq listed common stock is searchable.
 *
 * HOW IT WORKS:
 *   1. User types into the input (e.g. 'APP')
 *   2. A 300ms debounce timer starts — resets if user keeps typing
 *   3. After 300ms of no typing, GET /api/market/search?q=APP fires
 *   4. Results appear in a dropdown below the input
 *   5. User clicks a result — onSelect is called with the chosen ticker
 *   6. Dropdown closes, input shows the selected ticker symbol
 *
 * WHAT IS DEBOUNCING:
 *   Without debouncing, every single keystroke fires an API request.
 *   Typing 'AAPL' would fire 4 requests: A, AA, AAP, AAPL.
 *   Debouncing waits until the user pauses typing before firing.
 *   This reduces unnecessary API calls and stays within Finnhub's
 *   60 requests per minute free tier limit.
 *
 * PROPS:
 *   onSelect — function called when user selects a result.
 *              Receives { ticker, companyName, exchange } as argument.
 *              Parent (TradeForm) uses this to set the active ticker.
 *   disabled — boolean, passed through from TradeForm during loading.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Trade execution logic (belongs in TradeForm.jsx)
 *   - Quantity input or buy/sell buttons (belongs in TradeForm.jsx)
 *   - Wallet or portfolio state (belongs in DashboardPage.jsx)
 */

import { useState, useEffect, useRef } from 'react'
import { searchTickers } from '../services/market'

const TickerSearch = ({ onSelect, disabled }) => {
  // query — what the user is currently typing in the input
  const [query, setQuery] = useState('')

  // results — array of { ticker, companyName, exchange } from the API
  const [results, setResults] = useState([])

  // isOpen — controls whether the results dropdown is visible
  const [isOpen, setIsOpen] = useState(false)

  // loading — true while the API request is in flight
  const [loading, setLoading] = useState(false)

  // selected — the ticker the user has confirmed by clicking a result
  // Displayed in the input after selection replaces the search query
  const [selected, setSelected] = useState(null)

  // error — surface search failures without crashing the trade form
  const [error, setError] = useState(null)

  // containerRef is attached to the outer div so we can detect clicks
  // outside the component and close the dropdown automatically.
  const containerRef = useRef(null)

  // DEBOUNCE EFFECT
  //
  // Runs every time the query string changes.
  // Sets a 300ms timer. If query changes again before the timer fires
  // (user is still typing), the previous timer is cleared and a new
  // one starts. The API call only fires after 300ms of no typing.
  //
  // Why useEffect for debouncing:
  //   useEffect's cleanup function (the return statement) runs before
  //   the next effect fires. This is exactly what debounce needs —
  //   cancel the previous timer before starting a new one.
  useEffect(() => {
    // Do not search if query is empty or user has already selected this text.
    // selected?.ticker === query means the input shows a confirmed selection —
    // no need to re-search for it.
    if (!query.trim() || selected?.ticker === query) {
      setResults([])
      setIsOpen(false)
      return
    }

    // Start the 300ms debounce timer.
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await searchTickers(query.trim())
        setResults(data)
        // Only open the dropdown if results came back.
        setIsOpen(data.length > 0)
      } catch {
        // Surface the error but do not crash the form.
        setError('Search unavailable. Try again.')
        setResults([])
        setIsOpen(false)
      } finally {
        setLoading(false)
      }
    }, 300)

    // Cleanup — clear the timer if query changes before it fires.
    // This is what makes it a debounce rather than a simple delay.
    return () => clearTimeout(timer)
  }, [query, selected])

  // CLICK OUTSIDE EFFECT
  //
  // Closes the results dropdown when the user clicks anywhere outside
  // the TickerSearch component. Without this, the dropdown stays open
  // permanently after the user tabs away or clicks elsewhere.
  useEffect(() => {
    const handleClickOutside = (e) => {
      // containerRef.current is the outer div of this component.
      // If the click target is not inside that div, close the dropdown.
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    // Listen on the document so any click anywhere triggers the check.
    document.addEventListener('mousedown', handleClickOutside)

    // Cleanup — remove the listener when the component unmounts.
    // Without this, the listener would accumulate on every render.
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // handleSelect(result)
  //
  // Called when the user clicks a result in the dropdown.
  // Sets the input to the ticker symbol, closes the dropdown,
  // and calls the onSelect prop so the parent (TradeForm) knows
  // which ticker is now active.
  const handleSelect = (result) => {
    setSelected(result)
    setQuery(result.ticker)
    setIsOpen(false)
    setResults([])
    onSelect(result)
  }

  // handleInputChange(e)
  //
  // Runs on every keystroke in the search input.
  // Clears the confirmed selection when the user starts typing again —
  // they are searching for something new, so the old selection is stale.
  const handleInputChange = (e) => {
    setQuery(e.target.value)
    setSelected(null)
  }

  return (
    <div ref={containerRef} style={styles.wrapper}>
      <label style={styles.label}>Ticker</label>

      <div style={styles.inputWrapper}>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search e.g. AAPL"
          disabled={disabled}
          style={styles.input}
          // Open dropdown on focus if results already exist
          // (user focused away and back without typing again)
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
          autoComplete="off"
        />

        {/* Loading indicator — shown while Finnhub request is in flight */}
        {loading && <span style={styles.spinner}>...</span>}
      </div>

      {/* Error message — shown if search API call failed */}
      {error && <p style={styles.error}>{error}</p>}

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <ul style={styles.dropdown}>
          {results.map((result) => (
            <li
              key={result.ticker}
              style={styles.dropdownItem}
              // onMouseDown instead of onClick — fires before onBlur,
              // which prevents the dropdown from closing before the
              // click registers when the user clicks a result.
              onMouseDown={() => handleSelect(result)}
            >
              {/* Ticker symbol — bold, prominent */}
              <span style={styles.ticker}>{result.ticker}</span>

              {/* Company name — secondary, truncated if too long */}
              <span style={styles.companyName}>{result.companyName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '13px',
    color: '#555',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    padding: '8px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    width: '160px',
  },
  spinner: {
    position: 'absolute',
    right: '8px',
    fontSize: '12px',
    color: '#999',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    // Wide enough to show company names without wrapping
    minWidth: '280px',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    listStyle: 'none',
    margin: '2px 0 0 0',
    padding: 0,
    zIndex: 100,
    maxHeight: '240px',
    overflowY: 'auto',
  },
  dropdownItem: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0',
    // Hover effect applied via onMouseEnter/Leave would need state.
    // Keeping it simple for now — Step 6 redesign will polish this.
  },
  ticker: {
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#111',
  },
  companyName: {
    fontSize: '12px',
    color: '#666',
    // Prevent long company names from breaking layout
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  error: {
    color: '#c62828',
    fontSize: '12px',
    margin: 0,
  },
}

export default TickerSearch