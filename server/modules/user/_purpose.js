/*
 * FOLDER: server/modules/user
 *
 * PURPOSE:
 *   Owns everything related to reading and updating a user's own profile.
 *   This module is about what a user can do with their own account data
 *   after they are already authenticated.
 *
 * WHAT BELONGS HERE:
 *   - Reading profile data (GET /api/user/profile)
 *   - Updating profile fields (PUT /api/user/profile)
 *   - Changing password (PUT /api/user/password)
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Registration, login, token issuance — that is auth/
 *   - Email verification — that is auth/
 *   - Wallet, trade, portfolio — those are their own modules
 *   - Admin operations on other users — that is a future admin/ module
 *
 * WHY SEPARATE FROM auth/:
 *   auth/ owns the authentication lifecycle — proving identity,
 *   issuing tokens, verifying email.
 *   user/ owns the profile lifecycle — reading and updating account data.
 *   Single responsibility: each module has one reason to change.
 *   If email verification logic changes, auth/ changes.
 *   If profile fields change, user/ changes.
 *   Neither affects the other.
 *
 * ENDPOINTS:
 *   GET  /api/user/profile   — returns the authenticated user's profile
 *   PUT  /api/user/profile   — updates editable profile fields
 *   PUT  /api/user/password  — changes password (requires current password)
 *
 * REQUEST FLOW:
 *   Request → authenticate middleware → routes.js
 *   → validators.js → controller.js → service.js → model.js (User)
 */