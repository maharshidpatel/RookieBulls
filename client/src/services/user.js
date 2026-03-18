/*
 * FILE: client/src/services/user.js
 *
 * RESPONSIBILITY:
 *   All HTTP requests related to user profile management.
 *   ProfilePage never calls axios directly — it calls functions from here.
 *
 * WHY THIS EXISTS:
 *   If the API URL or request shape changes, only this file needs updating.
 *
 * HOW IT FITS:
 *   Uses axiosInstance — automatically attaches the Authorization header
 *   and handles token refresh on 401 responses.
 *   All three endpoints require authentication.
 */

import axiosInstance from './axiosInstance';

/*
 * GET PROFILE
 *
 * Returns the authenticated user's full profile data.
 * Called on ProfilePage mount to populate the form fields.
 */
export async function getProfile() {
  const response = await axiosInstance.get('/api/user/profile');
  return response.data;
}

/*
 * UPDATE PROFILE
 *
 * Sends only the fields the user changed.
 * Partial updates supported — omitted fields are left unchanged in DB.
 *
 * data shape: { firstName, lastName, displayName, country, phone, bio }
 * All fields optional — send only what changed.
 */
export async function updateProfile(data) {
  const response = await axiosInstance.put('/api/user/profile', data);
  return response.data;
}

/*
 * CHANGE PASSWORD
 *
 * Requires current password for verification.
 * confirmPassword is validated client-side before this is called —
 * the server also validates it as a safeguard.
 *
 * data shape: { currentPassword, newPassword, confirmPassword }
 */
export async function changePassword(data) {
  const response = await axiosInstance.put('/api/user/password', data);
  return response.data;
}