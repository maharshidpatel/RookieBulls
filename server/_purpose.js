/**
 * FOLDER: /server
 *
 * The entire backend application lives here.
 * This is a Node.js + Express API server.
 *
 * What this folder contains:
 *  - server.js        → application entry point
 *  - config/          → database and environment setup
 *  - middleware/      → shared request processing logic
 *  - modules/         → all features organized by domain
 *  - utils/           → small shared helper functions
 *
 * How it works:
 *  Node.js executes server.js first.
 *  server.js wires everything together and starts the HTTP server.
 *  All incoming requests from the React frontend arrive here.
 *  All responses go back to the frontend from here.
 *
 * What this folder does NOT contain:
 *  - Any UI code (lives in /client)
 *  - Any static assets like images or fonts
 *
 * Deployment target:
 *  DigitalOcean VPS running inside Docker
 */