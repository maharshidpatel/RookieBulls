/**
 * MODULE: /server/modules/user
 *
 * Manages user profile data after the account exists.
 * Auth creates the account. User module manages what is in it.
 *
 * Responsibilities:
 *  - Read user profile (name, email, role, join date)
 *  - Update profile information
 *  - Change password
 *  - Account deactivation
 *
 * What this module does NOT handle:
 *  - Authentication or token logic (auth module)
 *  - Wallet or credits (wallet module)
 *  - Trade history (trade module)
 *
 * Relationship to auth module:
 *  Auth module creates the User document in MongoDB.
 *  User module reads and updates that same document.
 *  They share the same User model.
 */