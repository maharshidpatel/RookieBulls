/**
 * MODULE: /server/modules/auth
 *
 * Handles everything related to identity — who a user is
 * and proving they are who they claim to be.
 *
 * Responsibilities:
 *  - User registration (firstName, lastName, email, password)
 *  - Email verification (token generation, verification, resend)
 *  - User login (verify credentials, check isVerified, issue tokens)
 *  - Token refresh (issue new access token using refresh token)
 *  - Logout (clear session)
 *
 * What this module does NOT handle:
 *  - Profile data like display name or preferences (user/ module)
 *  - Wallet creation on registration (wallet/ module is triggered
 *    by auth service but wallet logic lives in wallet/ module)
 *
 * Files in this module:
 *  - model.js        → User schema including verification and profile fields
 *  - service.js      → register, login, verifyEmail, resendVerification, refresh
 *  - controller.js   → HTTP layer for all auth endpoints
 *  - routes.js       → endpoint definitions + rate limiter wiring
 *  - validators.js   → input validation for register, login, resend
 *  - emailService.js → Resend API wrapper — sends verification emails
 *
 * Tokens issued here:
 *  - Access token:  short-lived (15m), carries userId, role, firstName
 *  - Refresh token: long-lived (7d), used only to get a new access token
 *
 * Email verification flow:
 *  Register → token generated → email sent via Resend → user clicks link
 *  → GET /api/auth/verify/:token → isVerified set to true
 *  Unverified users are created in DB but blocked from login with 403.
 *
 * Rate limiting (applied at routes.js):
 *  - POST /register              → 10 attempts per hour per IP
 *  - POST /login                 → 10 attempts per 15 minutes per IP
 *  - POST /resend-verification   → 3 attempts per hour per IP
 *
 * OAuth (Google login) is out of scope for MVP — deferred to later step.
 */