/*
 * WALLET SERVICE — client/src/services/wallet.js
 * ─────────────────────────────────────────────────────────────
 * Responsibility:
 *   All HTTP calls related to the wallet.
 *   Components never call axios directly — always through here.
 */

import axios from 'axios';

// Retrieves the authenticated user's wallet.
// Requires a valid access token in Authorization header.
export async function fetchMyWallet(accessToken) {
  const response = await axios.get('/api/wallet/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data.data.wallet;
}