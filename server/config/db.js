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

/**
 * Establishes the connection between Express and MongoDB using Mongoose.
 * Called once at startup from server.js before the HTTP server starts.
 *
 * Why connect before starting the server:
 *  If the database is unavailable, the app should not accept
 *  requests at all. Starting the HTTP server first and then
 *  failing on database calls mid-request is a worse experience
 *  than refusing to start entirely.
 *
 * Mongoose connection events:
 *  connected  → successful connection established
 *  error      → connection failed
 *  disconnect → connection was lost after being established
 */

const mongoose = require('mongoose')
const { MONGO_URI } = require('./env')

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(MONGO_URI)
    console.log(`MongoDB connected: ${connection.connection.host}`)
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`)
    process.exit(1)
  }
}

module.exports = connectDB