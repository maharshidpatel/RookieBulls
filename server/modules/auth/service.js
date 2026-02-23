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

module.exports = { register, login };