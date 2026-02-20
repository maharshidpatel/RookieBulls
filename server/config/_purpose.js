/**
 * FOLDER: /server/config
 *
 * Configuration files that set up connections to external systems
 * and load application settings before the server starts.
 *
 * Files:
 *  - db.js  → establishes and manages the MongoDB connection
 *  - env.js → loads .env variables and validates they are present
 *
 * Why these are separate from server.js:
 *  server.js should only be responsible for starting the app.
 *  Connecting to a database and loading config are setup concerns
 *  that belong in their own files.
 *  This makes server.js readable at a glance and keeps each
 *  file focused on one responsibility.
 *
 * Rule:
 *  Any time the app needs to connect to something external
 *  (database, cache, third-party service), that connection
 *  logic lives in this folder.
 */