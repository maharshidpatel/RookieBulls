/*
 * FILE: server/modules/user/model.js
 *
 * RESPONSIBILITY:
 *   Re-exports the User model from auth/model.js.
 *
 * WHY THIS EXISTS:
 *   There is only one users collection in MongoDB.
 *   Both the auth/ and user/ modules operate on the same collection
 *   and therefore the same Mongoose model.
 *
 *   Rather than importing from auth/model.js directly inside user/service.js
 *   (which would create a cross-module dependency), this file acts as a
 *   local alias. If the User model ever moves, only this file needs updating.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Schema definition (that lives in auth/model.js)
 *   - Any logic or transformation
 */

const User = require('../auth/model');

module.exports = User;