/*
 * components/TradeForm.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Renders the trade form — ticker search, quantity input, buy and sell
 *   buttons. Calls executeBuy or executeSell from the trade service.
 *   Reports success or failure back to the parent via onTradeComplete.
 *
 * WHAT CHANGED FROM MVP:
 *   - Hardcoded TICKERS array removed
 *   - <select> dropdown replaced with <TickerSearch> component
 *   - ticker state now set by TickerSearch's onSelect callback
 *   - selectedStock state added to display company name after selection
 *   - Trade buttons disabled until a ticker is selected from search
 *
 * PROPS:
 *   onTradeComplete — function called after a successful trade.
 *                     Parent uses this to refresh wallet and portfolio.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Wallet or portfolio state
 *   - HTTP calls other than trade endpoints
 *   - Routing logic
 *   - Ticker search logic (belongs in TickerSearch.jsx)
 */

import { useState } from 'react'
import { executeBuy, executeSell } from '../services/trade'
import TickerSearch from './TickerSearch'

const TradeForm = ({ onTradeComplete }) => {
  // ticker — the currently selected ticker symbol (e.g. 'AAPL')
  // null until the user selects a result from TickerSearch
  const [ticker, setTicker] = useState(null)

  // selectedStock — the full result object from TickerSearch
  // { ticker, companyName, exchange }
  // Used to display the company name below the search input
  // so the user knows exactly what they selected before trading.
  const [selectedStock, setSelectedStock] = useState(null)

  const [quantity, setQuantity]   = useState('')
  const [message, setMessage]     = useState(null)  // { type: 'success'|'error', text: string }
  const [loading, setLoading]     = useState(false)

  // handleSelect(result)
  //
  // Called by TickerSearch when the user clicks a result.
  // Sets both ticker (the symbol used for trade execution)
  // and selectedStock (the full object used for display).
  const handleSelect = (result) => {
    setTicker(result.ticker)
    setSelectedStock(result)
    setMessage(null)
  }

  // handleTrade(action)
  //
  // Shared handler for both buy and sell.
  // action is either 'buy' or 'sell' — passed in from the button click.
  const handleTrade = async (action) => {
    setMessage(null)

    // Guard: ticker must be selected from search before trading.
    // Buttons are also disabled at the UI level, but this is a
    // second line of defence in case state is somehow stale.
    if (!ticker) {
      setMessage({ type: 'error', text: 'Please search for and select a ticker first' })
      return
    }

    const quantityStr = String(quantity).trim()

    // Reject decimals explicitly before parsing.
    // parseInt('1.9999') would silently truncate to 1 and pass validation.
    // Checking the raw string for a decimal point catches this before
    // the value ever reaches the server.
    if (quantityStr.includes('.')) {
      setMessage({ type: 'error', text: 'Quantity must be a whole number of at least 1' })
      return
    }

    const parsedQuantity = parseInt(quantityStr, 10)
    if (!parsedQuantity || parsedQuantity < 1) {
      setMessage({ type: 'error', text: 'Quantity must be a whole number of at least 1' })
      return
    }

    setLoading(true)

    try {
      if (action === 'buy') {
        await executeBuy(ticker, parsedQuantity)
        setMessage({ type: 'success', text: `Bought ${parsedQuantity} share(s) of ${ticker}` })
      } else {
        await executeSell(ticker, parsedQuantity)
        setMessage({ type: 'success', text: `Sold ${parsedQuantity} share(s) of ${ticker}` })
      }

      // Clear quantity after successful trade.
      // Ticker and selectedStock are kept — user may want to trade
      // the same stock again immediately.
      setQuantity('')

      // Notify the parent so it can refresh wallet balance and portfolio.
      onTradeComplete()
    } catch (err) {
      const text =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        'Something went wrong. Please try again.'
      setMessage({ type: 'error', text })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Trade</h2>

      <div style={styles.row}>
        {/* Ticker search — replaces the hardcoded dropdown from MVP */}
        <TickerSearch onSelect={handleSelect} disabled={loading} />

        {/* Quantity input */}
        <div style={styles.field}>
          <label style={styles.label}>Quantity</label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 5"
            style={styles.input}
            disabled={loading}
          />
        </div>
      </div>

      {/* Selected stock confirmation — shown after a ticker is chosen.
          Gives the user a clear confirmation of what they are about to trade
          before they commit to a buy or sell. */}
      {selectedStock && (
        <p style={styles.selectedLabel}>
          Selected: <strong>{selectedStock.ticker}</strong> — {selectedStock.companyName}
        </p>
      )}

      <div style={styles.buttonRow}>
        <button
          onClick={() => handleTrade('buy')}
          // Disabled when loading OR when no ticker has been selected.
          // A trade cannot execute without a ticker.
          disabled={loading || !ticker}
          style={{
            ...styles.button,
            ...styles.buyButton,
            ...(!ticker ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? 'Processing...' : 'Buy'}
        </button>
        <button
          onClick={() => handleTrade('sell')}
          disabled={loading || !ticker}
          style={{
            ...styles.button,
            ...styles.sellButton,
            ...(!ticker ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? 'Processing...' : 'Sell'}
        </button>
      </div>

      {/* Feedback message — shown after every trade attempt */}
      {message && (
        <p style={message.type === 'success' ? styles.success : styles.error}>
          {message.text}
        </p>
      )}
    </div>
  )
}

const styles = {
  container: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
  },
  heading: {
    marginTop: 0,
    marginBottom: '16px',
    fontSize: '18px',
  },
  row: {
    display: 'flex',
    gap: '16px',
    marginBottom: '8px',
    alignItems: 'flex-end',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '13px',
    color: '#555',
  },
  input: {
    padding: '8px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    width: '100px',
  },
  selectedLabel: {
    fontSize: '13px',
    color: '#333',
    margin: '0 0 12px 0',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
  },
  button: {
    padding: '10px 24px',
    fontSize: '14px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  buyButton: {
    backgroundColor: '#2e7d32',
    color: '#fff',
  },
  sellButton: {
    backgroundColor: '#c62828',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  success: {
    color: '#2e7d32',
    margin: 0,
    fontSize: '14px',
  },
  error: {
    color: '#c62828',
    margin: 0,
    fontSize: '14px',
  },
}

export default TradeForm