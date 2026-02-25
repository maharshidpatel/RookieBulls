/*
 * services/portfolio.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   HTTP calls to the portfolio endpoint.
 *   Uses axiosInstance for automatic token refresh handling.
 *
 * EXPORTS:
 *   fetchMyPortfolio()
 *
 * WHAT DOES NOT BELONG HERE:
 *   - PnL calculation (done on the server)
 *   - UI logic or state
 */

import axiosInstance from './axiosInstance';

// fetchMyPortfolio()
//
// Sends a GET to /api/portfolio/me.
// Returns { positions[], summary } on success.
export async function fetchMyPortfolio() {
  const response = await axiosInstance.get('/api/portfolio/me');
  return response.data.data.portfolio;
}