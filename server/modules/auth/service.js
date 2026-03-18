/*
 * FILE: server/modules/auth/service.js
 *
 * RESPONSIBILITY:
 *   Contains all business logic for authentication.
 *   Handles password hashing, credential verification,
 *   and JWT token generation.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - HTTP logic (no req, res, status codes — that is controller.js)
 *   - Input format validation (that is validators.js)
 *   - Direct MongoDB queries outside of the User model
 *
 * HOW IT FITS:
 *   controller.js calls functions from this file.
 *   This file calls the User model to read/write data.
 *   This file uses bcrypt, crypto, and jsonwebtoken directly.
 *
 * STEP 7 CHANGES:
 *   register()            — accepts firstName, lastName; generates verificationToken;
 *                           does NOT return JWT tokens (user must verify first)
 *   login()               — hard-blocks unverified users with 403
 *   generateAccessToken() — firstName added to JWT payload for TopNav display
 *   verifyEmail()         — new: marks user as verified, clears token
 *   resendVerification()  — new: generates a fresh token, rate-limited
 *
 */

const bcrypt  = require('bcrypt');
const crypto  = require('crypto');   // Built into Node — no install needed
const jwt     = require('jsonwebtoken');
const User    = require('./model');
const { env } = require('../../config/env');
const { createWallet } = require('../wallet/service');
const emailService = require('./emailService');

const SALT_ROUNDS = 12;

/*
 * TOKEN TTL
 *
 * How long a verification token stays valid.
 * Stored as milliseconds so it can be added directly to Date.now().
 * 24 * 60 * 60 * 1000 = 86,400,000ms = 24 hours.
 */
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

// ─── register ──────────────────────────────────────────────────────────────
//
// Step 7 changes vs previous version:
//   - Accepts firstName and lastName
//   - Generates a verificationToken and verificationExpiry
//   - Does NOT create JWT tokens — unverified users cannot log in
//   - Returns a plain message, not a token pair
//   - Email is sent after user is created (wired in substep 7.4)
//
// Flow:
//   1. Check for duplicate email
//   2. Hash password
//   3. Generate verification token
//   4. Create user in DB (isVerified defaults to false)
//   5. Create wallet
//   6. Send verification email (substep 7.4)
//   7. Return success message only

async function register(firstName, lastName, email, password) {
  const existing = await User.findOne({ email }).lean();

  if (existing) {
    const error = new Error('Email is already registered');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  /*
   * generateVerificationToken()
   *   crypto.randomBytes(32) generates 32 cryptographically random bytes.
   *   .toString('hex') converts those bytes to a 64-character hex string.
   *
   *   This is the token embedded in the verification link:
   *     http://localhost:5173/verify/<token>
   *
   *   It is stored directly on the user document (not hashed).
   *   Unlike passwords, verification tokens are single-use and short-lived —
   *   hashing them adds complexity without meaningful security benefit here.
   */
  const verificationToken  = crypto.randomBytes(32).toString('hex');
  const verificationExpiry = new Date(Date.now() + VERIFICATION_TTL_MS);

  const user = await User.create({
    firstName,
    lastName,
    email,
    passwordHash,
    verificationToken,
    verificationExpiry,
    // isVerified defaults to false in the schema
  });

  await createWallet(user._id);

  /*
   * Send the verification email.
   * If this throws, the error propagates to the controller which returns 500.
   * The user document already exists in the DB at this point.
   * This is an acceptable edge case at MVP — noted for post-MVP
   * transaction/rollback strategy alongside the wallet creation edge case.
   */
  await emailService.sendVerificationEmail(user.email, user.firstName, verificationToken);

  return {
    message: 'Verification email sent. Please check your inbox.',
  };
}

// ─── login ────────────────────────────────────────────────────────────────
//
// Step 7 change: isVerified check added before token issuance.
// An unverified user gets a 403 — credentials may be correct,
// but access is denied until the email is confirmed.
//
// 403 Forbidden vs 401 Unauthorized:
//   401 = "I don't know who you are" (authentication failure)
//   403 = "I know who you are, but you cannot proceed" (authorization failure)
//   Using 403 here is semantically correct — the password matched, but the
//   account is not in a state that permits access.

async function login(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  /*
   * Hard block: unverified users cannot receive tokens.
   * The frontend detects this 403 and shows a resend option.
   */
  if (!user.isVerified) {
    const error = new Error('Please verify your email before logging in');
    error.statusCode = 403;
    throw error;
  }

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    accessToken,
    refreshToken,
    user: {
      _id:       user._id,
      email:     user.email,
      role:      user.role,
      firstName: user.firstName,
    },
  };
}

// ─── verifyEmail ──────────────────────────────────────────────────────────
//
// Called when the user clicks the verification link in their email.
// The link contains the raw token: /verify/:token
// We find the user by that token, check expiry, then mark as verified.
//
// Three outcomes:
//   404 — no user has this token (link is invalid or was already used)
//   400 — token exists but has expired
//   200 — token valid, user marked as verified

async function verifyEmail(token) {
  /*
   * Find the user document whose verificationToken matches.
   * After verification, verificationToken is set to null —
   * so this query will return null if the token was already used.
   */
  const user = await User.findOne({ verificationToken: token });

  if (!user) {
    const error = new Error('Invalid verification link');
    error.statusCode = 404;
    throw error;
  }

  /*
   * Check expiry.
   * verificationExpiry is stored as a Date object.
   * new Date() is the current time.
   * If current time is past the expiry, the token is stale.
   */
  if (new Date() > user.verificationExpiry) {
    const error = new Error('Verification link has expired');
    error.statusCode = 400;
    throw error;
  }

  /*
   * Mark the user as verified and clear the token fields.
   * Clearing the token ensures the same link cannot be used again.
   * findByIdAndUpdate with { new: true } returns the updated document.
   */
  await User.findByIdAndUpdate(user._id, {
    isVerified:          true,
    verificationToken:   null,
    verificationExpiry:  null,
  });

  return { message: 'Email verified successfully' };
}

// ─── resendVerification ───────────────────────────────────────────────────
//
// Generates a fresh token and sends a new verification email.
// Called when a user's token has expired, or they lost the original email.
//
// Rate limiting for this endpoint is handled at the route level
// using express-rate-limit (added in substep 7.7 routes.js update).
// This function does not enforce rate limits itself —
// that is infrastructure-level concern, not business logic.

async function resendVerification(email) {
  const user = await User.findOne({ email });

  if (!user) {
    const error = new Error('No account found with that email');
    error.statusCode = 404;
    throw error;
  }

  if (user.isVerified) {
    const error = new Error('This account is already verified');
    error.statusCode = 400;
    throw error;
  }

  /*
   * Generate a fresh token and reset the expiry window.
   * The old token is overwritten — only the newest link will work.
   */
  const verificationToken  = crypto.randomBytes(32).toString('hex');
  const verificationExpiry = new Date(Date.now() + VERIFICATION_TTL_MS);

  await User.findByIdAndUpdate(user._id, {
    verificationToken,
    verificationExpiry,
  });

  await emailService.sendVerificationEmail(user.email, user.firstName, verificationToken);

  return { message: 'Verification email sent' };
}

// ─── refresh ──────────────────────────────────────────────────────────────
//
// Issues a new access token when the current one has expired.
// The refresh token is validated, then the user is confirmed to still exist.
// Refresh token rotation is a post-MVP consideration — same token is reused.

async function refresh(refreshToken) {
  if (!refreshToken) {
    const err = new Error('Refresh token is required');
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    const err = new Error('User no longer exists');
    err.statusCode = 401;
    throw err;
  }

  const accessToken = generateAccessToken(user);
  return { accessToken };
}

// ─── generateAccessToken ──────────────────────────────────────────────────
//
// Step 7 change: firstName added to the payload.
//
// Why firstName in the token:
//   TopNav displays the user's first name on every page.
//   Without this, every page load would need a GET /api/user/profile call
//   just to show a name. Embedding it in the token eliminates that round trip.
//
//   If the user changes their firstName on ProfilePage:
//     PUT /api/user/profile updates the DB
//     Frontend calls AuthContext.updateUser({ firstName: newValue })
//     AuthContext updates its in-memory user object
//     TopNav re-renders with the new name immediately
//   The token itself becomes stale (still has old name) but expires in 15m.
//   That is an acceptable trade-off at this stage.

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub:       user._id,
      role:      user.role,
      firstName: user.firstName,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

// ─── generateRefreshToken ─────────────────────────────────────────────────
//
// Longer-lived than the access token (7 days).
// Signed with a separate secret — cannot be used as an access token.

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user._id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { register, login, refresh, verifyEmail, resendVerification };