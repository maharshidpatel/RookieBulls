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
 *   This file uses bcrypt and jsonwebtoken directly.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./model');
const { env } = require('../../config/env');
const { createWallet } = require('../wallet/service');

/*
 * SALT ROUNDS
 *
 * Controls how computationally expensive bcrypt hashing is.
 * 12 is the standard production value.
 * Higher = slower to hash = harder for attackers to brute force.
 * Do not go below 10 in production.
 */
const SALT_ROUNDS = 12;

/*
 * REGISTER
 *
 * Accepts plain email and password strings.
 * Returns the newly created user object (without passwordHash).
 * Throws an error if the email is already registered.
 */
async function register(email, password) {
  /*
   * Check if a user with this email already exists.
   * This is a business rule — not a format check (that was validators.js).
   *
   * .lean() returns a plain JS object instead of a full Mongoose document.
   * Faster and lighter when you only need to read data, not modify it.
   */
  const existing = await User.findOne({ email }).lean();

  if (existing) {
    /*
     * Throwing an error here causes it to bubble up to the controller.
     * The controller catches it and decides what HTTP response to send.
     * Services never send HTTP responses directly.
     */
    const error = new Error('Email is already registered');
    error.statusCode = 409; // 409 Conflict — resource already exists
    throw error;
  }

  /*
   * Hash the plain-text password before storing it.
   *
   * bcrypt.hash(password, saltRounds)
   *   Generates a salt, runs the hashing algorithm 2^saltRounds times,
   *   and returns a single string that includes the salt and the hash.
   *   That string is everything needed to verify the password later.
   */
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  /*
   * Create the user document in MongoDB.
   * User.create() runs schema validation before inserting.
   */
  const user = await User.create({ email, passwordHash });

  /*
   * Wallet is created immediately after user creation.
   * Every registered user must have a wallet — no exceptions.
   * If wallet creation fails, the error propagates up and
   * the controller returns a 500. The user record will exist
   * without a wallet in this case, which is an edge case
   * noted for post-MVP cleanup (transaction/rollback strategy).
   */
  await createWallet(user._id);

  /*
   * Return a plain object with only the fields the caller needs.
   * passwordHash is intentionally excluded — it should never leave the service.
   */
  return {
    _id: user._id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/*
 * LOGIN
 *
 * Accepts plain email and password strings.
 * Returns a signed access token and refresh token if credentials are valid.
 * Throws an error if the email is not found or the password does not match.
 */
async function login(email, password) {
  /*
   * Find the user by email.
   * passwordHash uses select: false in the schema, so we must explicitly
   * request it here using .select('+passwordHash').
   * Without this, bcrypt.compare would have nothing to compare against.
   */
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    /*
     * Do not say "email not found" — that reveals which emails are registered.
     * Always use a generic message for failed login attempts.
     */
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  /*
   * bcrypt.compare(plainText, hash)
   *   Hashes the submitted password using the same salt embedded in the
   *   stored hash, then compares the two results.
   *   Returns true if they match, false if they do not.
   *   The original password is never recoverable from the stored hash.
   */
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  /*
   * Credentials are valid. Issue tokens.
   */
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      email: user.email,
      role: user.role,
    },
  };
}

/*
 * GENERATE ACCESS TOKEN
 *
 * jwt.sign(payload, secret, options)
 *   payload: data embedded inside the token (readable by anyone who has it)
 *   secret:  key used to sign the token — only your server knows this
 *   expiresIn: token becomes invalid after this duration
 *
 * The payload contains only what is needed to identify the user on each request.
 * Do not put sensitive data (passwordHash, full profile) in a JWT payload.
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id,    // "sub" = subject — standard JWT claim for user identity
      role: user.role,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

/*
 * GENERATE REFRESH TOKEN
 *
 * Longer lived than the access token.
 * Used only to request a new access token — not to access protected routes.
 * Signed with a different secret so the two token types cannot be swapped.
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user._id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

// ─── refresh ──────────────────────────────────────────────────
// Issues a new access token when the current one has expired.
// Called by the frontend axios interceptor automatically —
// the user never triggers this directly.
//
// Flow:
//   1. Validate that a refresh token was provided
//   2. Verify the token signature and expiry against JWT_REFRESH_SECRET
//      (refresh tokens are signed with a different secret than access tokens
//       so they cannot be swapped or cross-verified)
//   3. Confirm the user still exists in the database
//      (handles the case where an account was deleted after token was issued)
//   4. Issue a fresh access token and return it
//
// Why not issue a new refresh token here:
//   Refresh token rotation (issuing a new refresh token on every use) is
//   a security hardening technique. It is a post-MVP consideration.
//   For now, the same refresh token is reused until it expires (7 days).

async function refresh(refreshToken) {
  // Guard: reject immediately if no token was sent in the request body
  if (!refreshToken) {
    const err = new Error('Refresh token is required');
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    // jwt.verify() does two things simultaneously:
    //   1. Checks the token signature using JWT_REFRESH_SECRET
    //   2. Checks that the token has not expired
    // If either check fails it throws, which we catch below.
    // JWT_REFRESH_SECRET is separate from JWT_ACCESS_SECRET —
    // a refresh token cannot be used as an access token and vice versa.
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    // Covers both tampered tokens and genuinely expired ones.
    // Generic message — we do not tell the client which case it was.
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    throw err;
  }

  // payload.sub is the userId encoded in the token at login time.
  // We query the DB to confirm the user still exists.
  // This guards against tokens that are technically valid but belong
  // to accounts that have since been deleted.
  const user = await User.findById(payload.sub);
  if (!user) {
    const err = new Error('User no longer exists');
    err.statusCode = 401;
    throw err;
  }

  // Issue a fresh access token using the same function used at login.
  // Access token lifetime is controlled by JWT_ACCESS_EXPIRY in .env (15m).
  const accessToken = generateAccessToken(user);
  return { accessToken };
}

module.exports = { register, login, refresh };