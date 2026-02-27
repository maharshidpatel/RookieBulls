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
 * WHAT CHANGED IN STEP 5.8:
 *   - marketOpen prop added — received from DashboardPage
 *   - Buy and sell buttons disabled when marketOpen is false
 *   - Closed market message shown below buttons when market is closed
 *
 * PROPS:
 *   onTradeComplete — function called after a successful trade.
 *                     Parent uses this to refresh wallet and portfolio.
 *   marketOpen      — boolean from DashboardPage via MarketStatus.
 *                     When false, buy and sell buttons are disabled.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Wallet or portfolio state
 *   - HTTP calls other than trade endpoints
 *   - Routing logic
 *   - Ticker search logic (belongs in TickerSearch.jsx)
 *   - Market status fetching (belongs in MarketStatus.jsx)
 */

import { useState } from 'react'
import { executeBuy, executeSell } from '../services/trade'
import TickerSearch from './TickerSearch'

const TradeForm = ({ onTradeComplete, marketOpen }) => {
  const [ticker, setTicker]           = useState(null)
  const [selectedStock, setSelectedStock] = useState(null)
  const [quantity, setQuantity]       = useState('')
  const [message, setMessage]         = useState(null)
  const [loading, setLoading]         = useState(false)

  const handleSelect = (result) => {
    setTicker(result.ticker)
    setSelectedStock(result)
    setMessage(null)
  }

  const handleTrade = async (action) => {
    setMessage(null)

    if (!ticker) {
      setMessage({ type: 'error', text: 'Please search for and select a ticker first' })
      return
    }

    // Guard: check marketOpen prop before submitting.
    // The server will also reject with 403 if the market is closed,
    // but checking here avoids the round trip entirely and gives
    // a cleaner user experience.
    if (!marketOpen) {
      setMessage({ type: 'error', text: 'Market is currently closed. Trades are not accepted.' })
      return
    }

    const quantityStr = String(quantity).trim()

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

      setQuantity('')
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

  // Buttons are disabled when any of these are true:
  //   - loading    (trade in progress)
  //   - !ticker    (no stock selected yet)
  //   - !marketOpen (market is closed)
  const buttonsDisabled = loading || !ticker || !marketOpen

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Trade</h2>

      <div style={styles.row}>
        <TickerSearch onSelect={handleSelect} disabled={loading} />

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

      {selectedStock && (
        <p style={styles.selectedLabel}>
          Selected: <strong>{selectedStock.ticker}</strong> — {selectedStock.companyName}
        </p>
      )}

      {/* Closed market notice — shown below selected stock when market is closed */}
      {!marketOpen && (
        <p style={styles.closedNotice}>
          Market is currently closed. Trading resumes Monday–Friday 9:30am–4:00pm EST.
        </p>
      )}

      <div style={styles.buttonRow}>
        <button
          onClick={() => handleTrade('buy')}
          disabled={buttonsDisabled}
          style={{
            ...styles.button,
            ...styles.buyButton,
            ...(buttonsDisabled ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? 'Processing...' : 'Buy'}
        </button>
        <button
          onClick={() => handleTrade('sell')}
          disabled={buttonsDisabled}
          style={{
            ...styles.button,
            ...styles.sellButton,
            ...(buttonsDisabled ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? 'Processing...' : 'Sell'}
        </button>
      </div>

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
    margin: '0 0 8px 0',
  },
  closedNotice: {
    fontSize: '13px',
    color: '#c62828',
    backgroundColor: '#ffebee',
    border: '1px solid #ef9a9a',
    borderRadius: '4px',
    padding: '8px 12px',
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