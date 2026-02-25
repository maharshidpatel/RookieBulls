/*
 * DASHBOARD PAGE — client/src/pages/DashboardPage.jsx
 * ─────────────────────────────────────────────────────────────
 * Responsibility:
 *   Main landing page after login.
 *   Displays the authenticated user's wallet balance.
 *
 * What belongs here:
 *   Wallet balance display, loading and error states.
 *
 * What does not belong here:
 *   Auth logic, trade logic, direct axios calls.
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchMyWallet } from '../services/wallet';
import { fetchMyPortfolio } from '../services/portfolio';
import TradeForm from '../components/TradeForm';
import PortfolioTable from '../components/PortfolioTable';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  const [wallet, setWallet]       = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // loadData()
  //
  // Fetches wallet and portfolio in parallel using Promise.all.
  // Both requests are independent so running them simultaneously
  // is faster than sequential.
  //
  // Wrapped in useCallback so the reference is stable and can be
  // safely passed to TradeForm as onTradeComplete without causing
  // unnecessary re-renders on every parent render cycle.
  const loadData = useCallback(async () => {
    try {
      const [wallet, portfolio] = await Promise.all([
        fetchMyWallet(),
        fetchMyPortfolio(),
      ]);
      setWallet(wallet);
      setPortfolio(portfolio);
      setError(null);
    } catch {
      setError('Failed to load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch wallet and portfolio on first render.
  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.logo}>Rookie Bulls</h1>
        <button onClick={logout} style={styles.logoutButton}>
          Log out
        </button>
      </div>

      <div style={styles.main}>
        <p style={styles.email}>Logged in as: {user?.email}</p>

        <hr style={styles.divider} />

        {loading && <p style={styles.status}>Loading...</p>}
        {error   && <p style={styles.error}>{error}</p>}

        {!loading && !error && (
          <>
            {/* Wallet balance */}
            <h2 style={styles.sectionHeading}>Virtual Wallet</h2>
            {wallet && (
              <div style={styles.balanceCard}>
                <p style={styles.balanceLabel}>Available Credits</p>
                <p style={styles.balanceValue}>
                  {wallet.balance.toLocaleString()}
                </p>
              </div>
            )}

            <hr style={styles.divider} />

            {/* Trade form — triggers full reload after every trade */}
            <TradeForm onTradeComplete={loadData} />

            <hr style={styles.divider} />

            {/* Portfolio table */}
            <PortfolioTable portfolio={portfolio} />
          </>
        )}
      </div>

    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: 'monospace',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #ddd',
  },
  logo: {
    margin: 0,
    fontSize: '20px',
  },
  logoutButton: {
    fontSize: '13px',
    cursor: 'pointer',
    padding: '4px 12px',
  },
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '32px 24px',
  },
  email: {
    color: '#555',
    fontSize: '14px',
    margin: '0 0 16px',
  },
  divider: {
    margin: '24px 0',
  },
  sectionHeading: {
    fontSize: '16px',
    marginBottom: '12px',
  },
  balanceCard: {
    border: '1px solid #ddd',
    borderRadius: '6px',
    padding: '20px',
    fontSize: '14px',
    backgroundColor: '#fff',
  },
  balanceLabel: {
    margin: '0 0 8px 0',
    color: '#555',
  },
  balanceValue: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 'bold',
  },
  status: {
    fontSize: '14px',
    color: '#888',
  },
  error: {
    fontSize: '14px',
    color: 'red',
  },
};