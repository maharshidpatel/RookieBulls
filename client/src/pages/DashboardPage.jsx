/*
 * DASHBOARD PAGE — client/src/pages/DashboardPage.jsx
 * ─────────────────────────────────────────────────────────────
 * Responsibility:
 *   Main landing page after login.
 *   Displays wallet balance, market status, trade form, and portfolio.
 *
 * What belongs here:
 *   Wallet balance display, market status state, loading and error states.
 *
 * What does not belong here:
 *   Auth logic, trade logic, direct axios calls.
 *
 * WHAT CHANGED FROM MVP:
 *   - MarketStatus component added above the trade form
 *   - marketOpen state added — tracks whether NYSE is currently open
 *   - marketOpen passed to TradeForm so buttons disable when market is closed
 *   - onMarketStatusChange passed to MarketStatus so it can update marketOpen
 */

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchMyWallet } from '../services/wallet'
import { fetchMyPortfolio } from '../services/portfolio'
import TradeForm from '../components/TradeForm'
import PortfolioTable from '../components/PortfolioTable'
import MarketStatus from '../components/MarketStatus'

export default function DashboardPage() {
  const { user, logout } = useAuth()

  const [wallet, setWallet]       = useState(null)
  const [portfolio, setPortfolio] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  // marketOpen — tracks whether the NYSE is currently open.
  // Starts as true so buttons are not pre-emptively disabled before
  // the first status fetch completes. MarketStatus updates this
  // within seconds of mounting via onMarketStatusChange.
  // Passed to TradeForm to disable buy and sell buttons when false.
  const [marketOpen, setMarketOpen] = useState(true)

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
      const [walletData, portfolioData] = await Promise.all([
        fetchMyWallet(),
        fetchMyPortfolio(),
      ])
      setWallet(walletData)
      setPortfolio(portfolioData)
      setError(null)
    } catch {
      setError('Failed to load dashboard data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  // onMarketStatusChange(isOpen)
  //
  // Called by MarketStatus every time it fetches a new status.
  // Updates marketOpen state which flows down to TradeForm.
  // Wrapped in useCallback — passed as a prop to MarketStatus which
  // uses it inside a useEffect. Stable reference avoids unnecessary
  // effect re-runs in MarketStatus.
  const onMarketStatusChange = useCallback((isOpen) => {
    setMarketOpen(isOpen)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

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
        {error   && <p style={styles.errorText}>{error}</p>}

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

            {/* Market status indicator — shows OPEN/CLOSED, polls every 60s */}
            <MarketStatus onStatusChange={onMarketStatusChange} />

            {/* Trade form — buttons disabled when market is closed */}
            <TradeForm
              onTradeComplete={loadData}
              marketOpen={marketOpen}
            />

            <hr style={styles.divider} />

            {/* Portfolio table */}
            <PortfolioTable portfolio={portfolio} />
          </>
        )}
      </div>

    </div>
  )
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
  errorText: {
    fontSize: '14px',
    color: 'red',
  },
}