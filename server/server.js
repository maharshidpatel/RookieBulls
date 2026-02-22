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

/**
 * server.js — Application Entry Point
 *
 * Initializes and starts the Rookie Bulls Express server.
 * This file wires everything together:
 *  - Loads environment variables
 *  - Creates the Express app
 *  - Registers global middleware
 *  - Mounts module routes (added as modules are built)
 *  - Connects to MongoDB
 *  - Starts the HTTP server
 *
 * What does NOT belong here:
 *  - Business logic (lives in service files)
 *  - Route handler logic (lives in controller files)
 *  - Database schema definitions (lives in model files)
 */

/**
### Understanding the middleware order
The order middleware is registered in Express matters. Each piece of middleware runs in sequence for every request:

Request arrives
      ↓
helmet()        → adds security headers
      ↓
cors()          → checks if origin is allowed
      ↓
morgan()        → logs the request
      ↓
express.json()  → parses the request body
      ↓
routes          → finds the matching route handler
      ↓
404 handler     → catches unmatched routes
      ↓
error handler   → catches any thrown errors
      ↓
Response sent
*/

// Must be first — loads and validates all environment variables
// before anything else in the application runs
const env = require('./config/env')

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const connectDB = require('./config/db')

const app = express()

// ─── Global Middleware ────────────────────────────────────────
// These run on every incoming request in the order they are registered

// Sets secure HTTP response headers
// Protects against common web vulnerabilities automatically
app.use(helmet())

// Allows requests from the React frontend origin only
// Any request from an unlisted origin is rejected by the browser
app.use(cors({ origin: env.CLIENT_ORIGIN }))

// Logs every request to the terminal during development
// Format: METHOD URL STATUS RESPONSE_TIME
app.use(morgan('dev'))

// Parses incoming JSON request bodies
// Without this, req.body is undefined on POST/PUT requests
app.use(express.json())

// ─── Routes ───────────────────────────────────────────────────
// Module routes are mounted here as they are built
// Each module gets its own URL prefix
// Example when auth module is ready:
//   const authRoutes = require('./modules/auth/routes')
//   app.use('/api/auth', authRoutes)

// ─── Health Check ─────────────────────────────────────────────
// A simple endpoint to verify the server is running
// Used by monitoring tools and deployment pipelines
// to confirm the service is healthy
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString()
  })
})

// ─── 404 Handler ──────────────────────────────────────────────
// Catches any request that did not match a registered route
// Must be registered after all routes
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.url} not found`
  })
})

// ─── Global Error Handler ─────────────────────────────────────
// Catches any error thrown anywhere in the application
// Must be registered last and must have four parameters
// Express identifies error handlers by the four parameter signature
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    status: 'error',
    message: env.NODE_ENV === 'production'
      ? 'Something went wrong'
      : err.message
  })
})

// ─── Start Server ─────────────────────────────────────────────
// Connect to MongoDB first, then start accepting HTTP requests
// The server never starts if the database connection fails
const start = async () => {
  await connectDB()
  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`)
  })
}

start()
