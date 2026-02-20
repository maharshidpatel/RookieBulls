/**
 * config/db.js — MongoDB Connection
 *
 * Handles the connection between the application and MongoDB.
 * Called once at startup from server.js.
 *
 * Why separate from server.js:
 *  - Keeps the entry point clean and readable
 *  - Database connection logic can change independently
 *    without touching the main server file
 *
 * Uses MONGO_URI from environment variables.
 * Never hardcode credentials here.
 */