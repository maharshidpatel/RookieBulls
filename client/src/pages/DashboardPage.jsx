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

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchMyWallet } from '../services/wallet';

export default function DashboardPage() {
  const { user, accessToken, logout } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadWallet() {
      try {
        const data = await fetchMyWallet(accessToken);
        setWallet(data);
      } catch {
        setError('Failed to load wallet.');
      } finally {
        setLoading(false);
      }
    }

    loadWallet();
  }, [accessToken]);

  return (
    <div style={{ maxWidth: '600px', margin: '60px auto', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '20px' }}>Rookie Bulls</h1>
        <button
          onClick={logout}
          style={{ fontSize: '13px', cursor: 'pointer', padding: '4px 12px' }}
        >
          Log out
        </button>
      </div>

      <p style={{ color: '#555', fontSize: '14px' }}>
        Logged in as: {user?.email}
      </p>

      <hr style={{ margin: '24px 0' }} />

      <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>Virtual Wallet</h2>

      {loading && <p style={{ fontSize: '14px' }}>Loading...</p>}

      {error && (
        <p style={{ fontSize: '14px', color: 'red' }}>{error}</p>
      )}

      {wallet && (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '20px',
            fontSize: '14px',
          }}
        >
          <p style={{ margin: '0 0 8px 0', color: '#555' }}>Available Credits</p>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
            {wallet.balance.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}