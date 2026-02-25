/*
 * components/TradeForm.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Renders the trade form — ticker selector, quantity input, buy and sell
 *   buttons. Calls executeBuy or executeSell from the trade service.
 *   Reports success or failure back to the parent via onTradeComplete.
 *
 * PROPS:
 *   onTradeComplete — function called after a successful trade.
 *                     Parent uses this to refresh wallet and portfolio.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Wallet or portfolio state
 *   - HTTP calls other than trade endpoints
 *   - Routing logic
 */

import { useState } from 'react';
import { executeBuy, executeSell } from '../services/trade';

// TICKERS is the list of available mock stocks.
// Hardcoded on the frontend for MVP — matches the mock price table
// in server/modules/market/service.js exactly.
// When a real market endpoint is added, this becomes a fetch call.
const TICKERS = ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'AMZN'];

const TradeForm = ({ onTradeComplete }) => {
  const [ticker, setTicker]   = useState('AAPL');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState(null);   // { type: 'success'|'error', text: string }
  const [loading, setLoading] = useState(false);

  // handleTrade(action)
  //
  // Shared handler for both buy and sell.
  // action is either 'buy' or 'sell' — passed in from the button click.
  const handleTrade = async (action) => {
    // Clear any previous feedback message before the new attempt.
    setMessage(null);

    const quantityStr = String(quantity).trim();

    // Reject decimals explicitly before parsing.
    // parseInt('1.9999') would silently truncate to 1 and pass validation.
    // Checking the raw string for a decimal point catches this before
    // the value ever reaches the server.
    if (quantityStr.includes('.')) {
    setMessage({ type: 'error', text: 'Quantity must be a whole number of at least 1' });
    return;
    }

    const parsedQuantity = parseInt(quantityStr, 10);
    if (!parsedQuantity || parsedQuantity < 1) {
    setMessage({ type: 'error', text: 'Quantity must be a whole number of at least 1' });
    return;
    }

    setLoading(true);

    try {
      if (action === 'buy') {
        await executeBuy(ticker, parsedQuantity);
        setMessage({ type: 'success', text: `Bought ${parsedQuantity} share(s) of ${ticker}` });
      } else {
        await executeSell(ticker, parsedQuantity);
        setMessage({ type: 'success', text: `Sold ${parsedQuantity} share(s) of ${ticker}` });
      }

      // Clear quantity input after a successful trade.
      setQuantity('');

      // Notify the parent so it can refresh wallet balance and portfolio.
      onTradeComplete();
    } catch (err) {
      // Extract the error message from the axios error response.
      // Falls back to a generic message if the server response is unexpected.
      const text =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        'Something went wrong. Please try again.';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Trade</h2>

      <div style={styles.row}>
        {/* Ticker selector — dropdown of available mock stocks */}
        <div style={styles.field}>
          <label style={styles.label}>Ticker</label>
          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            style={styles.select}
            disabled={loading}
          >
            {TICKERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

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

      <div style={styles.buttonRow}>
        <button
          onClick={() => handleTrade('buy')}
          disabled={loading}
          style={{ ...styles.button, ...styles.buyButton }}
        >
          {loading ? 'Processing...' : 'Buy'}
        </button>
        <button
          onClick={() => handleTrade('sell')}
          disabled={loading}
          style={{ ...styles.button, ...styles.sellButton }}
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
  );
};

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
    marginBottom: '16px',
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
  select: {
    padding: '8px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    minWidth: '100px',
  },
  input: {
    padding: '8px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    width: '100px',
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
};

export default TradeForm;