/**
 * server.js — Application Entry Point
 *
 * This is the first file Node.js executes when the server starts.
 * Responsibilities:
 *  - Create the Express application instance
 *  - Register global middleware (security, logging, JSON parsing)
 *  - Mount all module routes under their URL prefixes
 *  - Connect to MongoDB
 *  - Start listening for incoming HTTP requests
 *
 * What does NOT belong here:
 *  - Business logic (goes in service files)
 *  - Database schema definitions (goes in model files)
 *  - Route handler logic (goes in controller files)
 *  - Database connection config (goes in config/db.js)
 */