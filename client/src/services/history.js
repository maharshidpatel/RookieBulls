/*
 * services/history.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Frontend service for trade history data.
 *   Single function — fetchTradeHistory() — called by HistoryPage.
 *
 * Does NOT belong here:
 *   Display logic, formatting, state management.
 *
 * How it fits:
 *   HistoryPage calls fetchTradeHistory() on mount.
 *   axiosInstance automatically attaches the Authorization header
 *   and handles token refresh transparently.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axiosInstance from './axiosInstance';

// fetchTradeHistory()
//
// GET /api/trade/history
// Returns all trades for the authenticated user, newest first.
//
// Response shape:
//   { success: true, data: { trades: [{ _id, ticker, action, quantity,
//     priceAtExecution, feesSimulated, status, createdAt }] } }
//
// Returns an empty array if the user has no trade history.
// Throws on network failure or auth error (handled by axiosInstance).
const fetchTradeHistory = async () => {
  const response = await axiosInstance.get('/trade/history');
  return response.data.data.trades;
};

export default fetchTradeHistory;