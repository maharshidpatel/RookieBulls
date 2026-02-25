/*
 * services/trade.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   HTTP calls to the trade endpoints.
 *   Uses axiosInstance so the JWT interceptor handles token refresh
 *   automatically on every request.
 *
 * EXPORTS:
 *   executeBuy(ticker, quantity)
 *   executeSell(ticker, quantity)
 *
 * WHAT DOES NOT BELONG HERE:
 *   - UI logic
 *   - State management
 *   - Error display
 */

import axiosInstance from './axiosInstance';

// executeBuy(ticker, quantity)
//
// Sends a POST to /api/trade/buy.
// Returns the trade document on success.
// Throws on 400, 404, or 422 — caller handles the error message.
export const executeBuy = async (ticker, quantity) => {
  const res = await axiosInstance.post('/api/trade/buy', { ticker, quantity });
  return res.data;
};

// executeSell(ticker, quantity)
//
// Sends a POST to /api/trade/sell.
// Returns the trade document on success.
// Throws on 400 or 422 — caller handles the error message.
export const executeSell = async (ticker, quantity) => {
  const res = await axiosInstance.post('/api/trade/sell', { ticker, quantity });
  return res.data;
};