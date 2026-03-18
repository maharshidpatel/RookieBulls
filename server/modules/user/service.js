/*
 * FILE: server/modules/user/service.js
 *
 * RESPONSIBILITY:
 *   Business logic for user profile operations.
 *   Reads and writes user profile data.
 *   Handles password change with current password verification.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - HTTP logic (no req, res — that is controller.js)
 *   - Input format validation (that is validators.js)
 *   - Token generation (that is auth/service.js)
 *
 * HOW IT FITS:
 *   controller.js calls these functions with plain values.
 *   This file calls the User model to read and write data.
 */

const bcrypt = require('bcrypt');
const User   = require('./model');

const SALT_ROUNDS = 12;

// ─── getProfile ───────────────────────────────────────────────────────────
//
// Returns the authenticated user's profile data.
// userId comes from req.user.sub (decoded JWT payload) in the controller.
//
// Fields returned match the GET /api/user/profile contract exactly.
// passwordHash and verification fields are excluded — not needed by the UI.
//
// .lean() returns a plain JS object instead of a Mongoose document.
// Faster for read-only operations where you do not need Mongoose methods.

async function getProfile(userId) {
  const user = await User.findById(userId).lean();

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    firstName:   user.firstName,
    lastName:    user.lastName,
    email:       user.email,
    displayName: user.displayName,
    country:     user.country,
    phone:       user.phone,
    bio:         user.bio,
    createdAt:   user.createdAt,
    isVerified:  user.isVerified,
  };
}

// ─── updateProfile ────────────────────────────────────────────────────────
//
// Updates editable profile fields for the authenticated user.
//
// Only the fields present in the request body are updated.
// Fields not sent are left unchanged in the database.
//
// How partial updates work:
//   The controller builds an object containing only the fields
//   that were present in the request. That object is passed here.
//   $set in MongoDB only touches the fields you specify —
//   all other fields on the document are left untouched.
//
// { new: true } tells findByIdAndUpdate to return the updated
// document rather than the document as it was before the update.
// Without it, you would get back the old values.
//
// { runValidators: true } runs Mongoose schema validators on the
// updated fields. Without it, updates bypass schema rules entirely.

async function updateProfile(userId, fields) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: fields },
    { new: true, runValidators: true }
  ).lean();

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    firstName:   user.firstName,
    lastName:    user.lastName,
    email:       user.email,
    displayName: user.displayName,
    country:     user.country,
    phone:       user.phone,
    bio:         user.bio,
    createdAt:   user.createdAt,
    isVerified:  user.isVerified,
  };
}

// ─── changePassword ───────────────────────────────────────────────────────
//
// Updates the user's password after verifying the current one.
//
// Flow:
//   1. Fetch user with passwordHash (select: false in schema — must request explicitly)
//   2. Verify currentPassword against stored hash
//   3. Hash the new password
//   4. Write the new hash to the DB
//
// Why verify the current password:
//   If someone leaves their browser open and walks away,
//   an attacker should not be able to change the password
//   without knowing the current one. This is standard practice
//   for authenticated password change flows.

async function changePassword(userId, currentPassword, newPassword) {
  /*
   * passwordHash has select: false in the schema.
   * Must explicitly request it with .select('+passwordHash').
   * Without this, passwordHash is undefined and bcrypt.compare throws.
   */
  const user = await User.findById(userId).select('+passwordHash');

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!passwordMatch) {
    const error = new Error('Current password is incorrect');
    error.statusCode = 400;
    throw error;
  }

  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await User.findByIdAndUpdate(userId, {
    $set: { passwordHash: newPasswordHash },
  });

  return { message: 'Password updated successfully' };
}

module.exports = { getProfile, updateProfile, changePassword };