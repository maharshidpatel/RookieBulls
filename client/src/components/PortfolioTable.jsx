/*
 * components/PortfolioTable.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Displays the user's open positions and portfolio summary.
 *   Receives pre-fetched portfolio data as a prop — does not fetch itself.
 *
 * PROPS:
 *   portfolio — { positions[], summary } from /api/portfolio/me
 *               null while loading, empty positions[] if no holdings
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Data fetching
 *   - PnL calculation (already calculated by the server)
 *   - Trade logic
 */

const PortfolioTable = ({ portfolio }) => {
  // Show nothing while portfolio data is not yet loaded.
  if (!portfolio) return null;

  const { positions, summary } = portfolio;

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Portfolio</h2>

      {positions.length === 0 ? (
        // Empty state — user holds no positions.
        <p style={styles.empty}>No open positions. Buy some shares to get started.</p>
      ) : (
        <>
          {/* Position rows */}
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Ticker</th>
                <th style={styles.th}>Qty</th>
                <th style={styles.th}>Avg Buy Price</th>
                <th style={styles.th}>Current Price</th>
                <th style={styles.th}>Market Value</th>
                <th style={styles.th}>PnL</th>
                <th style={styles.th}>PnL %</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.ticker}>
                  <td style={styles.td}>{p.ticker}</td>
                  <td style={styles.td}>{p.quantity}</td>
                  <td style={styles.td}>${p.avgBuyPrice.toFixed(2)}</td>
                  <td style={styles.td}>${p.currentPrice.toFixed(2)}</td>
                  <td style={styles.td}>${p.marketValue.toFixed(2)}</td>

                  {/* PnL coloured green for gain, red for loss, grey for zero */}
                  <td style={{ ...styles.td, ...pnlColor(p.pnl) }}>
                    {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                  </td>
                  <td style={{ ...styles.td, ...pnlColor(p.pnlPercent) }}>
                    {p.pnlPercent >= 0 ? '+' : ''}{p.pnlPercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Portfolio summary row */}
          <div style={styles.summary}>
            <span>Total value: <strong>${summary.totalMarketValue.toFixed(2)}</strong></span>
            <span style={{ marginLeft: '24px', ...pnlColor(summary.totalPnl) }}>
              Total PnL: <strong>
                {summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toFixed(2)}
              </strong>
            </span>
            <span style={{ marginLeft: '16px', ...pnlColor(summary.totalPnlPercent) }}>
              (<strong>
                {summary.totalPnlPercent >= 0 ? '+' : ''}{summary.totalPnlPercent.toFixed(2)}%
              </strong>)
            </span>
          </div>
        </>
      )}
    </div>
  );
};

// pnlColor(value)
//
// Returns an inline style object based on whether the value is
// positive, negative, or zero.
// Used on PnL cells and the summary to give instant visual feedback.
const pnlColor = (value) => {
  if (value > 0) return { color: '#2e7d32' };
  if (value < 0) return { color: '#c62828' };
  return { color: '#888' };
};

const styles = {
  container: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '24px',
  },
  heading: {
    marginTop: 0,
    marginBottom: '16px',
    fontSize: '18px',
  },
  empty: {
    color: '#888',
    fontSize: '14px',
    margin: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    marginBottom: '16px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '2px solid #ddd',
    color: '#555',
    fontWeight: '600',
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #eee',
  },
  summary: {
    fontSize: '14px',
    paddingTop: '8px',
  },
};

export default PortfolioTable;