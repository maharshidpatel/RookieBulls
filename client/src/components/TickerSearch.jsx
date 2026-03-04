/*
 * components/TickerSearch.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   A debounced ticker search input that lets the user find and select
 *   a US-listed stock by typing a name or symbol.
 *
 * HOW IT WORKS:
 *   1. User types into the input (e.g. 'APP')
 *   2. A 300ms debounce timer starts — resets if user keeps typing
 *   3. After 300ms of no typing, GET /api/market/search?q=APP fires
 *   4. Results appear in a dropdown below the input
 *   5. User clicks a result — onSelect is called with the chosen ticker
 *   6. Dropdown closes, input shows the selected ticker symbol
 *
 * PROPS:
 *   onSelect  — called with { ticker, companyName, exchange } on selection
 *   disabled  — disables the input during loading states
 *   width     — optional override for input width (default: '100%')
 *
 * WHAT DOES NOT BELONG HERE:
 *   Trade execution, quantity input, wallet or portfolio state.
 *
 * STYLE NOTE:
 *   Updated in Step 6.8 to use theme tokens — all hardcoded values removed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react';
import { searchTickers } from '../services/market';
import theme from '../styles/theme';

const TickerSearch = ({ onSelect, onClear, disabled, width = '100%' }) => {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [isOpen,   setIsOpen]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [selected, setSelected] = useState(null);
  const [error,    setError]    = useState(null);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Debounce — waits 300ms after last keystroke before firing search
  useEffect(() => {
    if (!query.trim() || selected?.ticker === query) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchTickers(query.trim());
        setResults(data);
        setIsOpen(data.length > 0);
      } catch {
        setError('Search unavailable. Try again.');
        setResults([]);
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selected]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (result) => {
    setSelected(result);
    setQuery(result.ticker);
    setIsOpen(false);
    setResults([]);
    onSelect(result);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setSelected(null);
    if (!e.target.value.trim() && onClear) {
      onClear();
    }
  };

  return (
    <div ref={containerRef} style={{ ...styles.wrapper, width }}>

      {/* Locked state — ticker selected, show readonly display */}
      {selected ? (
        <div style={styles.lockedWrapper}>
          <div style={styles.lockedDisplay}>
            <span style={styles.lockedTicker}>{selected.ticker}</span>
            <span style={styles.lockedCompany}>{selected.companyName}</span>
          </div>
          <button
            style={styles.clearBtn}
            onMouseDown={() => {
              setSelected(null);
              setQuery('');
              setResults([]);
              if (onClear) onClear();
              // Focus the input after state clears on next render
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        /* Search state — no ticker selected yet */
        <>
          <div style={styles.inputWrapper}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="Search e.g. AAPL"
              disabled={disabled}
              style={styles.input}
              onFocus={() => { if (results.length > 0) setIsOpen(true); }}
              autoComplete="off"
            />
            {loading && <span style={styles.spinner}>...</span>}
          </div>

          {error && <p style={styles.error}>{error}</p>}

          {isOpen && results.length > 0 && (
            <ul style={styles.dropdown}>
              {results.map((result) => (
                <li
                  key={result.ticker}
                  style={styles.dropdownItem}
                  onMouseDown={() => handleSelect(result)}
                >
                  <span style={styles.ticker}>{result.ticker}</span>
                  <span style={styles.companyName}>{result.companyName}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

    </div>
  );
};

const styles = {
  wrapper: {
    position:      'relative',
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[1],
  },

  inputWrapper: {
    position:   'relative',
    display:    'flex',
    alignItems: 'center',
  },

  input: {
    width:           '100%',
    height:          theme.ui.inputHeight,
    padding:         `0 ${theme.spacing[3]}`,
    fontSize:        theme.font.size.sm,
    fontFamily:      theme.font.family,
    color:           theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
    outline:         'none',
  },

  spinner: {
    position: 'absolute',
    right:    theme.spacing[3],
    fontSize: theme.font.size.xs,
    color:    theme.colors.textMuted,
  },

  dropdown: {
    position:        'absolute',
    top:             '100%',
    left:            0,
    right:           0,
    minWidth:        '280px',
    backgroundColor: theme.colors.surface,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
    boxShadow:       theme.shadow.md,
    listStyle:       'none',
    margin:          `${theme.spacing[1]} 0 0 0`,
    padding:         0,
    zIndex:          200,
    maxHeight:       '240px',
    overflowY:       'auto',
  },

  dropdownItem: {
    display:       'flex',
    flexDirection: 'column',
    padding:       `${theme.spacing[2]} ${theme.spacing[3]}`,
    cursor:        'pointer',
    borderBottom:  `1px solid ${theme.colors.border}`,
  },

  ticker: {
    fontWeight: theme.font.weight.bold,
    fontSize:   theme.font.size.sm,
    color:      theme.colors.textPrimary,
  },

  companyName: {
    fontSize:     theme.font.size.xs,
    color:        theme.colors.textSecondary,
    whiteSpace:   'nowrap',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
  },

  error: {
    color:    theme.colors.danger,
    fontSize: theme.font.size.xs,
    margin:   0,
  },

    lockedWrapper: {
    display:         'flex',
    alignItems:      'center',
    gap:             theme.spacing[2],
  },

  lockedDisplay: {
    flex:            1,
    height:          theme.ui.inputHeight,
    padding:         `0 ${theme.spacing[3]}`,
    display:         'flex',
    alignItems:      'center',
    gap:             theme.spacing[2],
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.accent,
    borderRadius:    theme.radius.md,
  },

  lockedTicker: {
    fontSize:   theme.font.size.sm,
    fontWeight: theme.font.weight.bold,
    color:      theme.colors.textPrimary,
  },

  lockedCompany: {
    fontSize:     theme.font.size.xs,
    color:        theme.colors.textMuted,
    whiteSpace:   'nowrap',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
  },

  clearBtn: {
    width:           theme.ui.inputHeight,
    height:          theme.ui.inputHeight,
    flexShrink:      0,
    fontSize:        theme.font.size.sm,
    color:           theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth:     '1px',
    borderStyle:     'solid',
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
    cursor:          'pointer',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
  },

};

export default TickerSearch;