/**
 * MODULE: /server/modules/auth
 *
 * Handles everything related to identity — who a user is
 * and proving they are who they claim to be.
 *
 * Responsibilities:
 *  - User registration (create account, hash password, issue tokens)
 *  - User login (verify credentials, issue tokens)
 *  - Token refresh (issue new access token using refresh token)
 *  - Logout (invalidate refresh token)
 *
 * What this module does NOT handle:
 *  - Profile data like display name or preferences (user module)
 *  - Wallet creation on registration (wallet module is triggered
 *    by auth service but wallet logic lives in wallet module)
 *
 * Tokens issued here:
 *  - Access token:  short-lived (15m), sent with every API request
 *  - Refresh token: long-lived (7d), used only to get a new access token
 *
 * MVP scope:
 *  Email + password authentication only.
 *  OAuth (Google login etc.) is out of scope for MVP.
 */