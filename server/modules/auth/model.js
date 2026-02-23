/*
 * FILE: server/modules/auth/model.js
 *
 * RESPONSIBILITY:
 *   Defines the MongoDB schema and Mongoose model for the User collection.
 *   This file describes what a user document looks like in the database.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Password hashing (that belongs in auth/service.js)
 *   - Token generation (that belongs in auth/service.js)
 *   - HTTP logic (that belongs in auth/controller.js)
 *   - Validation of request input (that belongs in auth/validators.js)
 *
 * HOW IT FITS:
 *   service.js calls this model to create and query user documents.
 *   The model is the only layer allowed to directly touch MongoDB.
 */

const mongoose = require('mongoose');

/*
 * SCHEMA DEFINITION
 *
 * A schema is a set of rules that every document in this collection must follow.
 * Mongoose enforces these rules before writing anything to MongoDB.
 *
 * { timestamps: true } tells Mongoose to automatically manage two fields:
 *   - createdAt: set once when the document is first created
 *   - updatedAt: updated every time the document is saved
 * You do not need to define these manually.
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,       // MongoDB will reject duplicate emails at the DB level
      lowercase: true,    // Stored as lowercase regardless of what was submitted
      trim: true,         // Removes leading and trailing whitespace
    },

    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      /*
       * select: false means this field is excluded from query results by default.
       * When you do User.findOne({ email }), passwordHash will NOT be returned
       * unless you explicitly ask for it with .select('+passwordHash').
       *
       * This is a defense-in-depth measure. If any code accidentally exposes a
       * user object, the password hash will not leak with it.
       */
      select: false,
    },

    role: {
      type: String,
      enum: ['user', 'admin'], // Only these two values are accepted
      default: 'user',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

/*
 * MODEL EXPORT
 *
 * mongoose.model('User', userSchema) does two things:
 *   1. Registers this schema under the name 'User'
 *   2. Returns a Model class that maps to the 'users' collection in MongoDB
 *      (Mongoose automatically lowercases and pluralizes the model name)
 *
 * You import this User object in the service layer to run queries:
 *   User.create()
 *   User.findOne()
 *   User.findById()
 */
const User = mongoose.model('User', userSchema);

module.exports = User;